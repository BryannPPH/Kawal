import type { ManagerSection } from '../types/navigation';
import type { Notification, Tone, WorkerStatus } from '../types/workforce';
import { getNotifications, getTasks, getWorkers, markNotificationRead } from './database';
import { db } from './database';
import { chronosUnavailableForecast, forecastProductivity } from './chronosForecasting';
import { computeFatigue } from './fatigueEngine';
import { getCurrentBreak, getLatestRisk, processIoTMessage, topicPrefix } from './iot';
import { getLatestPpeCheck, runPpeCheck } from './ppe';

type WorkerActionStatus = Extract<WorkerStatus, 'waiting' | 'working' | 'break' | 'done'>;

export type WorkerRestRecommendation = {
  workerId: string;
  recommendedMinutes: number;
  fatigueScore: number;
  fatigueLevel: string;
  chronosStatus: 'READY' | 'UNAVAILABLE';
  reason: string;
};

export async function getWorkerAppData(workerId: string) {
  const worker = getWorkers().find((item) => item.id === workerId) ?? null;
  const tasks = worker ? (await getTasks()).filter((task) => task.owner === worker.name) : [];
  const notifications = getNotifications().filter((notification) => notification.targetWorkerId === workerId);
  const activeIncident = db
    .query('SELECT * FROM emergency_incidents WHERE worker_id = ? AND state != ? ORDER BY opened_at DESC LIMIT 1')
    .get(workerId, 'RESOLVED');

  return {
    worker,
    tasks,
    notifications,
    currentBreak: getCurrentBreak(workerId) ?? null,
    latestRisk: getLatestRisk(workerId) ?? null,
    activeIncident: activeIncident ?? null,
    latestPpeCheck: getLatestPpeCheck(workerId)
  };
}

export async function updateWorkerShiftStatus(workerId: string, status: WorkerActionStatus) {
  if (status === 'working') {
    const latestPpeCheck = getLatestPpeCheck(workerId);

    if (latestPpeCheck?.status !== 'PASSED') {
      throw new Error('PPE verification is required before starting task');
    }
  }

  db.prepare('UPDATE workers SET status = ? WHERE id = ?').run(status, workerId);

  if (status === 'working') {
    const worker = getRequiredWorker(workerId);
    db.prepare("UPDATE tasks SET status = ? WHERE owner = ? AND status NOT IN ('Done', 'Review')").run('In Progress', worker.name);
    createManagerNotification({
      title: 'Task started',
      detail: `${worker.name} started ${worker.task} in ${worker.zone}.`,
      tone: 'success',
      targetLabel: 'View task',
      targetSection: 'tasks',
      targetWorkerId: worker.id
    });
  }

  return getWorkerAppData(workerId);
}

export async function performWorkerPpeCheck(workerId: string, imageDataUrl: string) {
  const worker = getRequiredWorker(workerId);
  const task = (await getTasks()).find((item) => item.owner === worker.name);
  const check = await runPpeCheck({
    workerId,
    taskId: task?.id ?? null,
    imageDataUrl
  });

  if (check.status === 'PASSED') {
    createManagerNotification({
      title: 'PPE verified',
      detail: `${worker.name} passed helmet and harness verification.`,
      tone: 'success',
      targetLabel: 'View worker',
      targetSection: 'workers',
      targetWorkerId: worker.id
    });
  } else {
    createManagerNotification({
      title: 'PPE check failed',
      detail: `${worker.name} could not be verified: ${check.reason}`,
      tone: 'warning',
      targetLabel: 'View worker',
      targetSection: 'workers',
      targetWorkerId: worker.id
    });
  }

  return {
    ...await getWorkerAppData(workerId),
    ppeCheck: check
  };
}

