import { notifications as fallbackNotifications, tasks as fallbackTasks, workers as fallbackWorkers } from '../constants/workforce';
import type { AuthUser, ManagerSection, UserRole } from '../types/navigation';
import type { IoTDevice, IncidentCenterData, IoTIncident, IoTOverview } from '../types/iot';
import type { Notification, SchedulerRecommendation, Task, Tone, Worker, WorkerStatus, WorkforceData } from '../types/workforce';
import { estimateCapacity, inferWorkload } from './capacityEstimator';
import { chronosUnavailableForecast, forecastProductivity } from './chronosForecasting';
import { db } from './database';
import { evaluateRisk, parseTopic, topicPrefix, validateEnvelope } from './iot';
import type { Envelope } from './iot';
import { getLatestPpeCheck, runPpeCheck } from './ppe';
import { recommendWorkers } from './workerAssignmentEngine';

const configuredSupabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseUrl = configuredSupabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseRestUrl = configuredSupabaseUrl.endsWith('/rest/v1') ? configuredSupabaseUrl : `${supabaseUrl}/rest/v1`;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseSchema = process.env.SUPABASE_SCHEMA ?? 'public';
const supabaseDataModel = process.env.SUPABASE_DATA_MODEL ?? 'workforce';
const supabaseRequestTimeoutMs = Math.max(1000, Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS ?? 3500));
const supabaseReadCache = new Map<string, unknown[]>();
const supabaseWarningTimes = new Map<string, number>();

const fallbackUsers = [
  { id: 'manager-demo', name: 'Project Manager', email: 'manager@gmail.com', role: 'manager' },
  { id: 'worker-demo', name: 'Budi Santoso', email: 'worker@gmail.com', role: 'worker' }
] satisfies AuthUser[];

type IoTTaskProof = {
  workerId: string;
  imageDataUrl: string;
  submittedAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  note?: string;
};

type IoTIncidentStateOverride = {
  state: string;
  escalationLevel?: number;
  updatedAt: string;
};

const iotTaskProofs = loadRuntimeStateMap<IoTTaskProof>('task-proof');
const iotRuntimeNotifications = loadRuntimeStateValues<Notification>('notification')
  .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
const iotIncidentStateOverrides = loadRuntimeStateMap<IoTIncidentStateOverride>('incident-state');
const iotRuntimeTasks = loadRuntimeStateMap<Task>('task');

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function shouldUseSupabase() {
  return process.env.DATA_SOURCE === 'supabase';
}

function shouldUseSupabaseIoTModel() {
  return supabaseDataModel === 'iot';
}

export function getDataSourceName() {
  return shouldUseSupabase() ? 'supabase' : 'sqlite';
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY are required when DATA_SOURCE=supabase');
  }
}

export async function getSupabaseUsers(): Promise<AuthUser[]> {
  if (shouldUseSupabaseIoTModel()) {
    return fallbackUsers;
  }

  const rows = await selectRows<SupabaseUserRow>('users', 'select=id,name,email,role&order=id.asc');
  return rows.map(({ role, ...row }) => ({ ...row, role: role as UserRole }));
}

export async function authenticateSupabaseUser(email: string, password: string): Promise<AuthUser | null> {
  if (shouldUseSupabaseIoTModel()) {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = normalizedEmail === 'manager@gmail.com'
      ? { user: fallbackUsers[0], password: 'mm' }
      : normalizedEmail === 'worker@gmail.com'
        ? { user: fallbackUsers[1], password: 'ww' }
        : null;

    return credential && password === credential.password ? credential.user : null;
  }

  const query = `select=id,name,email,role,password_hash&email=ilike.${encodeFilterValue(email.trim())}&limit=1`;
  const [row] = await selectRows<SupabaseUserRow & { password_hash: string }>('users', query);

  if (!row || row.password_hash !== hashPassword(password)) {
    return null;
  }

  const { password_hash: _passwordHash, role, ...user } = row;
  return { ...user, role: role as UserRole };
}

export async function getSupabaseWorkers(): Promise<Worker[]> {
  if (shouldUseSupabaseIoTModel()) {
    return (await getSupabaseIoTSnapshot()).workers;
  }

  const rows = await selectRows<SupabaseWorkerRow>('workers', 'select=*&order=id.asc');
  return rows.map(mapWorker);
}

export async function getSupabaseTasks(): Promise<Task[]> {
  if (shouldUseSupabaseIoTModel()) {
    return (await getSupabaseIoTSnapshot()).tasks;
  }

  const rows = await selectRows<SupabaseTaskRow>('tasks', 'select=*&order=id.asc');
  return rows.map(mapTask);
}

export async function getSupabaseNotifications(): Promise<Notification[]> {
  if (shouldUseSupabaseIoTModel()) {
    return (await getSupabaseIoTSnapshot()).notifications;
  }

  const rows = await selectRows<SupabaseNotificationRow>('notifications', 'select=*&order=created_at.desc.nullslast');
  return rows.map(mapNotification);
}

export async function getSupabaseWorkforceData(): Promise<WorkforceData> {
  if (shouldUseSupabaseIoTModel()) {
    const { workers, tasks, notifications } = await getSupabaseIoTSnapshot();
    return { workers, tasks, notifications };
  }

  const [workers, tasks, notifications] = await Promise.all([
    getSupabaseWorkers(),
    getSupabaseTasks(),
    getSupabaseNotifications()
  ]);

  return { workers, tasks, notifications };
}

export async function createSupabaseTask(input: CreateTaskInput): Promise<Task> {
  if (shouldUseSupabaseIoTModel()) {
    const snapshot = await getSupabaseIoTSnapshot();
    const task = await createSupabaseIoTStubTask(input, snapshot.workers);
    iotRuntimeTasks.set(task.id, task);
    persistRuntimeState('task', task.id, task);
    return task;
  }

  const [workers, environmentRows] = await Promise.all([
    getSupabaseWorkers(),
    selectRows<SupabaseEnvironmentRow>('environment_readings', `select=temperature_c,humidity_pct,recorded_at&zone_id=eq.${encodeFilterValue(input.zone)}&valid=eq.true&order=recorded_at.desc&limit=1`)
  ]);
  const environment = environmentRows[0] ?? null;
  const workload = inferWorkload(input.taskTemplate, input.quantity);
  const schedulerRecommendation = await makeSchedulerRecommendation({ ...input, workload }, workers, environment);
  const task: Task = {
    id: slugify(`${input.taskTemplate}-${Date.now()}`),
    title: input.taskTemplate.trim(),
    owner: input.owner?.trim() || 'Unassigned',
    location: input.zone.trim(),
    taskTemplate: input.taskTemplate.trim(),
    project: input.project.trim(),
    zone: input.zone.trim(),
    quantity: input.quantity,
    unit: input.unit.trim(),
    deadline: input.deadline.trim(),
    priority: input.priority,
    temperatureC: environment?.temperature_c ?? null,
    humidityPct: environment?.humidity_pct ?? null,
    workload,
    notes: input.notes?.trim() ?? '',
    schedulerRecommendation,
    status: 'Open',
    due: input.deadline.trim(),
    tone: input.priority === 'Critical' ? 'danger' : input.priority === 'High' ? 'warning' : 'neutral'
  };

  const [row] = await insertRows<SupabaseTaskRow>('tasks', [taskToRow(task)]);
  return mapTask(row);
}

