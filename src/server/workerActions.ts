import type { ManagerSection } from '../types/navigation';
import type { Notification, Tone, WorkerStatus } from '../types/workforce';
import { getNotifications, getTasks, getWorkers, markNotificationRead } from './database';
import { db } from './database';
import { getCurrentBreak, getLatestRisk, processIoTMessage, topicPrefix } from './iot';
import { getLatestPpeCheck, runPpeCheck } from './ppe';

type WorkerActionStatus = Extract<WorkerStatus, 'waiting' | 'working' | 'break' | 'done'>;

export async function getWorkerAppData(workerId: string) {
  const worker = getWorkers().find((item) => item.id === workerId) ?? null;
  const allTasks = await getTasks();
  const tasks = worker ? allTasks.filter((task) => task.owner === worker.name) : [];
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

export async function acceptWorkerAssignment(workerId: string, taskId?: string) {
  const worker = getRequiredWorker(workerId);
  const assignedTask = await getWorkerTask(worker, taskId, ['Assigned']);

  if (!assignedTask) {
    throw new Error('No assigned task is waiting for acceptance');
  }

  db.prepare('UPDATE tasks SET status = ?, due = ?, tone = ? WHERE id = ?').run(
    'Accepted',
    'Accepted',
    assignedTask.priority === 'Critical' ? 'danger' : assignedTask.priority === 'High' ? 'warning' : 'neutral',
    assignedTask.id
  );
  db.prepare('UPDATE workers SET status = ?, task = ?, zone = ?, workload = ? WHERE id = ?').run(
    'waiting',
    assignedTask.title,
    assignedTask.zone,
    assignedTask.workload || worker.workload,
    workerId
  );

  createManagerNotification({
    title: 'Assignment accepted',
    detail: `${worker.name} accepted ${assignedTask.title} in ${assignedTask.zone}.`,
    tone: 'success',
    targetLabel: 'View task',
    targetSection: 'tasks',
    targetWorkerId: worker.id
  });

  return getWorkerAppData(workerId);
}

export async function updateWorkerShiftStatus(workerId: string, status: WorkerActionStatus) {
  if (status === 'working') {
    const latestPpeCheck = getLatestPpeCheck(workerId);

    if (latestPpeCheck?.status !== 'PASSED') {
      throw new Error('PPE verification is required before starting task');
    }

    const worker = getRequiredWorker(workerId);
    const task = await getWorkerTask(worker, undefined, ['Accepted', 'Assigned']);

    if (!task) {
      throw new Error('Accept an assignment before starting work');
    }

    db.prepare('UPDATE tasks SET status = ?, due = ?, tone = ? WHERE id = ?').run(
      'In progress',
      'In progress',
      task.priority === 'Critical' ? 'danger' : 'warning',
      task.id
    );
  }

  if (status === 'waiting') {
    const worker = getRequiredWorker(workerId);
    const task = await getWorkerTask(worker, undefined, ['In progress']);

    if (task) {
      db.prepare('UPDATE tasks SET status = ?, due = ? WHERE id = ?').run('Accepted', 'Paused', task.id);
    }
  }

  db.prepare('UPDATE workers SET status = ? WHERE id = ?').run(status, workerId);
  return getWorkerAppData(workerId);
}

export async function performWorkerPpeCheck(workerId: string, imageDataUrl: string) {
  const worker = getRequiredWorker(workerId);
  const task = await getWorkerTask(worker);
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
    ...getWorkerAppData(workerId),
    ppeCheck: check
  };
}

export function completeWorkerAssignment(workerId: string) {
  const worker = getRequiredWorker(workerId);
  return completeWorkerAssignmentAsync(worker);
}

async function completeWorkerAssignmentAsync(worker: ReturnType<typeof getRequiredWorker>) {
  const activeTasks = (await getTasks()).filter((task) => task.owner === worker.name && !['Done', 'Review'].includes(task.status));

  db.prepare('UPDATE workers SET status = ?, time = ? WHERE id = ?').run('done', worker.time, worker.id);

  for (const task of activeTasks) {
    db.prepare('UPDATE tasks SET status = ?, due = ?, tone = ? WHERE id = ?').run('Review', 'Ready', 'success', task.id);
  }

  createManagerNotification({
    title: 'Task ready for review',
    detail: `${worker.name} completed ${activeTasks[0]?.title ?? worker.task}.`,
    tone: 'success',
    targetLabel: 'Review task',
    targetSection: 'tasks',
    targetWorkerId: worker.id
  });

  return getWorkerAppData(worker.id);
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
    return { ...(await getWorkerAppData(workerId)), action: { ok: true, fallback: true } };
  }

  const result = processIoTMessage(
    `${topicPrefix}/devices/${device.id}/events/rest-request`,
    JSON.stringify(makeEnvelope(device, 'REST_BUTTON_PRESSED', {
      buttonPressDurationMs: 800,
      reasonCode: 'WORKER_REQUEST',
      batteryPct: device.battery_pct ?? undefined
    }))
  );

  return { ...(await getWorkerAppData(workerId)), action: result };
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

    return { ...(await getWorkerAppData(workerId)), action: { ok: true, fallback: true, incidentId } };
  }

  const result = processIoTMessage(
    `${topicPrefix}/devices/${device.id}/events/sos`,
    JSON.stringify(makeEnvelope(device, 'SOS_BUTTON_PRESSED', {
      buttonPressDurationMs: 1500,
      batteryPct: device.battery_pct ?? undefined
    }))
  );

  return { ...(await getWorkerAppData(workerId)), action: result };
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

async function getWorkerTask(worker: ReturnType<typeof getRequiredWorker>, taskId?: string, statuses?: string[]) {
  const tasks = await getTasks();
  return tasks.find((task) => {
    const belongsToWorker = task.owner === worker.name;
    const matchesTask = !taskId || task.id === taskId;
    const matchesStatus = !statuses?.length || statuses.includes(task.status);
    return belongsToWorker && matchesTask && matchesStatus;
  });
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
      id, title, detail, tone, target_label, target_section, target_worker_id, read
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    `worker-action-${crypto.randomUUID()}`,
    input.title,
    input.detail,
    input.tone satisfies Tone,
    input.targetLabel,
    input.targetSection satisfies ManagerSection,
    input.targetWorkerId ?? null
  );
}