export async function completeWorkerAssignment(workerId: string, imageDataUrl: string) {
  if (!isImageDataUrl(imageDataUrl)) {
    throw new Error('Completion proof photo is required');
  }

  const worker = getRequiredWorker(workerId);
  const activeTasks = (await getTasks()).filter((task) => task.owner === worker.name && !['Done', 'Review'].includes(task.status));
  const submittedAt = new Date().toISOString();

  if (activeTasks.length === 0) {
    throw new Error('No active task is ready for completion proof');
  }

  db.prepare('UPDATE workers SET status = ?, time = ? WHERE id = ?').run('done', worker.time, workerId);

  for (const task of activeTasks) {
    db.prepare(`
      UPDATE tasks
      SET status = ?, due = ?, tone = ?, completion_proof_image = ?, completion_proof_submitted_at = ?, completion_proof_status = ?, completion_proof_note = NULL
      WHERE id = ?
    `).run('Review', 'Proof ready', 'success', imageDataUrl, submittedAt, 'PENDING', task.id);
  }

  createManagerNotification({
    title: 'Task proof ready',
    detail: `${worker.name} submitted a completion photo for ${activeTasks[0]?.title ?? worker.task}.`,
    tone: 'success',
    targetLabel: 'Review proof',
    targetSection: 'tasks',
    targetWorkerId: worker.id
  });

  return getWorkerAppData(workerId);
}

export async function reviewWorkerTaskCompletion(taskId: string, decision: 'accept' | 'reject', note?: string) {
  const task = (await getTasks()).find((item) => item.id === taskId);

  if (!task) {
    return null;
  }

  const worker = getWorkers().find((item) => item.name === task.owner) ?? null;
  const reviewedAt = new Date().toISOString();

  if (decision === 'accept') {
    db.prepare(`
      UPDATE tasks
      SET status = ?, due = ?, tone = ?, completion_proof_status = ?, completion_proof_note = ?
      WHERE id = ?
    `).run('Done', 'Done', 'success', 'ACCEPTED', note?.trim() || 'Accepted by manager', taskId);

    if (worker) {
      db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('done', worker.id);
      createManagerNotification({
        title: 'Completion accepted',
        detail: `${task.title} was accepted by manager at ${formatTime(new Date(reviewedAt))}.`,
        tone: 'success',
        targetLabel: 'Open task',
        targetSection: 'tasks',
        targetWorkerId: worker.id
      });
    }
  } else {
    const rejectionNote = note?.trim() || 'Please submit a clearer completion photo.';
    db.prepare(`
      UPDATE tasks
      SET status = ?, due = ?, tone = ?, completion_proof_status = ?, completion_proof_note = ?
      WHERE id = ?
    `).run('In Progress', 'Needs revision', 'warning', 'REJECTED', rejectionNote, taskId);

    if (worker) {
      db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('working', worker.id);
      createManagerNotification({
        title: 'Completion needs revision',
        detail: `${task.title} was rejected. ${rejectionNote}`,
        tone: 'warning',
        targetLabel: 'Open task',
        targetSection: 'tasks',
        targetWorkerId: worker.id
      });
    }
  }

  return (await getTasks()).find((item) => item.id === taskId) ?? null;
}

export async function reportWorkerHazard(workerId: string, input: { hazardType?: string; note?: string }) {
  const worker = getRequiredWorker(workerId);
  const hazardType = input.hazardType?.trim() || 'Hazard';
  const note = input.note?.trim();

  createManagerNotification({
    title: 'Hazard reported',
    detail: `${worker.name} reported ${hazardType} in ${worker.zone}${note ? `: ${note}` : '.'}`,
    tone: hazardType.toLowerCase().includes('sos') ? 'danger' : 'warning',
    targetLabel: 'View worker',
    targetSection: 'workers',
    targetWorkerId: worker.id
  });

  return getWorkerAppData(workerId);
}

export async function requestWorkerRest(workerId: string) {
  const worker = getRequiredWorker(workerId);
  const device = getAssignedDevice(workerId);

  if (!device) {
    db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('break', workerId);
    createManagerNotification({
      title: 'Rest requested',
      detail: `${worker.name} requested a break from ${worker.zone}.`,
      tone: 'warning',
      targetLabel: 'Open worker',
      targetSection: 'workers',
      targetWorkerId: worker.id
    });
    return { ...await getWorkerAppData(workerId), action: { ok: true, fallback: true } };
  }

  const result = processIoTMessage(
    `${topicPrefix}/devices/${device.id}/events/rest-request`,
    JSON.stringify(makeEnvelope(device, 'REST_BUTTON_PRESSED', {
      buttonPressDurationMs: 800,
      reasonCode: 'WORKER_REQUEST',
      batteryPct: device.battery_pct ?? undefined
    }))
  );

  return { ...await getWorkerAppData(workerId), action: result };
}