export async function autoAssignSupabaseTask(taskId: string, workerId?: string): Promise<Task | null> {
  if (shouldUseSupabaseIoTModel()) {
    const snapshot = await getSupabaseIoTSnapshot();
    const task = snapshot.tasks.find((item) => item.id === taskId) ?? null;

    if (!task) {
      return null;
    }

    if (task.owner !== 'Unassigned') {
      return task;
    }

    const recommendedWorker = task.schedulerRecommendation.selectedWorkerRecommendations[0];
    const worker = workerId
      ? snapshot.workers.find((item) => item.id === workerId) ?? snapshot.workers[0]
      : recommendedWorker
        ? snapshot.workers.find((item) => item.id === recommendedWorker.workerId || item.name === recommendedWorker.workerName) ?? snapshot.workers[0]
        : snapshot.workers[0];
    const assignedTask = worker
      ? { ...task, owner: worker.name, status: 'Assigned', due: 'Waiting start', tone: 'success' as Tone }
      : task;

    if (iotRuntimeTasks.has(taskId)) {
      iotRuntimeTasks.set(taskId, assignedTask);
      persistRuntimeState('task', taskId, assignedTask);
    }

    addRuntimeNotification({
      id: `iot-task-assigned-${crypto.randomUUID()}`,
      title: 'New task assigned',
      detail: `${assignedTask.title} was assigned to ${assignedTask.owner} in ${assignedTask.zone}.`,
      tone: 'neutral',
      targetLabel: 'Open task',
      targetSection: 'tasks',
      targetWorkerId: worker?.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return assignedTask;
  }

  const [row] = await selectRows<SupabaseTaskRow>('tasks', `select=*&id=eq.${encodeFilterValue(taskId)}&limit=1`);

  if (!row) return null;

  const task = mapTask(row);

  if (task.owner !== 'Unassigned') {
    return task;
  }

  const allWorkers = await getSupabaseWorkers();
  const rankedWorker = workerId
    ? task.schedulerRecommendation.selectedWorkerRecommendations.find((worker) => worker.workerId === workerId)
    : task.schedulerRecommendation.selectedWorkerRecommendations[0];
  const selectedWorker = workerId
    ? allWorkers.find((worker) => worker.id === workerId)
    : rankedWorker
      ? allWorkers.find((worker) => worker.id === rankedWorker.workerId || worker.name === rankedWorker.workerName)
      : null;
  const bestWorker = rankedWorker ?? (selectedWorker ? {
    workerId: selectedWorker.id,
    workerName: selectedWorker.name,
    explanation: 'Manager selected this worker from the assignment ranking.'
  } : null);

  if (!bestWorker || !selectedWorker) {
    throw new Error('No eligible worker is available for automatic assignment');
  }

  const [updatedRows] = await Promise.all([
    patchRows<SupabaseTaskRow>('tasks', `id=eq.${encodeFilterValue(taskId)}`, { owner: bestWorker.workerName, status: 'Assigned' }),
    patchRows('workers', `id=eq.${encodeFilterValue(bestWorker.workerId)}`, {
      task: task.title,
      status: 'waiting',
      zone: task.zone,
      workload: task.workload
    }),
    patchRows('iot_devices', `assigned_worker_id=eq.${encodeFilterValue(bestWorker.workerId)}`, {
      assigned_task_id: task.id,
      assigned_zone_id: task.zone,
      updated_at: new Date().toISOString()
    })
  ]);

  await createSupabaseNotification({
    title: 'New task assigned',
    detail: `${task.title} was assigned in ${task.zone}. Complete PPE verification before starting.`,
    tone: 'neutral',
    targetLabel: 'Open task',
    targetSection: 'tasks',
    targetWorkerId: bestWorker.workerId
  });

  return updatedRows[0] ? mapTask(updatedRows[0]) : null;
}

export async function markSupabaseNotificationRead(notificationId: string): Promise<Notification | null> {
  if (shouldUseSupabaseIoTModel()) {
    const runtimeNotification = iotRuntimeNotifications.find((item) => item.id === notificationId);

    if (runtimeNotification) {
      runtimeNotification.read = true;
      persistRuntimeState('notification', runtimeNotification.id, runtimeNotification);
      return { ...runtimeNotification };
    }

    const notification = (await getSupabaseIoTSnapshot()).notifications.find((item) => item.id === notificationId);
    return notification ? { ...notification, read: true } : null;
  }

  const rows = await patchRows<SupabaseNotificationRow>('notifications', `id=eq.${encodeFilterValue(notificationId)}`, { read: true });
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function getSupabaseIoTOverview(): Promise<IoTOverview> {
  if (shouldUseSupabaseIoTModel()) {
    const snapshot = await getSupabaseIoTSnapshot();
    return {
      devices: snapshot.devices,
      activeIncidents: snapshot.activeIncidents,
      restRequests: snapshot.restRequests,
      commands: [],
      latestFatigue: snapshot.latestFatigue,
      latestRisk: snapshot.latestRisk
    };
  }

  const [deviceRows, incidentRows, restRequests, commands, latestRisk] = await Promise.all([
    selectRows<SupabaseDeviceRow>('iot_devices', 'select=*&order=updated_at.desc'),
    selectRows<SupabaseIncidentRow>('emergency_incidents', 'select=*&state=in.(OPEN,ACKNOWLEDGED,ESCALATED)&order=opened_at.desc'),
    selectRows<any>('rest_requests', 'select=*&order=requested_at.desc&limit=20'),
    selectRows<any>('device_commands', 'select=*&order=issued_at.desc&limit=20'),
    selectRows<any>('risk_evaluations', 'select=*&order=evaluated_at.desc&limit=20')
  ]);

  return {
    devices: deviceRows.map(mapDevice),
    activeIncidents: incidentRows.map(mapIncident),
    restRequests,
    commands,
    latestRisk
  };
}

export async function listSupabaseDevices(): Promise<IoTDevice[]> {
  if (shouldUseSupabaseIoTModel()) {
    return (await getSupabaseIoTSnapshot()).devices;
  }

  const rows = await selectRows<SupabaseDeviceRow>('iot_devices', 'select=*&order=updated_at.desc');
  return rows.map(mapDevice);
}

export async function getSupabaseIncidentCenter(): Promise<IncidentCenterData> {
  if (shouldUseSupabaseIoTModel()) {
    const snapshot = await getSupabaseIoTSnapshot();
    return {
      activeIncidents: snapshot.activeIncidents,
      incidentHistory: snapshot.incidentHistory,
      nearMissReports: snapshot.nearMissReports
    };
  }

  const [activeRows, historyRows, nearMissRows] = await Promise.all([
    selectRows<SupabaseIncidentRow>('emergency_incidents', 'select=*&state=in.(OPEN,ACKNOWLEDGED,ESCALATED)&order=opened_at.desc'),
    selectRows<SupabaseIncidentRow>('emergency_incidents', 'select=*&order=opened_at.desc&limit=50'),
    selectRows<any>('motion_telemetry_summaries', 'select=*&order=window_end.desc&limit=50')
  ]);

  return {
    activeIncidents: activeRows.map(mapIncident),
    incidentHistory: historyRows.map(mapIncident),
    nearMissReports: nearMissRows
      .filter((row) => Boolean(row.impact_detected) || Boolean(row.fall_candidate))
      .map((row) => ({
        ...row,
        impact_detected: Number(Boolean(row.impact_detected)),
        fall_candidate: Number(Boolean(row.fall_candidate))
      }))
  };
}

export async function updateSupabaseIncidentState(incidentId: string, state: string): Promise<IoTIncident | null> {
  if (shouldUseSupabaseIoTModel()) {
    const snapshot = await getSupabaseIoTSnapshot();
    const incident = snapshot.incidentHistory.find((item) => item.id === incidentId) ?? snapshot.activeIncidents.find((item) => item.id === incidentId) ?? null;

    if (!incident) {
      return null;
    }

    const override = {
      state,
      escalationLevel: state === 'ESCALATED' ? Math.max(incident.escalation_level + 1, 2) : incident.escalation_level,
      updatedAt: new Date().toISOString()
    };
    iotIncidentStateOverrides.set(incidentId, override);
    persistRuntimeState('incident-state', incidentId, override);

    return applyIoTIncidentStateOverride(incident);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { state };

  if (state === 'ACKNOWLEDGED') {
    updates.acknowledged_at = now;
  }

  if (state === 'RESOLVED' || state === 'FALSE_ALARM') {
    updates.resolved_at = now;
  }

  if (state === 'ESCALATED') {
    updates.escalation_level = 2;
  }

  const rows = await patchRows<SupabaseIncidentRow>('emergency_incidents', `id=eq.${encodeFilterValue(incidentId)}`, updates);
  return rows[0] ? mapIncident(rows[0]) : null;
}

export async function getSupabaseWorkerAppData(workerId: string) {
  if (shouldUseSupabaseIoTModel()) {
    return getSupabaseIoTWorkerAppData(workerId);
  }

  const [worker] = await selectRows<SupabaseWorkerRow>('workers', `select=*&id=eq.${encodeFilterValue(workerId)}&limit=1`);
  const mappedWorker = worker ? mapWorker(worker) : null;
  const [taskRows, notificationRows, breakRows, riskRows, incidentRows] = await Promise.all([
    mappedWorker ? selectRows<SupabaseTaskRow>('tasks', `select=*&owner=eq.${encodeFilterValue(mappedWorker.name)}&order=id.asc`) : Promise.resolve([]),
    selectRows<SupabaseNotificationRow>('notifications', `select=*&target_worker_id=eq.${encodeFilterValue(workerId)}&order=created_at.desc`),
    selectRows<any>('break_sessions', `select=*&worker_id=eq.${encodeFilterValue(workerId)}&status=eq.BREAK_ACTIVE&order=started_at.desc&limit=1`),
    selectRows<any>('risk_evaluations', `select=*&worker_id=eq.${encodeFilterValue(workerId)}&order=evaluated_at.desc&limit=1`),
    selectRows<SupabaseIncidentRow>('emergency_incidents', `select=*&worker_id=eq.${encodeFilterValue(workerId)}&state=neq.RESOLVED&order=opened_at.desc&limit=1`)
  ]);

  return {
    worker: mappedWorker,
    tasks: taskRows.map(mapTask),
    notifications: notificationRows.map(mapNotification),
    currentBreak: breakRows[0] ?? null,
    latestRisk: riskRows[0] ?? null,
    activeIncident: incidentRows[0] ? mapIncident(incidentRows[0]) : null,
    latestPpeCheck: getLatestPpeCheck(workerId)
  };
}

export async function updateSupabaseWorkerShiftStatus(workerId: string, status: 'waiting' | 'working' | 'break' | 'done') {
  if (status === 'working') {
    const latestPpeCheck = getLatestPpeCheck(workerId);

    if (latestPpeCheck?.status !== 'PASSED') {
      throw new Error('PPE verification is required before starting task');
    }
  }

  if (shouldUseSupabaseIoTModel()) {
    const data = await getSupabaseIoTWorkerAppData(workerId);
    return {
      ...data,
      worker: data.worker ? { ...data.worker, status } : data.worker,
      action: { ok: true, fallback: true }
    };
  }

  await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status });

  if (status === 'working') {
    const data = await getSupabaseWorkerAppData(workerId);

    if (data.worker) {
      await patchRows('tasks', `owner=eq.${encodeFilterValue(data.worker.name)}&status=neq.Review`, { status: 'In Progress' });
      await createSupabaseNotification({
        title: 'Task started',
        detail: `${data.worker.name} started ${data.worker.task} in ${data.worker.zone}.`,
        tone: 'success',
        targetLabel: 'View task',
        targetSection: 'tasks',
        targetWorkerId: workerId
      });
    }
  }

  return getSupabaseWorkerAppData(workerId);
}

export async function performSupabaseWorkerPpeCheck(workerId: string, imageDataUrl: string) {
  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  const check = await runPpeCheck({
    workerId,
    taskId: data.tasks[0]?.id ?? null,
    imageDataUrl
  });
  const nextData = await getSupabaseWorkerAppData(workerId);

  return {
    ...nextData,
    latestPpeCheck: check,
    ppeCheck: check
  };
}

export async function completeSupabaseWorkerAssignment(workerId: string, imageDataUrl: string) {
  if (!isImageDataUrl(imageDataUrl)) {
    throw new Error('Completion proof photo is required');
  }

  if (shouldUseSupabaseIoTModel()) {
    const submittedAt = new Date().toISOString();
    const data = await getSupabaseIoTWorkerAppData(workerId);
    const workerName = data.worker?.name;
    const task = data.tasks.find((item) => item.owner === workerName && !['Done', 'Review'].includes(item.status))
      ?? data.tasks.find((item) => item.id === 'iot-live-shift')
      ?? data.tasks[0];

    if (!task) {
      throw new Error('No active task is available for completion proof');
    }

    const proof = {
      workerId,
      imageDataUrl,
      submittedAt,
      status: 'PENDING' as const
    };
    iotTaskProofs.set(task.id, proof);
    persistRuntimeState('task-proof', task.id, proof);
    addRuntimeNotification({
      id: `iot-task-proof-${crypto.randomUUID()}`,
      title: 'Task proof ready',
      detail: `${workerName ?? 'Worker'} submitted a completion photo for ${task.title}.`,
      tone: 'success',
      targetLabel: 'Review proof',
      targetSection: 'tasks',
      targetWorkerId: workerId,
      createdAt: submittedAt,
      read: false
    });

    const nextData = await getSupabaseIoTWorkerAppData(workerId);
    return {
      ...nextData,
      worker: nextData.worker ? { ...nextData.worker, status: 'done' as const } : nextData.worker,
      action: { ok: true, fallback: true, proofSubmitted: true }
    };
  }

  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status: 'done' });
  await patchRows('tasks', `owner=eq.${encodeFilterValue(data.worker.name)}`, {
    status: 'Review',
    due: 'Proof ready',
    tone: 'success',
    completion_proof_image: imageDataUrl,
    completion_proof_submitted_at: new Date().toISOString(),
    completion_proof_status: 'PENDING',
    completion_proof_note: null
  });
  await createSupabaseNotification({
    title: 'Task proof ready',
    detail: `${data.worker.name} submitted a completion photo for ${data.tasks[0]?.title ?? data.worker.task}.`,
    tone: 'success',
    targetLabel: 'Review proof',
    targetSection: 'tasks',
    targetWorkerId: workerId
  });

  return getSupabaseWorkerAppData(workerId);
}

