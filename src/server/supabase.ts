import { notifications as fallbackNotifications, tasks as fallbackTasks, workers as fallbackWorkers } from '../constants/workforce';
import type { AuthUser, ManagerSection, UserRole } from '../types/navigation';
import type { IoTDevice, IncidentCenterData, IoTIncident, IoTOverview } from '../types/iot';
import type { Notification, SchedulerRecommendation, Task, Tone, Worker, WorkerStatus, WorkforceData } from '../types/workforce';
import { evaluateRisk, parseTopic, topicPrefix, validateEnvelope } from './iot';
import type { Envelope } from './iot';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseSchema = process.env.SUPABASE_SCHEMA ?? 'public';

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function shouldUseSupabase() {
  return process.env.DATA_SOURCE === 'supabase';
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
  const rows = await selectRows<SupabaseUserRow>('users', 'select=id,name,email,role&order=id.asc');
  return rows.map(({ role, ...row }) => ({ ...row, role: role as UserRole }));
}

export async function authenticateSupabaseUser(email: string, password: string): Promise<AuthUser | null> {
  const query = `select=id,name,email,role,password_hash&email=ilike.${encodeFilterValue(email.trim())}&limit=1`;
  const [row] = await selectRows<SupabaseUserRow & { password_hash: string }>('users', query);

  if (!row || row.password_hash !== hashPassword(password)) {
    return null;
  }

  const { password_hash: _passwordHash, role, ...user } = row;
  return { ...user, role: role as UserRole };
}

export async function getSupabaseWorkers(): Promise<Worker[]> {
  const rows = await selectRows<SupabaseWorkerRow>('workers', 'select=*&order=id.asc');
  return rows.map(mapWorker);
}

export async function getSupabaseTasks(): Promise<Task[]> {
  const rows = await selectRows<SupabaseTaskRow>('tasks', 'select=*&order=id.asc');
  return rows.map(mapTask);
}

export async function getSupabaseNotifications(): Promise<Notification[]> {
  const rows = await selectRows<SupabaseNotificationRow>('notifications', 'select=*&order=id.asc');
  return rows.map(mapNotification);
}

export async function getSupabaseWorkforceData(): Promise<WorkforceData> {
  const [workers, tasks, notifications] = await Promise.all([
    getSupabaseWorkers(),
    getSupabaseTasks(),
    getSupabaseNotifications()
  ]);

  return { workers, tasks, notifications };
}

export async function createSupabaseTask(input: CreateTaskInput): Promise<Task> {
  const workers = await getSupabaseWorkers();
  const schedulerRecommendation = makeSchedulerPlaceholder(input, workers);
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
    notes: input.notes?.trim() ?? '',
    schedulerRecommendation,
    status: 'Open',
    due: input.deadline.trim(),
    tone: input.priority === 'Critical' ? 'danger' : input.priority === 'High' ? 'warning' : 'neutral'
  };

  const [row] = await insertRows<SupabaseTaskRow>('tasks', [taskToRow(task)]);
  return mapTask(row);
}

export async function markSupabaseNotificationRead(notificationId: string): Promise<Notification | null> {
  const rows = await patchRows<SupabaseNotificationRow>('notifications', `id=eq.${encodeFilterValue(notificationId)}`, { read: true });
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function getSupabaseIoTOverview(): Promise<IoTOverview> {
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
  const rows = await selectRows<SupabaseDeviceRow>('iot_devices', 'select=*&order=updated_at.desc');
  return rows.map(mapDevice);
}

export async function getSupabaseIncidentCenter(): Promise<IncidentCenterData> {
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
    activeIncident: incidentRows[0] ? mapIncident(incidentRows[0]) : null
  };
}

export async function updateSupabaseWorkerShiftStatus(workerId: string, status: 'waiting' | 'working' | 'break' | 'done') {
  await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status });
  return getSupabaseWorkerAppData(workerId);
}