export async function getWorkerRestRecommendation(workerId: string): Promise<WorkerRestRecommendation> {
  const worker = getRequiredWorker(workerId);
  const continuousWorkMinutes = parseWorkerTimeMinutes(worker.time);
  const fatigue = computeFatigue({
    continuousWorkMinutes,
    workloadLevel: worker.workload,
    restHistoryMinutes: getRecentRestMinutes(workerId)
  });
  const fatigueScore = Math.max(worker.fatigue, fatigue.fatigueScore);
  const baseMinutes = fatigue.breakMinutes || (fatigueScore >= 75 ? 20 : fatigueScore >= 55 ? 15 : fatigueScore >= 35 ? 10 : 5);
  const chronos = await forecastProductivity({
    historicalCompletedQuantity: [2, 3, 4, 4],
    workerHours: [2, 2.5, 3, Math.max(1, continuousWorkMinutes / 60)],
    breakMinutes: [5, 10, baseMinutes, baseMinutes],
    activeWorkers: [3, 3, 2, worker.status === 'working' ? 1 : 0],
    predictionLength: 3
  }).catch((error) => chronosUnavailableForecast(error instanceof Error ? error.message : 'Chronos unavailable'));
  const chronosBuffer = chronos.modelStatus === 'READY' && chronos.suggestedAdditionalCrew > 0 ? 5 : 0;
  const recommendedMinutes = Math.min(30, Math.max(5, baseMinutes + chronosBuffer));

  return {
    workerId,
    recommendedMinutes,
    fatigueScore,
    fatigueLevel: fatigueScore >= 85 ? 'CRITICAL' : fatigueScore >= 65 ? 'HIGH' : fatigueScore >= 40 ? 'MEDIUM' : 'LOW',
    chronosStatus: chronos.modelStatus,
    reason: chronos.modelStatus === 'READY'
      ? `Fatigue Engine recommends ${baseMinutes} min; Chronos context ${chronos.suggestedAdditionalCrew > 0 ? 'adds recovery buffer for productivity risk' : 'keeps standard recovery'}.`
      : `Fatigue Engine recommends ${baseMinutes} min. Chronos unavailable, so safety fallback is used.`
  };
}