export async function reviewSupabaseTaskCompletion(taskId: string, decision: 'accept' | 'reject', note?: string): Promise<Task | null> {
  if (shouldUseSupabaseIoTModel()) {
    const proof = iotTaskProofs.get(taskId);
    const snapshot = await getSupabaseIoTSnapshot();
    const task = snapshot.tasks.find((item) => item.id === taskId) ?? null;
    const worker = snapshot.workers.find((item) => item.id === proof?.workerId) ?? snapshot.workers[0] ?? null;

    if (!task || !proof) {
      return task;
    }

    proof.status = decision === 'accept' ? 'ACCEPTED' : 'REJECTED';
    proof.note = note?.trim() || (decision === 'accept' ? 'Accepted by manager' : 'Please submit a clearer completion photo.');
    iotTaskProofs.set(taskId, proof);
    persistRuntimeState('task-proof', taskId, proof);
    addRuntimeNotification({
      id: `iot-task-review-${crypto.randomUUID()}`,
      title: decision === 'accept' ? 'Completion accepted' : 'Completion needs revision',
      detail: decision === 'accept'
        ? `${task.title} was accepted by manager.`
        : `${task.title} was rejected. ${proof.note}`,
      tone: decision === 'accept' ? 'success' : 'warning',
      targetLabel: 'Open task',
      targetSection: 'tasks',
      targetWorkerId: worker?.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return applyIoTTaskProofs([task])[0] ?? task;
  }

  const [row] = await selectRows<SupabaseTaskRow>('tasks', `select=*&id=eq.${encodeFilterValue(taskId)}&limit=1`);

  if (!row) return null;

  const task = mapTask(row);
  const workerRows = await selectRows<SupabaseWorkerRow>('workers', `select=*&name=eq.${encodeFilterValue(task.owner)}&limit=1`);
  const worker = workerRows[0] ? mapWorker(workerRows[0]) : null;
  const status = decision === 'accept' ? 'Done' : 'In Progress';
  const reviewNote = note?.trim() || (decision === 'accept' ? 'Accepted by manager' : 'Please submit a clearer completion photo.');
  const [updated] = await patchRows<SupabaseTaskRow>('tasks', `id=eq.${encodeFilterValue(taskId)}`, {
    status,
    due: decision === 'accept' ? 'Done' : 'Needs revision',
    tone: decision === 'accept' ? 'success' : 'warning',
    completion_proof_status: decision === 'accept' ? 'ACCEPTED' : 'REJECTED',
    completion_proof_note: reviewNote
  });

  if (worker) {
    await patchRows('workers', `id=eq.${encodeFilterValue(worker.id)}`, { status: decision === 'accept' ? 'done' : 'working' });
    await createSupabaseNotification({
      title: decision === 'accept' ? 'Completion accepted' : 'Completion needs revision',
      detail: decision === 'accept' ? `${task.title} was accepted by manager.` : `${task.title} was rejected. ${reviewNote}`,
      tone: decision === 'accept' ? 'success' : 'warning',
      targetLabel: 'Open task',
      targetSection: 'tasks',
      targetWorkerId: worker.id
    });
  }

  return updated ? mapTask(updated) : null;
}

export async function reportSupabaseWorkerHazard(workerId: string, input: { hazardType?: string; note?: string }) {
  if (shouldUseSupabaseIoTModel()) {
    return {
      ...(await getSupabaseIoTWorkerAppData(workerId)),
      action: { ok: true, fallback: true, hazardType: input.hazardType ?? 'Hazard' }
    };
  }

  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  const hazardType = input.hazardType?.trim() || 'Hazard';
  const note = input.note?.trim();
  await createSupabaseNotification({
    title: 'Hazard reported',
    detail: `${data.worker.name} reported ${hazardType} in ${data.worker.zone}${note ? `: ${note}` : '.'}`,
    tone: 'warning',
    targetLabel: 'View worker',
    targetSection: 'workers',
    targetWorkerId: workerId
  });

  return getSupabaseWorkerAppData(workerId);
}

export async function getSupabaseWorkerRestRecommendation(workerId: string) {
  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  const baseMinutes = data.worker.fatigue >= 75 ? 20 : data.worker.fatigue >= 55 ? 15 : data.worker.fatigue >= 35 ? 10 : 5;
  const chronos = await forecastProductivity({
    historicalCompletedQuantity: [2, 3, 4, 4],
    workerHours: [2, 2.5, 3, Math.max(1, parseWorkerTimeMinutes(data.worker.time) / 60)],
    breakMinutes: [5, 10, baseMinutes, baseMinutes],
    activeWorkers: [3, 3, 2, data.worker.status === 'working' ? 1 : 0],
    predictionLength: 3
  }).catch((error) => chronosUnavailableForecast(error instanceof Error ? error.message : 'Chronos unavailable'));
  const recommendedMinutes = Math.min(30, Math.max(5, baseMinutes + (chronos.modelStatus === 'READY' && chronos.suggestedAdditionalCrew > 0 ? 5 : 0)));

  return {
    workerId,
    recommendedMinutes,
    fatigueScore: data.worker.fatigue,
    fatigueLevel: data.worker.fatigue >= 85 ? 'CRITICAL' : data.worker.fatigue >= 65 ? 'HIGH' : data.worker.fatigue >= 40 ? 'MEDIUM' : 'LOW',
    chronosStatus: chronos.modelStatus,
    reason: chronos.modelStatus === 'READY'
      ? `Fatigue score recommends ${baseMinutes} min; Chronos context ${chronos.suggestedAdditionalCrew > 0 ? 'adds recovery buffer for productivity risk' : 'keeps standard recovery'}.`
      : `Fatigue score recommends ${baseMinutes} min. Chronos unavailable, so safety fallback is used.`
  };
}

export async function grantSupabaseWorkerRest(workerId: string, minutes?: number) {
  if (shouldUseSupabaseIoTModel()) {
    const recommendation = await getSupabaseWorkerRestRecommendation(workerId);
    return {
      ...(await getSupabaseIoTWorkerAppData(workerId)),
      recommendation: {
        ...recommendation,
        recommendedMinutes: Math.max(5, Math.min(60, Math.round(minutes ?? recommendation.recommendedMinutes)))
      },
      action: { ok: true, fallback: true }
    };
  }

  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  const recommendation = await getSupabaseWorkerRestRecommendation(workerId);
  const plannedMinutes = Math.max(5, Math.min(60, Math.round(minutes ?? recommendation.recommendedMinutes)));
  const device = await getSupabaseDeviceForWorker(workerId);
  const now = new Date();
  const endsAt = new Date(now.getTime() + plannedMinutes * 60_000);
  const breakSessionId = crypto.randomUUID();

  await insertRows('break_sessions', [{
    id: breakSessionId,
    worker_id: workerId,
    task_id: data.tasks[0]?.id ?? null,
    device_id: device?.id ?? `worker-app-${workerId}`,
    source: 'MANAGER_ASSIGNED_REST',
    status: 'BREAK_ACTIVE',
    planned_minutes: plannedMinutes,
    started_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    completed_at: null,
    risk_evaluation_id: null
  }]);
  await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status: 'break' });

  if (data.tasks[0]) {
    await patchRows('tasks', `id=eq.${encodeFilterValue(data.tasks[0].id)}`, {
      status: 'Paused for rest',
      due: `${plannedMinutes}m rest`
    });
  }

  await createSupabaseNotification({
    title: 'Rest assigned',
    detail: `Manager assigned ${plannedMinutes} minutes of rest. Return around ${formatTime(endsAt)}.`,
    tone: 'warning',
    targetLabel: 'View rest',
    targetSection: 'workers',
    targetWorkerId: workerId
  });

  return {
    ...(await getSupabaseWorkerAppData(workerId)),
    recommendation: {
      ...recommendation,
      recommendedMinutes: plannedMinutes
    },
    breakSessionId
  };
}

export async function requestSupabaseWorkerRest(workerId: string) {
  if (shouldUseSupabaseIoTModel()) {
    return { ...(await getSupabaseIoTWorkerAppData(workerId)), action: { ok: true, fallback: true } };
  }

  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  const device = await getSupabaseDeviceForWorker(workerId);

  if (!device) {
    await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status: 'break' });
    await createSupabaseNotification({
      title: 'Rest requested',
      detail: `${data.worker.name} requested a break from ${data.worker.zone}.`,
      tone: 'warning',
      targetLabel: 'Open worker',
      targetSection: 'workers',
      targetWorkerId: workerId
    });
    return { ...(await getSupabaseWorkerAppData(workerId)), action: { ok: true, fallback: true } };
  }

  const result = await ingestSupabaseIoTMessage(
    `${topicPrefix}/devices/${device.id}/events/rest-request`,
    JSON.stringify(makeSupabaseEnvelope(device, 'REST_BUTTON_PRESSED', {
      buttonPressDurationMs: 800,
      reasonCode: 'WORKER_REQUEST',
      batteryPct: device.battery_pct ?? undefined
    }))
  );

  return { ...(await getSupabaseWorkerAppData(workerId)), action: result };
}