export async function completeSupabaseWorkerAssignment(workerId: string) {
  const data = await getSupabaseWorkerAppData(workerId);

  if (!data.worker) {
    throw new Error('Worker not found');
  }

  await patchRows('workers', `id=eq.${encodeFilterValue(workerId)}`, { status: 'done' });
  await patchRows('tasks', `owner=eq.${encodeFilterValue(data.worker.name)}`, {
    status: 'Review',
    due: 'Ready',
    tone: 'success'
  });
  await createSupabaseNotification({
    title: 'Task ready for review',
    detail: `${data.worker.name} completed ${data.tasks[0]?.title ?? data.worker.task}.`,
    tone: 'success',
    targetLabel: 'Review task',
    targetSection: 'tasks',
    targetWorkerId: workerId
  });

  return getSupabaseWorkerAppData(workerId);
}

export async function reportSupabaseWorkerHazard(workerId: string, input: { hazardType?: string; note?: string }) {
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

export async function requestSupabaseWorkerRest(workerId: string) {
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
    read: false
  }]);
}

async function getSupabaseDeviceForWorker(workerId: string) {
  const [device] = await selectRows<SupabaseDeviceRow>('iot_devices', `select=*&assigned_worker_id=eq.${encodeFilterValue(workerId)}&limit=1`);
  return device ?? null;
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
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}${separator}`, {
    method: init.method ?? 'GET',
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
    throw new Error(`Supabase ${tableName} request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) {
    return [] as T;
  }

  return (await response.json()) as T;
}

function mapWorker(row: SupabaseWorkerRow): Worker {
  return {
    ...row,
    status: row.status as WorkerStatus,
    match: row.match
  };
}

function mapTask(row: SupabaseTaskRow): Task {
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
    notes: row.notes,
    schedulerRecommendation: parseSchedulerRecommendation(row.scheduler_recommendation),
    status: row.status,
    due: row.due,
    tone: row.tone as Tone
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
    tone: task.tone
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

function makeSchedulerPlaceholder(input: CreateTaskInput, availableWorkers: Worker[]): SchedulerRecommendation {
  const urgent = input.priority === 'High' || input.priority === 'Critical';
  const workerCount = Math.max(1, Math.min(availableWorkers.length || 1, Math.ceil(input.quantity / (urgent ? 40 : 60))));
  const candidateWorkers = availableWorkers
    .slice()
    .sort((left, right) => right.match - left.match)
    .slice(0, workerCount)
    .map((worker) => ({
      workerId: worker.id,
      workerName: worker.name,
      explanation: `${worker.role} has ${worker.match}% match and current fatigue score ${worker.fatigue}; placeholder scheduler ranks by match until optimizer rules are deployed.`
    }));

  return {
    recommendedWorkerCount: workerCount,
    estimatedTaskDuration: urgent ? '2-4 hours placeholder estimate' : '1-3 hours placeholder estimate',
    recommendedStartTime: urgent ? 'Next safe available window' : 'Next normal scheduling window',
    estimatedCompletionTime: input.deadline,
    selectedWorkerRecommendations: candidateWorkers,
    expectedProductivityRate: `${Math.max(1, Math.round(input.quantity / Math.max(workerCount, 1)))} ${input.unit} per worker placeholder`,
    deadlineFeasibilityStatus: urgent ? 'Needs supervisor confirmation' : 'Likely feasible under placeholder rules',
    requiredPpeAndCertifications: ['Helmet', 'Safety shoes', 'High-vis vest', urgent ? 'Supervisor safety sign-off' : 'Standard toolbox briefing'],
    dependencyStatus: 'Placeholder assumes dependencies are clear; future scheduler will check task graph.',
    currentEnvironmentalConditions: 'Placeholder reads latest Supabase telemetry when scheduler integration is deployed.',
    safetyAndOperationalWarnings: urgent
      ? ['High-priority task: confirm PPE, rest readiness, and zone access before assignment.']
      : ['Confirm zone access before dispatch.'],
    schedulerStatus: 'Placeholder scheduler result for the Supabase data source.'
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
};

type SupabaseNotificationRow = {
  id: string;
  title: string;
  detail: string;
  tone: string;
  target_label: string;
  target_section: string;
  target_worker_id: string | null;
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

export const supabaseFallbackData: WorkforceData = {
  workers: fallbackWorkers,
  tasks: fallbackTasks,
  notifications: fallbackNotifications
};