export async function grantWorkerRest(workerId: string, minutes?: number) {
  const worker = getRequiredWorker(workerId);
  const recommendation = await getWorkerRestRecommendation(workerId);
  const plannedMinutes = Math.max(5, Math.min(60, Math.round(minutes ?? recommendation.recommendedMinutes)));
  const task = (await getTasks()).find((item) => item.owner === worker.name && !['Done', 'Review'].includes(item.status));
  const device = getAssignedDevice(workerId);
  const now = new Date();
  const endsAt = new Date(now.getTime() + plannedMinutes * 60_000);
  const breakSessionId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO break_sessions (
      id, worker_id, task_id, device_id, source, status, planned_minutes,
      started_at, ends_at, risk_evaluation_id
    ) VALUES (?, ?, ?, ?, ?, 'BREAK_ACTIVE', ?, ?, ?, NULL)
  `).run(
    breakSessionId,
    workerId,
    task?.id ?? null,
    device?.id ?? `worker-app-${workerId}`,
    'MANAGER_ASSIGNED_REST',
    plannedMinutes,
    now.toISOString(),
    endsAt.toISOString()
  );

  db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('break', workerId);

  if (task) {
    db.prepare("UPDATE tasks SET status = ?, due = ? WHERE id = ?").run('Paused for rest', `${plannedMinutes}m rest`, task.id);
  }

  createManagerNotification({
    title: 'Rest assigned',
    detail: `Manager assigned ${plannedMinutes} minutes of rest. Return around ${formatTime(endsAt)}.`,
    tone: 'warning',
    targetLabel: 'View rest',
    targetSection: 'workers',
    targetWorkerId: worker.id
  });

  return {
    ...await getWorkerAppData(workerId),
    recommendation: {
      ...recommendation,
      recommendedMinutes: plannedMinutes
    },
    breakSessionId
  };
}

export async function triggerWorkerSos(workerId: string) {
  const worker = getRequiredWorker(workerId);
  const device = getAssignedDevice(workerId);

  if (!device) {
    const incidentId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO emergency_incidents (
        id, worker_id, task_id, zone_id, state, trigger_source, device_id, trigger_message_id,
        opened_at, last_known_environment, last_known_motion, escalation_level
      ) VALUES (?, ?, NULL, ?, 'OPEN', 'WORKER_APP_SOS', ?, ?, ?, NULL, NULL, 1)
    `).run(incidentId, worker.id, worker.zone, `worker-app-${worker.id}`, `worker-app-${incidentId}`, now);
    db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('emergency', worker.id);
    createManagerNotification({
      title: 'SOS open',
      detail: `${worker.name} triggered SOS from the worker app in ${worker.zone}.`,
      tone: 'danger',
      targetLabel: 'Open incident',
      targetSection: 'incidents',
      targetWorkerId: worker.id
    });

    return { ...await getWorkerAppData(workerId), action: { ok: true, fallback: true, incidentId } };
  }

  const result = processIoTMessage(
    `${topicPrefix}/devices/${device.id}/events/sos`,
    JSON.stringify(makeEnvelope(device, 'SOS_BUTTON_PRESSED', {
      buttonPressDurationMs: 1500,
      batteryPct: device.battery_pct ?? undefined
    }))
  );

  return { ...await getWorkerAppData(workerId), action: result };
}

export async function readWorkerNotification(workerId: string, notificationId: string) {
  markNotificationRead(notificationId);
  return getWorkerAppData(workerId);
}

function getRequiredWorker(workerId: string) {
  const worker = getWorkers().find((item) => item.id === workerId);

  if (!worker) {
    throw new Error('Worker not found');
  }

  return worker;
}

function getAssignedDevice(workerId: string) {
  return db
    .query<{
      id: string;
      assigned_worker_id: string | null;
      assigned_site_id: string | null;
      assigned_zone_id: string | null;
      assigned_task_id: string | null;
      battery_pct: number | null;
      firmware_version: string | null;
    }, [string]>('SELECT * FROM iot_devices WHERE assigned_worker_id = ? LIMIT 1')
    .get(workerId);
}

function getRecentRestMinutes(workerId: string) {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  return db.query<{ minutes: number | null }, [string, string]>(`
    SELECT COALESCE(SUM(planned_minutes), 0) as minutes
    FROM break_sessions
    WHERE worker_id = ? AND started_at >= ?
  `).get(workerId, eightHoursAgo)?.minutes ?? 0;
}

function parseWorkerTimeMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);

  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    return hours * 60 + minutes;
  }

  return 0;
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(value);
}

function isImageDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(value);
}

function makeEnvelope(
  device: NonNullable<ReturnType<typeof getAssignedDevice>>,
  eventType: string,
  payload: Record<string, unknown>
) {
  return {
    schemaVersion: '1.0',
    messageId: crypto.randomUUID(),
    deviceId: device.id,
    workerId: device.assigned_worker_id,
    siteId: device.assigned_site_id,
    zoneId: device.assigned_zone_id,
    taskId: device.assigned_task_id,
    eventType,
    recordedAt: new Date().toISOString(),
    sequenceNumber: Math.floor(Date.now() / 1000),
    firmwareVersion: device.firmware_version ?? undefined,
    payload
  };
}

function createManagerNotification(input: Omit<Notification, 'id' | 'read'>) {
  db.prepare(`
    INSERT INTO notifications (
      id, title, detail, tone, target_label, target_section, target_worker_id, created_at, read
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    `worker-action-${crypto.randomUUID()}`,
    input.title,
    input.detail,
    input.tone satisfies Tone,
    input.targetLabel,
    input.targetSection satisfies ManagerSection,
    input.targetWorkerId ?? null,
    input.createdAt ?? new Date().toISOString()
  );
}