export async function triggerSupabaseWorkerSos(workerId: string) {
  if (shouldUseSupabaseIoTModel()) {
    return { ...(await getSupabaseIoTWorkerAppData(workerId)), action: { ok: true, fallback: true, eventType: 'SOS' } };
  }

  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  const device = await getSupabaseDeviceForWorker(workerId);

  if (!device) {
    const incidentId = `incident-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await insertRows('emergency_incidents', [{
      id: incidentId,
      worker_id: workerId,
      task_id: null,
      zone_id: data.worker.zone,
      state: 'OPEN',
      trigger_source: 'WORKER_APP_SOS',
      device_id: `worker-app-${workerId}`,
      trigger_message_id: `worker-app-${incidentId}`,
      opened_at: now,
      acknowledged_at: null,
      resolved_at: null,
      last_known_environment: null,
      last_known_motion: null,
      escalation_level: 1
    }]);
    await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status: 'emergency' });
    await createSupabaseNotification({
      title: 'SOS open',
      detail: `${data.worker.name} triggered SOS from the worker app in ${data.worker.zone}.`,
      tone: 'danger',
      targetLabel: 'Open incident',
      targetSection: 'incidents',
      targetWorkerId: workerId
    });
    return { ...(await getSupabaseWorkerAppData(workerId)), action: { ok: true, fallback: true, incidentId } };
  }

  const result = await ingestSupabaseIoTMessage(
    `${topicPrefix}/devices/${device.id}/events/sos`,
    JSON.stringify(makeSupabaseEnvelope(device, 'SOS_BUTTON_PRESSED', {
      buttonPressDurationMs: 1500,
      batteryPct: device.battery_pct ?? undefined
    }))
  );

  return { ...(await getSupabaseWorkerAppData(workerId)), action: result };
}

export async function ingestSupabaseIoTMessage(topic: string, rawPayload: string) {
  assertSupabaseConfigured();

  const receivedAt = new Date().toISOString();
  const parsedTopic = parseTopic(topic);

  if (!parsedTopic) {
    return { ok: false, status: 400, error: 'Unsupported MQTT topic' };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawPayload);
  } catch {
    return { ok: false, status: 400, error: 'Message payload is not valid JSON' };
  }

  const validation = validateEnvelope(decoded, parsedTopic.deviceId);

  if (!validation.ok) {
    await insertRows('raw_iot_messages', [{
      id: crypto.randomUUID(),
      message_id: `invalid-${crypto.randomUUID()}`,
      device_id: parsedTopic.deviceId,
      topic,
      raw_payload: decoded,
      received_at: receivedAt,
      processing_status: 'REJECTED',
      processing_error: validation.error
    }]);

    return { ok: false, status: 400, error: validation.error };
  }

  const envelope = validation.envelope;
  await upsertRows('iot_devices', [{
    id: envelope.deviceId,
    mqtt_client_id: envelope.deviceId,
    name: `${envelope.deviceId} Wearable`,
    device_type: 'WEARABLE',
    status: envelope.eventType === 'CONNECTION_STATUS' && envelope.payload.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
    firmware_version: envelope.firmwareVersion ?? null,
    assigned_worker_id: envelope.workerId ?? null,
    assigned_site_id: envelope.siteId ?? null,
    assigned_zone_id: envelope.zoneId ?? null,
    assigned_task_id: envelope.taskId ?? null,
    last_seen_at: receivedAt,
    battery_pct: numberOrNull(envelope.payload.batteryPct),
    signal_strength: numberOrNull(envelope.payload.signalStrength),
    created_at: receivedAt,
    updated_at: receivedAt
  }], 'id');

  await upsertRows('raw_iot_messages', [{
    id: crypto.randomUUID(),
    message_id: envelope.messageId,
    device_id: envelope.deviceId,
    topic,
    schema_version: envelope.schemaVersion,
    event_type: envelope.eventType,
    raw_payload: decoded,
    recorded_at: envelope.recordedAt,
    received_at: receivedAt,
    processing_status: 'PROCESSED',
    processing_error: null
  }], 'message_id');

  if (envelope.eventType === 'ENVIRONMENT_TELEMETRY') {
    await persistSupabaseEnvironmentReading(envelope, receivedAt);
  }

  if (envelope.eventType === 'MOTION_TELEMETRY') {
    await persistSupabaseMotionSummary(envelope, receivedAt);
  }

  if (envelope.eventType === 'SOS_BUTTON_PRESSED') {
    await persistSupabaseIncident(envelope, receivedAt);
  }

  if (envelope.eventType === 'REST_BUTTON_PRESSED') {
    await persistSupabaseRestRequest(envelope, receivedAt);
  }

  if (envelope.eventType === 'COMMAND_ACK' || envelope.eventType === 'COMMAND_RESULT') {
    await updateSupabaseCommandFromDevice(envelope);
  }

  await persistSupabaseRiskEvaluation(envelope, receivedAt);

  return { ok: true, status: 202, messageId: envelope.messageId };
}

async function persistSupabaseEnvironmentReading(envelope: SupabaseEnvelope, receivedAt: string) {
  await insertRows('environment_readings', [{
    id: crypto.randomUUID(),
    device_id: envelope.deviceId,
    site_id: envelope.siteId ?? null,
    zone_id: envelope.zoneId ?? null,
    temperature_c: numberOrNull(envelope.payload.temperatureC),
    humidity_pct: numberOrNull(envelope.payload.humidityPct),
    weather: stringOrNull(envelope.payload.weather),
    surface_condition: stringOrNull(envelope.payload.surfaceCondition),
    crane_active: Boolean(envelope.payload.craneActive),
    restricted_zone_detected: Boolean(envelope.payload.restrictedZoneDetected),
    battery_pct: numberOrNull(envelope.payload.batteryPct),
    signal_strength: numberOrNull(envelope.payload.signalStrength),
    recorded_at: envelope.recordedAt,
    received_at: receivedAt,
    valid: true,
    validation_error: null,
    data_source: 'supabase-http'
  }]);
}

async function persistSupabaseMotionSummary(envelope: SupabaseEnvelope, receivedAt: string) {
  await insertRows('motion_telemetry_summaries', [{
    id: crypto.randomUUID(),
    device_id: envelope.deviceId,
    worker_id: envelope.workerId ?? null,
    task_id: envelope.taskId ?? null,
    zone_id: envelope.zoneId ?? null,
    window_start: envelope.recordedAt,
    window_end: envelope.recordedAt,
    maximum_acceleration_g: numberOrNull(envelope.payload.peakAccelerationG) ?? 0,
    average_tilt_degrees: numberOrNull(envelope.payload.tiltDegrees) ?? 0,
    maximum_tilt_change_degrees: numberOrNull(envelope.payload.tiltChangeDegrees) ?? 0,
    movement_state: stringOrNull(envelope.payload.movementState) ?? 'UNKNOWN',
    inactive_seconds: numberOrNull(envelope.payload.inactiveSeconds) ?? 0,
    impact_detected: Boolean(envelope.payload.impactDetected),
    fall_candidate: Boolean(envelope.payload.fallCandidate),
    sample_count: 1
  }]);
}

async function persistSupabaseIncident(envelope: SupabaseEnvelope, receivedAt: string) {
  const incidentId = `incident-${envelope.messageId}`;
  await upsertRows('emergency_incidents', [{
    id: incidentId,
    worker_id: envelope.workerId ?? 'unknown-worker',
    task_id: envelope.taskId ?? null,
    zone_id: envelope.zoneId ?? null,
    state: 'OPEN',
    trigger_source: envelope.eventType,
    device_id: envelope.deviceId,
    trigger_message_id: envelope.messageId,
    opened_at: receivedAt,
    acknowledged_at: null,
    resolved_at: null,
    last_known_environment: null,
    last_known_motion: envelope.payload,
    escalation_level: 1
  }], 'trigger_message_id');

  await createSupabaseNotification({
    title: 'SOS incident opened',
    detail: `${envelope.workerId ?? 'Unknown worker'} triggered SOS from ${envelope.zoneId ?? 'unknown zone'}.`,
    tone: 'danger',
    targetLabel: 'Open incident',
    targetSection: 'incidents',
    targetWorkerId: envelope.workerId ?? undefined
  });
}

async function persistSupabaseRestRequest(envelope: SupabaseEnvelope, receivedAt: string) {
  const risk = evaluateRisk({
    restrictedZoneDetected: Boolean(envelope.payload.restrictedZoneDetected)
  });

  await insertRows('rest_requests', [{
    id: `rest-${envelope.messageId}`,
    worker_id: envelope.workerId ?? 'unknown-worker',
    device_id: envelope.deviceId,
    task_id: envelope.taskId ?? null,
    zone_id: envelope.zoneId ?? null,
    source: 'WEARABLE_BUTTON',
    status: 'PENDING',
    requested_at: receivedAt,
    risk_score_at_request: risk.riskScore,
    environment_snapshot: null,
    sensor_snapshot: envelope.payload,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    break_session_id: null
  }]);

  await createSupabaseNotification({
    title: 'Rest request pending',
    detail: `${envelope.workerId ?? 'Unknown worker'} requested a break from ${envelope.zoneId ?? 'unknown zone'}.`,
    tone: 'warning',
    targetLabel: 'Review rest request',
    targetSection: 'iot',
    targetWorkerId: envelope.workerId ?? undefined
  });
}

async function persistSupabaseRiskEvaluation(envelope: SupabaseEnvelope, receivedAt: string) {
  if (!envelope.workerId || !['ENVIRONMENT_TELEMETRY', 'MOTION_TELEMETRY', 'SOS_BUTTON_PRESSED'].includes(envelope.eventType)) {
    return;
  }

  const risk = evaluateRisk({
    temperatureC: numberOrNull(envelope.payload.temperatureC),
    humidityPct: numberOrNull(envelope.payload.humidityPct),
    surfaceCondition: stringOrNull(envelope.payload.surfaceCondition),
    movementState: stringOrNull(envelope.payload.movementState),
    restrictedZoneDetected: Boolean(envelope.payload.restrictedZoneDetected),
    currentEmergency: envelope.eventType === 'SOS_BUTTON_PRESSED' || Boolean(envelope.payload.fallCandidate)
  });

  await insertRows('risk_evaluations', [{
    id: crypto.randomUUID(),
    worker_id: envelope.workerId,
    device_id: envelope.deviceId,
    task_id: envelope.taskId ?? null,
    zone_id: envelope.zoneId ?? null,
    risk_score: risk.riskScore,
    risk_level: risk.riskLevel,
    intervention: risk.intervention,
    break_minutes: risk.breakMinutes,
    reasons: JSON.stringify(risk.reasons),
    policy_version: risk.policyVersion,
    evaluated_at: receivedAt
  }]);

  if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
    await createSupabaseNotification({
      title: `${risk.riskLevel.toLowerCase()} risk detected`,
      detail: `${envelope.workerId} scored ${risk.riskScore}: ${risk.reasons.join(', ')}.`,
      tone: risk.riskLevel === 'CRITICAL' ? 'danger' : 'warning',
      targetLabel: 'Open IoT panel',
      targetSection: 'iot',
      targetWorkerId: envelope.workerId
    });
  }
}

async function updateSupabaseCommandFromDevice(envelope: SupabaseEnvelope) {
  const commandId = stringOrNull(envelope.payload.commandId);

  if (!commandId) {
    return;
  }

  if (envelope.eventType === 'COMMAND_ACK') {
    await patchRows('device_commands', `command_id=eq.${encodeFilterValue(commandId)}`, {
      status: envelope.payload.accepted === false ? 'FAILED' : 'ACKNOWLEDGED',
      acknowledged_at: envelope.recordedAt,
      failure_reason: envelope.payload.accepted === false ? stringOrNull(envelope.payload.reason) : null
    });
  }

  if (envelope.eventType === 'COMMAND_RESULT') {
    await patchRows('device_commands', `command_id=eq.${encodeFilterValue(commandId)}`, {
      status: envelope.payload.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      executed_at: stringOrNull(envelope.payload.executedAt),
      completed_at: stringOrNull(envelope.payload.completedAt) ?? envelope.recordedAt,
      failure_reason: stringOrNull(envelope.payload.errorMessage)
    });
  }
}

async function createSupabaseNotification(input: Omit<Notification, 'id' | 'read'>) {
  await insertRows('notifications', [{
    id: `notif-${crypto.randomUUID()}`,
    title: input.title,
    detail: input.detail,
    tone: input.tone,
    target_label: input.targetLabel,
    target_section: input.targetSection,
    target_worker_id: input.targetWorkerId ?? null,
    created_at: input.createdAt ?? new Date().toISOString(),
    read: false
  }]);
}

async function getSupabaseDeviceForWorker(workerId: string) {
  const [device] = await selectRows<SupabaseDeviceRow>('iot_devices', `select=*&assigned_worker_id=eq.${encodeFilterValue(workerId)}&limit=1`);
  return device ?? null;
}

async function getSupabaseIoTWorkerAppData(workerId: string) {
  const snapshot = await getSupabaseIoTSnapshot();
  const worker = snapshot.workers.find((item) => item.id === workerId) ?? snapshot.workers[0] ?? null;

  return {
    worker,
    tasks: worker ? snapshot.tasks.filter((task) => task.owner === worker.name || task.owner === 'Unassigned') : snapshot.tasks,
    notifications: snapshot.notifications.filter((notification) => !notification.targetWorkerId || notification.targetWorkerId === workerId),
    currentBreak: snapshot.restBreaks[0] ? {
      id: `iot-rest-${snapshot.restBreaks[0].id}`,
      status: snapshot.restBreaks[0].status ?? 'PENDING',
      plannedMinutes: Math.max(5, Math.round((snapshot.restBreaks[0].work_duration_before_break ?? 0) / 60)),
      startedAt: snapshot.restBreaks[0].created_at,
      endsAt: null
    } : null,
    latestRisk: snapshot.latestRisk[0] ?? null,
    activeIncident: snapshot.activeIncidents[0] ?? null,
    latestPpeCheck: getLatestPpeCheck(workerId)
  };
}

type SupabaseIoTSnapshot = Awaited<ReturnType<typeof loadSupabaseIoTSnapshot>>;

let cachedIoTSnapshot: { value: SupabaseIoTSnapshot; expiresAt: number } | null = null;
let pendingIoTSnapshot: Promise<SupabaseIoTSnapshot> | null = null;

async function getSupabaseIoTSnapshot(): Promise<SupabaseIoTSnapshot> {
  if (cachedIoTSnapshot && cachedIoTSnapshot.expiresAt > Date.now()) {
    return cachedIoTSnapshot.value;
  }

  if (pendingIoTSnapshot) {
    return pendingIoTSnapshot;
  }

  pendingIoTSnapshot = loadSupabaseIoTSnapshot()
    .then((value) => {
      cachedIoTSnapshot = { value, expiresAt: Date.now() + 2500 };
      return value;
    })
    .finally(() => {
      pendingIoTSnapshot = null;
    });

  return pendingIoTSnapshot;
}

async function loadSupabaseIoTSnapshot() {
  const [environmentRows, workHourRows, warningRows, inactivityRows, restBreakRows] = await Promise.all([
    safeSelectRows<IoTEnvironmentConditionRow>('environment_condition', 'select=*&order=created_at.desc&limit=30'),
    safeSelectRows<IoTWorkHoursRow>('work_hours', 'select=*&order=start_time.desc&limit=50'),
    safeSelectRows<IoTWarningRow>('warning', 'select=*&order=created_at.desc&limit=50'),
    safeSelectRows<IoTInactivityLogRow>('inactivity_log', 'select=*&order=created_at.desc&limit=50'),
    safeSelectRows<IoTRestBreakRow>('rest_break', 'select=*&order=created_at.desc&limit=50')
  ]);
  const latestEnvironment = environmentRows[0] ?? null;
  const latestWorkHour = workHourRows[0] ?? null;
  const latestClearWarning = warningRows.find((row) => isWorkerClearedWarning(row)) ?? null;
  const latestWarning = warningRows.find((row) => isOpenWarning(row) && isAfterWarningClear(row, latestClearWarning)) ?? null;
  const activeRestBreak = restBreakRows.find((row) => (row.status ?? '').toUpperCase() === 'PENDING') ?? restBreakRows[0] ?? null;
  const primaryWorker = makeIoTWorker(latestWorkHour, latestWarning, activeRestBreak, inactivityRows[0] ?? null, latestEnvironment);
  const workers = [
    primaryWorker,
    ...fallbackWorkers.slice(1).map((worker) => ({
      ...worker,
      status: 'waiting' as WorkerStatus,
      task: 'Standby support',
      environment: makeStubWorkerEnvironment(worker)
    }))
  ];
  const tasks = applyIoTTaskProofs([
    ...Array.from(iotRuntimeTasks.values()),
    ...makeIoTTasks(primaryWorker, latestEnvironment, latestWorkHour)
  ]);
  const activeIncidents = warningRows
    .filter((row) => isOpenWarning(row) && isAfterWarningClear(row, latestClearWarning))
    .map((row) => mapIoTWarningIncident(row, primaryWorker))
    .filter((incident): incident is IoTIncident => Boolean(incident))
    .map(applyIoTIncidentStateOverride)
    .filter((incident) => !['RESOLVED', 'FALSE_ALARM'].includes(incident.state));
  const incidentHistory = warningRows
    .map((row) => mapIoTWarningIncident(row, primaryWorker))
    .filter((incident): incident is IoTIncident => Boolean(incident))
    .map(applyIoTIncidentStateOverride);
  const restRequests = restBreakRows.map((row) => mapIoTRestRequest(row, primaryWorker));
  const nearMissReports = [
    ...inactivityRows.map((row) => mapIoTInactivityNearMiss(row, primaryWorker)),
    ...warningRows
      .filter((row) => normalizeWarningEvent(row.event_type) === 'JATUH')
      .map((row) => mapIoTWarningNearMiss(row, primaryWorker))
  ];
  const latestRisk = makeIoTRiskEvaluations(warningRows, latestEnvironment, primaryWorker);
  const latestFatigue = [{
    id: `iot-fatigue-${latestWorkHour?.id ?? 'stub'}`,
    worker_id: primaryWorker.id,
    device_id: 'iot-supabase-stream',
    task_id: tasks[0]?.id ?? null,
    zone_id: primaryWorker.zone,
    fatigue_score: primaryWorker.fatigue,
    fatigue_level: primaryWorker.fatigue >= 75 ? 'HIGH' : primaryWorker.fatigue >= 45 ? 'MEDIUM' : 'LOW',
    intervention: primaryWorker.fatigue >= 75 ? 'REST_REQUIRED' : 'MONITOR',
    break_minutes: primaryWorker.fatigue >= 75 ? 15 : 0,
    reasons: JSON.stringify(makeIoTFatigueReasons(latestWorkHour, inactivityRows[0] ?? null, activeRestBreak)),
    evaluated_at: latestWorkHour?.stop_time ?? latestWorkHour?.start_time ?? new Date().toISOString()
  }];

  return {
    workers,
    tasks,
    notifications: makeIoTNotifications(warningRows, inactivityRows, restBreakRows, latestEnvironment, primaryWorker),
    devices: [makeIoTDevice(latestEnvironment, latestWorkHour)],
    activeIncidents,
    incidentHistory,
    nearMissReports,
    restRequests,
    latestRisk,
    latestFatigue,
    restBreaks: restBreakRows
  };
}

async function safeSelectRows<T>(tableName: string, query: string): Promise<T[]> {
  const cacheKey = `${tableName}?${query}`;

  try {
    const rows = await selectRows<T>(tableName, query);
    supabaseReadCache.set(cacheKey, rows);
    return rows;
  } catch (error) {
    if (String(error).includes('(401)')) {
      throw error;
    }

    const now = Date.now();
    const lastWarning = supabaseWarningTimes.get(cacheKey) ?? 0;

    if (now - lastWarning > 30_000) {
      console.warn(`Supabase ${tableName} unavailable, using last known data:`, error);
      supabaseWarningTimes.set(cacheKey, now);
    }

    return (supabaseReadCache.get(cacheKey) as T[] | undefined) ?? [];
  }
}

type RuntimeStateRow = {
  state_key: string;
  payload: string;
};

function ensureRuntimeStateTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS supabase_iot_runtime_state (
      category TEXT NOT NULL,
      state_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (category, state_key)
    )
  `);
}

function loadRuntimeStateValues<T>(category: string): T[] {
  ensureRuntimeStateTable();
  const rows = db.query<RuntimeStateRow, [string]>(`
    SELECT state_key, payload
    FROM supabase_iot_runtime_state
    WHERE category = ?
    ORDER BY updated_at DESC
  `).all(category);

  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload) as T];
    } catch {
      return [];
    }
  });
}

function loadRuntimeStateMap<T>(category: string): Map<string, T> {
  ensureRuntimeStateTable();
  const rows = db.query<RuntimeStateRow, [string]>(`
    SELECT state_key, payload
    FROM supabase_iot_runtime_state
    WHERE category = ?
    ORDER BY updated_at ASC
  `).all(category);
  const values = new Map<string, T>();

  for (const row of rows) {
    try {
      values.set(row.state_key, JSON.parse(row.payload) as T);
    } catch {
      // Ignore a malformed cache row without blocking the application.
    }
  }

  return values;
}

function persistRuntimeState(category: string, stateKey: string, payload: unknown) {
  ensureRuntimeStateTable();
  db.prepare(`
    INSERT INTO supabase_iot_runtime_state (category, state_key, payload, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(category, state_key) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(category, stateKey, JSON.stringify(payload), new Date().toISOString());
  cachedIoTSnapshot = null;
}

function addRuntimeNotification(notification: Notification) {
  iotRuntimeNotifications.unshift(notification);
  persistRuntimeState('notification', notification.id, notification);
}

function makeIoTWorker(
  latestWorkHour: IoTWorkHoursRow | null,
  latestWarning: IoTWarningRow | null,
  activeRestBreak: IoTRestBreakRow | null,
  latestInactivity: IoTInactivityLogRow | null,
  latestEnvironment: IoTEnvironmentConditionRow | null
): Worker {
  const base = fallbackWorkers[0];
  const event = normalizeWarningEvent(latestWarning?.event_type);
  const durationSeconds = latestWorkHour?.duration_seconds ?? secondsBetween(latestWorkHour?.start_time, latestWorkHour?.stop_time);
  const fatigue = calculateIoTFatigue(durationSeconds, latestInactivity?.duration_seconds, latestEnvironment, Boolean(activeRestBreak));
  const status: WorkerStatus = event === 'SOS' || event === 'JATUH'
    ? 'emergency'
    : activeRestBreak
      ? 'break'
      : latestWorkHour && !latestWorkHour.stop_time
        ? 'working'
        : 'waiting';

  return {
    ...base,
    id: base.id,
    name: base.name,
    role: base.role,
    task: latestWorkHour ? 'IoT monitored field work' : base.task,
    status,
    zone: 'IoT Site',
    time: formatDurationClock(durationSeconds),
    workload: fatigue >= 70 ? 'High' : fatigue >= 45 ? 'Medium' : 'Low',
    fatigue,
    match: Math.max(58, 100 - fatigue),
    environment: makeLiveWorkerEnvironment(latestEnvironment, latestWarning, latestInactivity, fatigue)
  };
}

function makeIoTTasks(worker: Worker, environment: IoTEnvironmentConditionRow | null, workHour: IoTWorkHoursRow | null): Task[] {
  const durationSeconds = workHour?.duration_seconds ?? secondsBetween(workHour?.start_time, workHour?.stop_time);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const stopReason = normalizeWarningEvent(workHour?.stop_reason);
  const checkpointDeadline = workHour?.stop_time
    ?? (workHour?.start_time
      ? new Date(new Date(workHour.start_time).getTime() + Math.max(30, durationMinutes + 15) * 60_000).toISOString()
      : new Date(Date.now() + 30 * 60_000).toISOString());
  const priority = worker.status === 'emergency' || ['SOS', 'JATUH'].includes(stopReason)
    ? 'Critical'
    : worker.fatigue >= 65
      ? 'High'
      : 'Medium';
  const tone: Tone = priority === 'Critical' ? 'danger' : priority === 'High' ? 'warning' : 'neutral';

  return [
    {
      id: 'iot-live-shift',
      title: 'IoT monitored field work',
      owner: worker.name,
      location: worker.zone,
      taskTemplate: 'Field safety operation',
      project: 'Kawal IoT Integration',
      zone: worker.zone,
      quantity: durationMinutes,
      unit: 'minutes',
      deadline: checkpointDeadline,
      priority,
      temperatureC: environment?.avg_suhu ?? null,
      humidityPct: environment?.avg_kelembaban ?? null,
      workload: worker.workload,
      notes: environment
        ? `Supabase IoT rows: work_hours=${workHour?.id ?? 'none'}, environment_condition=${environment.id}. ${environment.avg_suhu ?? '-'}C, ${environment.avg_kelembaban ?? '-'}% humidity, ${environment.avg_tekanan ?? '-'} hPa.`
        : 'Supabase IoT tables are connected; waiting for environment_condition rows.',
      schedulerRecommendation: makeIoTTaskSchedulerRecommendation(worker, environment, workHour, durationMinutes, priority),
      status: worker.status === 'emergency' ? 'Safety hold' : worker.status === 'working' ? 'In Progress' : 'Open',
      due: workHour?.stop_reason ?? 'Live checkpoint',
      tone
    }
  ];
}

function makeIoTTaskSchedulerRecommendation(
  worker: Worker,
  environment: IoTEnvironmentConditionRow | null,
  workHour: IoTWorkHoursRow | null,
  durationMinutes: number,
  priority: string
): SchedulerRecommendation {
  const urgent = priority === 'Critical' || priority === 'High';
  const totalWorkerHours = Math.max(0.25, durationMinutes / 60);
  const fatigueDrag = Math.max(0.45, 1 - worker.fatigue / 150);
  const environmentDrag = Number(environment?.avg_suhu ?? 0) >= 32 || Number(environment?.avg_kelembaban ?? 0) >= 80 ? 0.82 : 1;
  const productivity = Math.max(0.4, 1.8 * fatigueDrag * environmentDrag);
  const forecastValues = [0.92, 1, urgent ? 0.88 : 1.05, urgent ? 0.84 : 1.08].map((multiplier) =>
    Math.round(productivity * multiplier * 100) / 100
  );
  const stopReason = normalizeWarningEvent(workHour?.stop_reason);
  const safetyWarnings = [
    worker.fatigue >= 65 ? `Worker fatigue is ${worker.fatigue}%.` : null,
    environment && Number(environment.avg_suhu ?? 0) >= 32 ? `Temperature is ${environment.avg_suhu}C.` : null,
    environment && Number(environment.avg_kelembaban ?? 0) >= 80 ? `Humidity is ${environment.avg_kelembaban}%.` : null,
    ['SOS', 'JATUH', 'TIDAK BERGERAK'].includes(stopReason) ? `Work stopped by ${stopReason}.` : null
  ].filter((warning): warning is string => Boolean(warning));

  return {
    totalWorkerHours,
    recommendedWorkerCount: urgent ? 2 : 1,
    recommendedCrewSize: urgent ? 2 : 1,
    estimatedTaskDuration: formatDurationLabel(durationMinutes * 60),
    estimatedDuration: formatDurationLabel(durationMinutes * 60),
    recommendedStartTime: workHour?.start_time ? `Started ${formatTimestampForOps(workHour.start_time)}` : 'Waiting for work_hours start_time',
    estimatedCompletionTime: workHour?.stop_time ? `Stopped ${formatTimestampForOps(workHour.stop_time)}` : 'Live checkpoint in progress',
    estimatedFinishTime: workHour?.stop_time ? `Stopped ${formatTimestampForOps(workHour.stop_time)}` : 'Live checkpoint in progress',
    predictedWorkload: worker.workload === 'High' ? 'High' : worker.workload === 'Medium' ? 'Medium' : 'Low',
    selectedWorkerRecommendations: [
      {
        workerId: worker.id,
        workerName: worker.name,
        explanation: `Assigned from worker@gmail.com IoT stream with ${durationMinutes} minutes captured in work_hours.`
      }
    ],
    assignmentEngineVersion: 'iot-supabase-task-adapter-v1',
    expectedProductivityRate: `${productivity.toFixed(2)} minutes/worker-hour adjusted by fatigue and environment`,
    deadlineFeasibilityStatus: urgent ? 'Supervisor review required from live IoT signal' : 'On track under current IoT signal',
    capacityEstimatorVersion: 'iot-live-capacity-v1',
    requiredPpeAndCertifications: ['Helmet', 'Harness', 'Safety shoes'],
    dependencyStatus: workHour ? `Bound to Supabase work_hours row ${workHour.id}.` : 'Waiting for Supabase work_hours row.',
    currentEnvironmentalConditions: environment
      ? `Supabase environment_condition row ${environment.id}: ${environment.avg_suhu ?? '-'}C, ${environment.avg_kelembaban ?? '-'}% humidity, ${environment.avg_tekanan ?? '-'} hPa.`
      : 'No environment_condition row available yet.',
    safetyAndOperationalWarnings: safetyWarnings.length ? safetyWarnings : ['No active IoT safety warning for this live task.'],
    chronosForecast: {
      futureProductivity: `${forecastValues[1].toFixed(2)} minutes/worker-hour`,
      delayPrediction: urgent
        ? 'IoT signal indicates elevated risk; supervisor should verify before continuing.'
        : 'IoT signal indicates normal productivity for this live field operation.',
      suggestedAdditionalCrew: urgent ? 1 : 0,
      forecastVersion: 'iot-derived-chronos-context-v1',
      confidence: workHour && environment ? 'INFERRED' : 'COLD_START',
      model: 'supabase-iot-derived',
      modelStatus: 'READY',
      forecastValues
    },
    schedulerStatus: 'Generated from live Supabase IoT tables: work_hours, environment_condition, warning, and worker fatigue state.'
  };
}

function applyIoTTaskProofs(tasks: Task[]) {
  return tasks.map((task) => {
    const proof = iotTaskProofs.get(task.id);

    if (!proof) {
      return task;
    }

    return {
      ...task,
      status: proof.status === 'ACCEPTED' ? 'Done' : proof.status === 'REJECTED' ? 'In Progress' : 'Review',
      due: proof.status === 'ACCEPTED' ? 'Done' : proof.status === 'REJECTED' ? 'Needs revision' : 'Proof ready',
      tone: proof.status === 'REJECTED' ? 'warning' as Tone : 'success' as Tone,
      completionProofImage: proof.imageDataUrl,
      completionProofSubmittedAt: proof.submittedAt,
      completionProofStatus: proof.status,
      completionProofNote: proof.note
    };
  });
}

async function createSupabaseIoTStubTask(input: CreateTaskInput, workers: Worker[]): Promise<Task> {
  const workload = inferWorkload(input.taskTemplate, input.quantity);
  const base = fallbackTasks[0];
  const schedulerRecommendation = await makeSchedulerRecommendation({ ...input, workload }, workers.length ? workers : fallbackWorkers, null);

  return {
    ...base,
    id: slugify(`${input.taskTemplate}-${Date.now()}`),
    title: input.taskTemplate,
    owner: input.owner?.trim() || 'Unassigned',
    location: input.zone,
    taskTemplate: input.taskTemplate,
    project: input.project,
    zone: input.zone,
    quantity: input.quantity,
    unit: input.unit,
    deadline: input.deadline,
    priority: input.priority,
    temperatureC: null,
    humidityPct: null,
    workload,
    notes: input.notes ?? 'Supabase IoT mode stub; create a tasks table later to persist this.',
    schedulerRecommendation,
    status: 'Open',
    due: input.deadline,
    tone: input.priority === 'Critical' ? 'danger' : input.priority === 'High' ? 'warning' : 'neutral'
  };
}

function makeIoTNotifications(
  warnings: IoTWarningRow[],
  inactivityRows: IoTInactivityLogRow[],
  restBreakRows: IoTRestBreakRow[],
  environment: IoTEnvironmentConditionRow | null,
  worker: Worker
): Notification[] {
  const warningNotifications = warnings.slice(0, 12).map((row) => mapIoTWarningNotification(row, worker));
  const inactivityNotifications = inactivityRows.slice(0, 4).map((row) => ({
    id: `iot-inactivity-${row.id}`,
    title: 'Worker inactivity',
    detail: `No movement detected for ${row.duration_seconds ?? 0} seconds during work session ${row.work_hours_id ?? '-'}.`,
    tone: 'warning' as Tone,
    targetLabel: 'Open worker',
    targetSection: 'workers' as ManagerSection,
    targetWorkerId: worker.id,
    createdAt: row.created_at,
    read: false
  }));
  const restNotifications = restBreakRows.slice(0, 4).map((row) => ({
    id: `iot-rest-${row.id}`,
    title: 'Rest break signal',
    detail: `Rest break ${row.status ?? 'PENDING'} after ${row.work_duration_before_break ?? 0} seconds of work.`,
    tone: 'warning' as Tone,
    targetLabel: 'Review rest',
    targetSection: 'workers' as ManagerSection,
    targetWorkerId: worker.id,
    createdAt: row.created_at,
    read: false
  }));
  const environmentNotification = environment ? [{
    id: `iot-environment-${environment.id}`,
    title: 'Environment updated',
    detail: `${environment.avg_suhu ?? '-'}C, ${environment.avg_kelembaban ?? '-'}% humidity, ${environment.avg_tekanan ?? '-'} hPa.`,
    tone: (Number(environment.avg_suhu ?? 0) >= 32 || Number(environment.avg_kelembaban ?? 0) >= 80 ? 'warning' : 'neutral') as Tone,
    targetLabel: 'Open IoT',
    targetSection: 'iot' as ManagerSection,
    createdAt: environment.created_at,
    read: false
  }] : [];

  return [...iotRuntimeNotifications, ...warningNotifications, ...inactivityNotifications, ...restNotifications, ...environmentNotification, ...fallbackNotifications]
    .sort((left, right) => new Date(right.createdAt ?? '').getTime() - new Date(left.createdAt ?? '').getTime());
}

function mapIoTWarningNotification(row: IoTWarningRow, worker: Worker): Notification {
  const event = normalizeWarningEvent(row.event_type);
  const danger = event === 'SOS' || event === 'JATUH';
  const clearedByWorker = isWorkerClearedWarning(row);

  return {
    id: `iot-warning-${row.id}`,
    title: clearedByWorker ? 'SOS resolved' : event === 'SOS' ? 'SOS' : event === 'JATUH' ? 'Fall detected' : event === 'TIDAK BERGERAK' ? 'No movement' : 'Warning cleared',
    detail: clearedByWorker
      ? `${worker.name} turned off the SOS alarm from the wearable.`
      : `${event} event from Supabase warning table. Buzzer: ${row.status_buzzer ?? '-'}.`,
    tone: danger ? 'danger' : event === 'BATAL/NORMAL' ? 'success' : 'warning',
    targetLabel: danger || clearedByWorker ? 'Open incident' : 'Open IoT',
    targetSection: danger || clearedByWorker ? 'incidents' : 'iot',
    targetWorkerId: worker.id,
    createdAt: row.created_at,
    read: false
  };
}

function makeIoTDevice(environment: IoTEnvironmentConditionRow | null, workHour: IoTWorkHoursRow | null): IoTDevice {
  const lastSeen = environment?.created_at ?? workHour?.stop_time ?? workHour?.start_time ?? null;

  return {
    id: 'iot-supabase-stream',
    mqttClientId: 'supabase-iot-tables',
    name: 'Supabase IoT Stream',
    deviceType: 'TABLE_STREAM',
    status: lastSeen ? 'ONLINE' : 'STUB',
    firmwareVersion: null,
    assignedWorkerId: fallbackWorkers[0]?.id ?? null,
    assignedSiteId: 'kawal-site',
    assignedZoneId: 'IoT Site',
    assignedTaskId: 'iot-live-shift',
    lastSeenAt: lastSeen,
    batteryPct: null,
    signalStrength: null
  };
}

function mapIoTWarningIncident(row: IoTWarningRow, worker: Worker): IoTIncident | null {
  const event = normalizeWarningEvent(row.event_type);

  if (!['SOS', 'JATUH', 'TIDAK BERGERAK', 'BATAL/NORMAL'].includes(event)) {
    return null;
  }

  return {
    id: `iot-incident-${row.id}`,
    worker_id: worker.id,
    task_id: 'iot-live-shift',
    zone_id: worker.zone,
    state: isOpenWarning(row) ? 'OPEN' : 'RESOLVED',
    trigger_source: event === 'BATAL/NORMAL' ? 'WORKER_CANCELLED_ALERT' : event,
    device_id: 'iot-supabase-stream',
    opened_at: row.created_at,
    escalation_level: event === 'SOS' || event === 'JATUH' ? 1 : 0
  };
}

function applyIoTIncidentStateOverride(incident: IoTIncident): IoTIncident {
  const override = iotIncidentStateOverrides.get(incident.id);

  if (!override) {
    return incident;
  }

  return {
    ...incident,
    state: override.state,
    escalation_level: override.escalationLevel ?? incident.escalation_level
  };
}

function mapIoTRestRequest(row: IoTRestBreakRow, worker: Worker) {
  return {
    id: `iot-rest-${row.id}`,
    worker_id: worker.id,
    device_id: 'iot-supabase-stream',
    task_id: 'iot-live-shift',
    zone_id: worker.zone,
    source: 'SUPABASE_REST_BREAK',
    status: row.status ?? 'PENDING',
    requested_at: row.created_at,
    risk_score_at_request: Math.min(100, Math.round((row.work_duration_before_break ?? 0) / 60)),
    fatigue_score_at_request: worker.fatigue,
    decision: null,
    decision_reason: null,
    break_session_id: null
  };
}

function mapIoTInactivityNearMiss(row: IoTInactivityLogRow, worker: Worker) {
  return {
    id: `iot-inactivity-${row.id}`,
    device_id: 'iot-supabase-stream',
    worker_id: worker.id,
    task_id: 'iot-live-shift',
    zone_id: worker.zone,
    window_end: row.idle_end_time ?? row.created_at,
    maximum_acceleration_g: 0,
    movement_state: 'INACTIVE',
    inactive_seconds: row.duration_seconds ?? 0,
    impact_detected: 0,
    fall_candidate: 0
  };
}

function mapIoTWarningNearMiss(row: IoTWarningRow, worker: Worker) {
  return {
    id: `iot-warning-fall-${row.id}`,
    device_id: 'iot-supabase-stream',
    worker_id: worker.id,
    task_id: 'iot-live-shift',
    zone_id: worker.zone,
    window_end: row.created_at,
    maximum_acceleration_g: 1,
    movement_state: 'FALL_CANDIDATE',
    inactive_seconds: 0,
    impact_detected: 1,
    fall_candidate: 1
  };
}

function makeIoTRiskEvaluations(warnings: IoTWarningRow[], environment: IoTEnvironmentConditionRow | null, worker: Worker) {
  const latestWarning = warnings.find((row) => normalizeWarningEvent(row.event_type) !== 'BATAL/NORMAL');
  const event = normalizeWarningEvent(latestWarning?.event_type);
  const environmentRisk = Number(environment?.avg_suhu ?? 0) >= 32 || Number(environment?.avg_kelembaban ?? 0) >= 80 ? 18 : 0;
  const eventRisk = event === 'SOS' || event === 'JATUH' ? 82 : event === 'TIDAK BERGERAK' ? 58 : 24;
  const riskScore = Math.min(100, Math.max(eventRisk, worker.fatigue) + environmentRisk);

  return [{
    id: `iot-risk-${latestWarning?.id ?? environment?.id ?? 'stub'}`,
    worker_id: worker.id,
    device_id: 'iot-supabase-stream',
    task_id: 'iot-live-shift',
    zone_id: worker.zone,
    risk_score: riskScore,
    risk_level: riskScore >= 85 ? 'CRITICAL' : riskScore >= 65 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW',
    intervention: riskScore >= 85 ? 'OPEN_INCIDENT' : riskScore >= 65 ? 'SUPERVISOR_REVIEW' : 'MONITOR',
    break_minutes: riskScore >= 65 ? 15 : 0,
    reasons: JSON.stringify([
      latestWarning ? `warning.${event}` : 'no active warning event',
      environment ? `environment ${environment.avg_suhu ?? '-'}C/${environment.avg_kelembaban ?? '-'}%` : 'environment stub'
    ]),
    evaluated_at: latestWarning?.created_at ?? environment?.created_at ?? new Date().toISOString()
  }];
}

function calculateIoTFatigue(
  durationSeconds?: number | null,
  inactivitySeconds?: number | null,
  environment?: IoTEnvironmentConditionRow | null,
  hasRestBreak?: boolean
) {
  const workMinutes = Math.max(0, Math.round((durationSeconds ?? 0) / 60));
  const inactivityLoad = Math.min(18, Math.round((inactivitySeconds ?? 0) / 10));
  const heatLoad = Number(environment?.avg_suhu ?? 0) >= 30 ? 10 : 0;
  const humidityLoad = Number(environment?.avg_kelembaban ?? 0) >= 75 ? 8 : 0;
  const restLoad = hasRestBreak ? 18 : 0;
  return Math.min(96, Math.max(22, 22 + Math.round(workMinutes / 3) + inactivityLoad + heatLoad + humidityLoad + restLoad));
}

function makeLiveWorkerEnvironment(
  environment: IoTEnvironmentConditionRow | null,
  latestWarning: IoTWarningRow | null,
  latestInactivity: IoTInactivityLogRow | null,
  fatigue: number
) {
  const temperature = environment?.avg_suhu ?? null;
  const humidity = environment?.avg_kelembaban ?? null;
  const pressure = environment?.avg_tekanan ?? null;
  const warningEvent = normalizeWarningEvent(latestWarning?.event_type);
  const factors = [
    temperature !== null && temperature >= 30 ? `Heat load ${temperature.toFixed(1)}C` : null,
    humidity !== null && humidity >= 75 ? `Humidity load ${humidity.toFixed(0)}%` : null,
    pressure !== null && (pressure < 1008 || pressure > 1013) ? `Pressure shift ${pressure.toFixed(1)} hPa` : null,
    latestInactivity ? `Inactive ${latestInactivity.duration_seconds ?? 0}s` : null,
    ['SOS', 'JATUH', 'TIDAK BERGERAK'].includes(warningEvent) ? `Warning event ${warningEvent}` : null
  ].filter((factor): factor is string => Boolean(factor));
  const environmentLoad = (temperature !== null && temperature >= 30 ? 10 : 0)
    + (humidity !== null && humidity >= 75 ? 8 : 0)
    + (pressure !== null && (pressure < 1008 || pressure > 1013) ? 4 : 0);
  const warningLoad = warningEvent === 'SOS' || warningEvent === 'JATUH' ? 36 : warningEvent === 'TIDAK BERGERAK' ? 18 : 0;
  const riskScore = Math.min(100, Math.max(18, fatigue + environmentLoad + warningLoad));

  return {
    source: 'live' as const,
    temperatureC: temperature,
    humidityPct: humidity,
    pressureHpa: pressure,
    recordedAt: environment?.created_at,
    riskScore,
    riskLevel: riskScore >= 85 ? 'CRITICAL' as const : riskScore >= 65 ? 'HIGH' as const : riskScore >= 40 ? 'MEDIUM' as const : 'LOW' as const,
    riskFactors: factors.length ? factors : ['Live IoT environment is within normal range'],
    summary: environment
      ? 'Live environment_condition is assigned to worker@gmail.com wearable.'
      : 'Waiting for environment_condition rows from the IoT device.'
  };
}

function makeStubWorkerEnvironment(worker: Worker) {
  const riskScore = Math.max(18, Math.min(62, worker.fatigue + (worker.workload === 'High' ? 12 : worker.workload === 'Medium' ? 8 : 4)));

  return {
    source: 'stub' as const,
    temperatureC: 24,
    humidityPct: 60,
    pressureHpa: 1010,
    riskScore,
    riskLevel: riskScore >= 65 ? 'HIGH' as const : riskScore >= 40 ? 'MEDIUM' as const : 'LOW' as const,
    riskFactors: ['No assigned IoT device yet', `${worker.workload} workload baseline`, `${worker.fatigue}% fatigue baseline`],
    summary: 'Stub environment until this worker receives a dedicated IoT device.'
  };
}

function makeIoTFatigueReasons(workHour: IoTWorkHoursRow | null, inactivity: IoTInactivityLogRow | null, restBreak: IoTRestBreakRow | null) {
  return [
    workHour ? `work_hours.duration_seconds=${workHour.duration_seconds ?? 0}` : 'work_hours stub',
    inactivity ? `inactivity_log.duration_seconds=${inactivity.duration_seconds ?? 0}` : 'no inactivity row',
    restBreak ? `rest_break.status=${restBreak.status ?? 'PENDING'}` : 'no rest break row'
  ];
}

function normalizeWarningEvent(value?: string | null) {
  return (value ?? '').trim().toUpperCase() || 'UNKNOWN';
}

function isOpenWarning(row: IoTWarningRow) {
  const event = normalizeWarningEvent(row.event_type);
  return event !== 'BATAL/NORMAL' && (row.status_buzzer ?? '').toUpperCase() === 'NYALA';
}

function isWorkerClearedWarning(row: IoTWarningRow) {
  return normalizeWarningEvent(row.event_type) === 'BATAL/NORMAL' && (row.status_buzzer ?? '').toUpperCase() === 'MATI';
}

function isAfterWarningClear(row: IoTWarningRow, latestClearWarning: IoTWarningRow | null) {
  if (!latestClearWarning) {
    return true;
  }

  return new Date(row.created_at).getTime() > new Date(latestClearWarning.created_at).getTime();
}

function secondsBetween(start?: string | null, stop?: string | null) {
  if (!start) return 0;
  const startTime = new Date(start).getTime();
  const stopTime = stop ? new Date(stop).getTime() : Date.now();

  if (!Number.isFinite(startTime) || !Number.isFinite(stopTime)) {
    return 0;
  }

  return Math.max(0, Math.round((stopTime - startTime) / 1000));
}

function formatDurationClock(seconds?: number | null) {
  const totalMinutes = Math.max(0, Math.round((seconds ?? 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function formatDurationLabel(seconds?: number | null) {
  const totalMinutes = Math.max(1, Math.round((seconds ?? 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  return hours ? `${hours}h` : `${minutes}m`;
}

function formatTimestampForOps(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatTime(date);
}

function makeSupabaseEnvelope(device: SupabaseDeviceRow, eventType: string, payload: Record<string, unknown>) {
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

async function selectRows<T>(tableName: string, query: string): Promise<T[]> {
  return supabaseRequest<T[]>(tableName, query);
}

async function insertRows<T>(tableName: string, rows: Array<Record<string, unknown>>): Promise<T[]> {
  return supabaseRequest<T[]>(tableName, '', {
    method: 'POST',
    body: JSON.stringify(rows),
    prefer: 'return=representation'
  });
}

async function upsertRows<T>(tableName: string, rows: Array<Record<string, unknown>>, onConflict: string): Promise<T[]> {
  return supabaseRequest<T[]>(tableName, `on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    body: JSON.stringify(rows),
    prefer: 'resolution=merge-duplicates,return=representation'
  });
}

async function patchRows<T>(tableName: string, query: string, body: Record<string, unknown>): Promise<T[]> {
  return supabaseRequest<T[]>(tableName, query, {
    method: 'PATCH',
    body: JSON.stringify(body),
    prefer: 'return=representation'
  });
}

async function supabaseRequest<T>(
  tableName: string,
  query: string,
  init: { method?: string; body?: string; prefer?: string } = {}
): Promise<T> {
  assertSupabaseConfigured();

  const separator = query ? `?${query}` : '';
  const method = init.method ?? 'GET';
  const maxAttempts = method === 'GET' ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), supabaseRequestTimeoutMs);

    try {
      const response = await fetch(`${supabaseRestUrl}/${tableName}${separator}`, {
        method,
        signal: controller.signal,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Profile': supabaseSchema,
          'Content-Profile': supabaseSchema,
          ...(init.prefer ? { Prefer: init.prefer } : {})
        },
        body: init.body
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new SupabaseHttpError(`Supabase ${tableName} request failed (${response.status}): ${detail}`);
      }

      if (response.status === 204) {
        return [] as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (error instanceof SupabaseHttpError || attempt === maxAttempts) {
        throw error;
      }

      await Bun.sleep(180 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

class SupabaseHttpError extends Error {}

function mapWorker(row: SupabaseWorkerRow): Worker {
  return {
    ...row,
    status: row.status as WorkerStatus,
    match: row.match
  };
}

function mapTask(row: SupabaseTaskRow): Task {
  const schedulerRecommendation = parseSchedulerRecommendation(row.scheduler_recommendation);
  return {
    id: row.id,
    title: row.title,
    owner: row.owner,
    location: row.location || row.zone,
    taskTemplate: row.task_template || row.title,
    project: row.project,
    zone: row.zone || row.location,
    quantity: row.quantity,
    unit: row.unit,
    deadline: row.deadline || row.due,
    priority: row.priority,
    temperatureC: null,
    humidityPct: null,
    workload: schedulerRecommendation.predictedWorkload ?? 'Medium',
    notes: row.notes,
    schedulerRecommendation,
    status: row.status,
    due: row.due,
    tone: row.tone as Tone,
    completionProofImage: row.completion_proof_image ?? undefined,
    completionProofSubmittedAt: row.completion_proof_submitted_at ?? undefined,
    completionProofStatus: row.completion_proof_status ?? undefined,
    completionProofNote: row.completion_proof_note ?? undefined
  };
}

function taskToRow(task: Task): SupabaseTaskRow {
  return {
    id: task.id,
    title: task.title,
    owner: task.owner,
    location: task.location,
    task_template: task.taskTemplate,
    project: task.project,
    zone: task.zone,
    quantity: task.quantity,
    unit: task.unit,
    deadline: task.deadline,
    priority: task.priority,
    notes: task.notes,
    scheduler_recommendation: task.schedulerRecommendation,
    status: task.status,
    due: task.due,
    tone: task.tone,
    completion_proof_image: task.completionProofImage ?? null,
    completion_proof_submitted_at: task.completionProofSubmittedAt ?? null,
    completion_proof_status: task.completionProofStatus ?? null,
    completion_proof_note: task.completionProofNote ?? null
  };
}

function mapNotification(row: SupabaseNotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    tone: row.tone as Tone,
    targetLabel: row.target_label,
    targetSection: row.target_section as ManagerSection,
    targetWorkerId: row.target_worker_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    read: Boolean(row.read)
  };
}

function mapDevice(row: SupabaseDeviceRow): IoTDevice {
  return {
    id: row.id,
    mqttClientId: row.mqtt_client_id,
    name: row.name,
    deviceType: row.device_type,
    status: row.status,
    firmwareVersion: row.firmware_version,
    assignedWorkerId: row.assigned_worker_id,
    assignedSiteId: row.assigned_site_id,
    assignedZoneId: row.assigned_zone_id,
    assignedTaskId: row.assigned_task_id,
    lastSeenAt: row.last_seen_at,
    batteryPct: row.battery_pct,
    signalStrength: row.signal_strength
  };
}

function mapIncident(row: SupabaseIncidentRow): IoTIncident {
  return {
    id: row.id,
    worker_id: row.worker_id,
    task_id: row.task_id,
    zone_id: row.zone_id,
    state: row.state,
    trigger_source: row.trigger_source,
    device_id: row.device_id,
    opened_at: row.opened_at,
    escalation_level: row.escalation_level
  };
}

async function makeSchedulerRecommendation(
  input: CreateTaskInput & { workload: 'Low' | 'Medium' | 'High' },
  availableWorkers: Worker[],
  environment: SupabaseEnvironmentRow | null
): Promise<SchedulerRecommendation> {
  const urgent = input.priority === 'High' || input.priority === 'Critical';
  const capacity = estimateCapacity({
    taskTemplate: input.taskTemplate,
    quantity: input.quantity,
    deadline: input.deadline,
    environment: {
      temperatureC: environment?.temperature_c,
      humidityPct: environment?.humidity_pct,
      workload: input.workload
    },
    availableWorkerCount: availableWorkers.length
  });
  const workerCount = capacity.recommendedCrewSize;
  const requiredPpeAndCertifications = ['Helmet', 'Safety shoes', 'High-vis vest', urgent ? 'Supervisor safety sign-off' : 'Standard toolbox briefing'];
  const candidateWorkers = recommendWorkers({
    taskTemplate: input.taskTemplate,
    requiredSkills: [input.taskTemplate],
    requiredCertifications: requiredPpeAndCertifications,
    zone: input.zone,
    recommendedCrewSize: workerCount,
    workers: availableWorkers
  })
    .map((worker) => ({
      workerId: worker.workerId,
      workerName: worker.workerName,
      explanation: worker.explanation
    }));
  const chronosForecast = await forecastProductivity({
    historicalCompletedQuantity: [Math.max(1, Math.round(input.quantity * 0.72)), Math.max(1, Math.round(input.quantity * 0.86)), input.quantity],
    workerHours: [capacity.totalWorkerHours * 0.9, capacity.totalWorkerHours, capacity.totalWorkerHours * 1.08],
    breakMinutes: [0, input.workload === 'High' ? 10 : 5, input.workload === 'High' ? 15 : 5],
    activeWorkers: [workerCount, workerCount, workerCount],
    predictionLength: 4
  }).catch((error) => chronosUnavailableForecast(error instanceof Error ? error.message : 'Chronos model request failed'));

  return {
    totalWorkerHours: capacity.totalWorkerHours,
    recommendedWorkerCount: workerCount,
    recommendedCrewSize: workerCount,
    estimatedTaskDuration: capacity.estimatedDuration,
    estimatedDuration: capacity.estimatedDuration,
    recommendedStartTime: urgent ? 'Next safe available window' : 'Next normal scheduling window',
    estimatedCompletionTime: capacity.estimatedFinishTime,
    estimatedFinishTime: capacity.estimatedFinishTime,
    predictedWorkload: capacity.predictedWorkload,
    selectedWorkerRecommendations: candidateWorkers,
    assignmentEngineVersion: 'worker-assignment-engine-v1',
    expectedProductivityRate: `${capacity.productivityRatePerWorkerHour} ${input.unit}/worker-hour`,
    deadlineFeasibilityStatus: capacity.deadlineFeasibilityStatus,
    capacityEstimatorVersion: capacity.estimatorVersion,
    requiredPpeAndCertifications,
    dependencyStatus: urgent ? `Supervisor clearance required before dispatch in ${input.zone}.` : `No blocking dependency inferred for ${input.zone}.`,
    currentEnvironmentalConditions: environment
      ? `IoT telemetry: ${environment.temperature_c ?? '-'}C, ${environment.humidity_pct ?? '-'}% humidity at ${environment.recorded_at}.`
      : 'No current IoT telemetry for this zone; baseline capacity conditions are in use.',
    safetyAndOperationalWarnings: urgent
      ? ['High-priority task: confirm PPE, rest readiness, and zone access before assignment.', ...capacity.warnings]
      : ['Confirm zone access before dispatch.', ...capacity.warnings],
    chronosForecast,
    schedulerStatus: 'Live scheduler inference: capacity, worker assignment, IoT conditions, and Chronos-2 forecasting are recalculated from current data.'
  };
}

function parseSchedulerRecommendation(value: unknown): SchedulerRecommendation {
  if (value && typeof value === 'object' && 'schedulerStatus' in value) {
    return value as SchedulerRecommendation;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as SchedulerRecommendation;

      if (parsed && typeof parsed.schedulerStatus === 'string') {
        return parsed;
      }
    } catch {
      // Fall through to default placeholder.
    }
  }

  return fallbackTasks[0]?.schedulerRecommendation ?? {
    recommendedWorkerCount: 1,
    estimatedTaskDuration: 'Pending',
    recommendedStartTime: 'Pending',
    estimatedCompletionTime: 'Pending',
    selectedWorkerRecommendations: [],
    expectedProductivityRate: 'Pending',
    deadlineFeasibilityStatus: 'Pending',
    requiredPpeAndCertifications: [],
    dependencyStatus: 'Pending',
    currentEnvironmentalConditions: 'Pending',
    safetyAndOperationalWarnings: [],
    schedulerStatus: 'Pending'
  };
}

function encodeFilterValue(value: string) {
  return encodeURIComponent(value);
}

function hashPassword(password: string) {
  return new Bun.CryptoHasher('sha256').update(`garudie:${password}`).digest('hex');
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

type CreateTaskInput = {
  taskTemplate: string;
  project: string;
  zone: string;
  quantity: number;
  unit: string;
  deadline: string;
  priority: string;
  notes?: string;
  owner?: string;
};

type SupabaseEnvelope = Envelope;

type SupabaseUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type SupabaseWorkerRow = Omit<Worker, 'status'> & {
  status: string;
};

type SupabaseTaskRow = {
  id: string;
  title: string;
  owner: string;
  location: string;
  task_template: string;
  project: string;
  zone: string;
  quantity: number;
  unit: string;
  deadline: string;
  priority: string;
  notes: string;
  scheduler_recommendation: unknown;
  status: string;
  due: string;
  tone: string;
  completion_proof_image?: string | null;
  completion_proof_submitted_at?: string | null;
  completion_proof_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;
  completion_proof_note?: string | null;
};

type SupabaseEnvironmentRow = {
  temperature_c: number | null;
  humidity_pct: number | null;
  recorded_at: string;
};

type SupabaseNotificationRow = {
  id: string;
  title: string;
  detail: string;
  tone: string;
  target_label: string;
  target_section: string;
  target_worker_id: string | null;
  created_at?: string;
  read: boolean;
};

type SupabaseDeviceRow = {
  id: string;
  mqtt_client_id: string;
  name: string;
  device_type: string;
  status: string;
  firmware_version: string | null;
  assigned_worker_id: string | null;
  assigned_site_id: string | null;
  assigned_zone_id: string | null;
  assigned_task_id: string | null;
  last_seen_at: string | null;
  battery_pct: number | null;
  signal_strength: number | null;
};

type SupabaseIncidentRow = {
  id: string;
  worker_id: string;
  task_id: string | null;
  zone_id: string | null;
  state: string;
  trigger_source: string;
  device_id: string;
  opened_at: string;
  escalation_level: number;
};

type IoTEnvironmentConditionRow = {
  id: number | string;
  created_at: string;
  avg_suhu: number | null;
  avg_kelembaban: number | null;
  avg_tekanan: number | null;
};

type IoTWorkHoursRow = {
  id: number | string;
  start_time: string;
  stop_time: string | null;
  duration_seconds: number | null;
  stop_reason: string | null;
};

type IoTWarningRow = {
  id: number | string;
  created_at: string;
  event_type: string | null;
  status_buzzer: string | null;
};

type IoTInactivityLogRow = {
  id: number | string;
  created_at: string;
  work_hours_id: number | string | null;
  duration_seconds: number | null;
  idle_start_time: string | null;
  idle_end_time: string | null;
};

type IoTRestBreakRow = {
  id: number | string;
  created_at: string;
  work_duration_before_break: number | null;
  status: string | null;
  work_hours_id: number | string | null;
};

function isImageDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(value);
}

export const supabaseFallbackData: WorkforceData = {
  workers: fallbackWorkers,
  tasks: [],
  notifications: fallbackNotifications
};
