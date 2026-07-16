import { db } from './database';

export const topicPrefix = process.env.MQTT_TOPIC_PREFIX ?? 'construction/v1';
const ackTimeoutMs = Number(process.env.MQTT_COMMAND_ACK_TIMEOUT_MS ?? 5000);
const resultTimeoutMs = Number(process.env.MQTT_COMMAND_RESULT_TIMEOUT_MS ?? 15000);
const heartbeatTimeoutMs = Number(process.env.MQTT_HEARTBEAT_TIMEOUT_MS ?? 90000);

const weatherValues = new Set(['CLEAR', 'RAIN', 'WIND', 'STORM', 'HOT']);
const surfaceValues = new Set(['DRY', 'WET', 'MUDDY', 'UNEVEN']);
const movementValues = new Set(['IDLE', 'MOVING', 'INACTIVE', 'RUNNING', 'FALL_CANDIDATE']);

type TopicCategory = 'telemetry' | 'events' | 'status' | 'commands';
type ProcessingStatus = 'PROCESSED' | 'REJECTED' | 'FAILED';
type CommandStatus = 'PENDING' | 'PUBLISHED' | 'ACKNOWLEDGED' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export type ParsedTopic = {
  deviceId: string;
  category: TopicCategory;
  kind: string;
};

export type Envelope = {
  schemaVersion: string;
  messageId: string;
  deviceId: string;
  workerId?: string | null;
  siteId?: string | null;
  zoneId?: string | null;
  taskId?: string | null;
  eventType: string;
  recordedAt: string;
  sequenceNumber?: number;
  firmwareVersion?: string;
  payload: Record<string, unknown>;
};

type DeviceRow = {
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
  created_at: string;
  updated_at: string;
};

type CommandRow = {
  id: string;
  command_id: string;
  device_id: string;
  command_type: string;
  priority: string;
  payload: string;
  status: CommandStatus;
  issued_at: string;
  expires_at: string;
  published_at: string | null;
  acknowledged_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  related_worker_id: string | null;
  related_task_id: string | null;
  related_incident_id: string | null;
  related_rest_request_id: string | null;
  related_break_session_id: string | null;
  created_by: string;
};

type EnvironmentReadingRow = {
  id: string;
  device_id: string;
  site_id: string | null;
  zone_id: string | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  weather: string | null;
  surface_condition: string | null;
  crane_active: number;
  restricted_zone_detected: number;
  battery_pct: number | null;
  signal_strength: number | null;
  recorded_at: string;
  received_at: string;
  valid: number;
  validation_error: string | null;
  data_source: string;
};

type RiskEvaluation = {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  intervention: 'NONE' | 'REST_RECOMMENDED' | 'REST_REQUIRED' | 'SOS_REQUIRED';
  breakMinutes: number;
  reasons: string[];
  policyVersion: 'risk-policy-v1';
};

export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split('/');
  const prefixParts = topicPrefix.split('/');

  if (parts.length < prefixParts.length + 4) {
    return null;
  }

  for (let index = 0; index < prefixParts.length; index += 1) {
    if (parts[index] !== prefixParts[index]) {
      return null;
    }
  }

  const [devicesSegment, deviceId, category, kind] = parts.slice(prefixParts.length);

  if (devicesSegment !== 'devices' || !deviceId || !category || !kind) {
    return null;
  }

  if (!['telemetry', 'events', 'status', 'commands'].includes(category)) {
    return null;
  }

  return {
    deviceId,
    category: category as TopicCategory,
    kind
  };
}

export function validateEnvelope(value: unknown, topicDeviceId?: string): { ok: true; envelope: Envelope } | { ok: false; error: string } {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Message must be a JSON object' };
  }

  const candidate = value as Partial<Envelope>;

  if (candidate.schemaVersion !== '1.0') {
    return { ok: false, error: 'Unsupported schemaVersion' };
  }

  if (!isNonEmptyString(candidate.messageId)) {
    return { ok: false, error: 'messageId is required' };
  }

  if (!isNonEmptyString(candidate.deviceId)) {
    return { ok: false, error: 'deviceId is required' };
  }

  if (topicDeviceId && candidate.deviceId !== topicDeviceId) {
    return { ok: false, error: 'deviceId does not match topic' };
  }

  if (!isNonEmptyString(candidate.eventType)) {
    return { ok: false, error: 'eventType is required' };
  }

  if (!isNonEmptyString(candidate.recordedAt) || Number.isNaN(Date.parse(candidate.recordedAt))) {
    return { ok: false, error: 'recordedAt must be an ISO timestamp' };
  }

  if (!candidate.payload || typeof candidate.payload !== 'object' || Array.isArray(candidate.payload)) {
    return { ok: false, error: 'payload must be an object' };
  }

  return { ok: true, envelope: candidate as Envelope };
}

export function evaluateRisk(input: {
  continuousWorkMinutes?: number;
  taskWorkload?: string | null;
  temperatureC?: number | null;
  humidityPct?: number | null;
  surfaceCondition?: string | null;
  movementState?: string | null;
  restrictedZoneDetected?: boolean;
  currentEmergency?: boolean;
}): RiskEvaluation {
  let score = 12;
  const reasons: string[] = [];

  if ((input.continuousWorkMinutes ?? 0) >= 120) {
    score += 24;
    reasons.push('Continuous work exceeds configured limit');
  }

  if (input.taskWorkload?.toLowerCase() === 'high') {
    score += 14;
    reasons.push('Heavy workload');
  }

  if ((input.temperatureC ?? 0) >= 35) {
    score += 22;
    reasons.push('High ambient temperature');
  } else if ((input.temperatureC ?? 0) >= 32) {
    score += 12;
    reasons.push('Elevated ambient temperature');
  }

  if ((input.humidityPct ?? 0) >= 80) {
    score += 10;
    reasons.push('High humidity');
  }

  if (input.surfaceCondition === 'WET' || input.surfaceCondition === 'MUDDY' || input.surfaceCondition === 'UNEVEN') {
    score += 10;
    reasons.push('Unsafe surface condition');
  }

  if (input.movementState === 'INACTIVE') {
    score += 8;
    reasons.push('Worker inactivity requires check-in');
  }

  if (input.restrictedZoneDetected) {
    score += 28;
    reasons.push('Restricted zone detected');
  }

  if (input.currentEmergency) {
    score = Math.max(score, 95);
    reasons.push('Worker emergency state is active');
  }

  const boundedScore = Math.min(100, score);
  const riskLevel = boundedScore >= 85 ? 'CRITICAL' : boundedScore >= 65 ? 'HIGH' : boundedScore >= 40 ? 'MEDIUM' : 'LOW';
  const intervention = riskLevel === 'CRITICAL' ? 'SOS_REQUIRED' : riskLevel === 'HIGH' ? 'REST_REQUIRED' : riskLevel === 'MEDIUM' ? 'REST_RECOMMENDED' : 'NONE';

  return {
    riskScore: boundedScore,
    riskLevel,
    intervention,
    breakMinutes: riskLevel === 'CRITICAL' ? 20 : riskLevel === 'HIGH' ? 15 : riskLevel === 'MEDIUM' ? 10 : 0,
    reasons: reasons.length ? reasons : ['Conditions are within configured MVP thresholds'],
    policyVersion: 'risk-policy-v1'
  };
}

export function processIoTMessage(topic: string, rawPayload: string) {
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
    persistRawMessage({
      messageId: `invalid-${crypto.randomUUID()}`,
      deviceId: parsedTopic.deviceId,
      topic,
      rawPayload,
      receivedAt,
      status: 'REJECTED',
      error: validation.error
    });
    return { ok: false, status: 400, error: validation.error };
  }

  const envelope = validation.envelope;
  const duplicate = db.query('SELECT message_id FROM raw_iot_messages WHERE message_id = ?').get(envelope.messageId);

  if (duplicate) {
    return { ok: true, duplicate: true, messageId: envelope.messageId };
  }

  persistRawMessage({
    messageId: envelope.messageId,
    deviceId: envelope.deviceId,
    topic,
    rawPayload,
    receivedAt,
    schemaVersion: envelope.schemaVersion,
    eventType: envelope.eventType,
    recordedAt: envelope.recordedAt,
    status: 'PROCESSED'
  });

  try {
    const device = authenticateDevice(envelope.deviceId);
    if (!device) {
      markRawMessage(envelope.messageId, 'REJECTED', 'Unknown or unauthorized device');
      return { ok: false, status: 401, error: 'Unknown or unauthorized device' };
    }

    const result = routeMessage(parsedTopic, envelope, receivedAt, device);
    markRawMessage(envelope.messageId, 'PROCESSED');
    return { ok: true, messageId: envelope.messageId, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    markRawMessage(envelope.messageId, 'FAILED', message);
    return { ok: false, status: 500, error: message };
  }
}

export function publishDeviceCommand(input: {
  deviceId: string;
  commandType: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  payload: Record<string, unknown>;
  expiresInMs?: number;
  relatedWorkerId?: string | null;
  relatedTaskId?: string | null;
  relatedIncidentId?: string | null;
  relatedRestRequestId?: string | null;
  relatedBreakSessionId?: string | null;
  createdBy?: string;
}) {
  const now = new Date();
  const commandId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + (input.expiresInMs ?? 10000)).toISOString();

  db.prepare(`
    INSERT INTO device_commands (
      id, command_id, device_id, command_type, priority, payload, status,
      issued_at, expires_at, published_at, retry_count, related_worker_id,
      related_task_id, related_incident_id, related_rest_request_id,
      related_break_session_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    commandId,
    input.deviceId,
    input.commandType,
    input.priority ?? 'NORMAL',
    JSON.stringify(input.payload),
    now.toISOString(),
    expiresAt,
    now.toISOString(),
    input.relatedWorkerId ?? null,
    input.relatedTaskId ?? null,
    input.relatedIncidentId ?? null,
    input.relatedRestRequestId ?? null,
    input.relatedBreakSessionId ?? null,
    input.createdBy ?? 'SYSTEM'
  );

  return getCommand(commandId);
}

export function expirePendingCommands(now = new Date()) {
  const expired = db.query<CommandRow, [string]>(`
    SELECT * FROM device_commands
    WHERE status IN ('PUBLISHED', 'PENDING', 'ACKNOWLEDGED', 'EXECUTING')
      AND expires_at <= ?
  `).all(now.toISOString());

  for (const command of expired) {
    db.prepare('UPDATE device_commands SET status = ?, failure_reason = ? WHERE command_id = ?').run(
      command.status === 'PUBLISHED' ? 'EXPIRED' : 'FAILED',
      command.status === 'PUBLISHED' ? `No acknowledgement within ${ackTimeoutMs}ms` : `No result within ${resultTimeoutMs}ms`,
      command.command_id
    );
    createNotification('iot-command-failed', 'Device command failed', `${command.command_type} did not complete on ${command.device_id}.`, 'danger');
  }

  return expired.length;
}

export function markOfflineDevices(now = new Date()) {
  const cutoff = new Date(now.getTime() - heartbeatTimeoutMs).toISOString();
  const staleDevices = db.query<DeviceRow, [string]>(`
    SELECT * FROM iot_devices
    WHERE status = 'ONLINE' AND last_seen_at IS NOT NULL AND last_seen_at < ?
  `).all(cutoff);

  for (const device of staleDevices) {
    db.prepare('UPDATE iot_devices SET status = ?, updated_at = ? WHERE id = ?').run('OFFLINE', now.toISOString(), device.id);
    createNotification('iot-device-offline', 'IoT offline', `${device.name} has missed heartbeat checks.`, 'warning', device.assigned_worker_id);
  }

  return staleDevices.length;
}

export function getIoTOverview() {
  expirePendingCommands();
  markOfflineDevices();

  return {
    devices: listDevices(),
    activeIncidents: db.query('SELECT * FROM emergency_incidents WHERE state != ? ORDER BY opened_at DESC').all('RESOLVED'),
    restRequests: db.query('SELECT * FROM rest_requests ORDER BY requested_at DESC LIMIT 20').all(),
    commands: db.query('SELECT * FROM device_commands ORDER BY issued_at DESC LIMIT 20').all(),
    latestRisk: db.query('SELECT * FROM risk_evaluations ORDER BY evaluated_at DESC LIMIT 20').all()
  };
}

export function listDevices() {
  return db.query<DeviceRow, []>('SELECT * FROM iot_devices ORDER BY created_at').all().map(mapDevice);
}

export function getDevice(deviceId: string) {
  const row = db.query<DeviceRow, [string]>('SELECT * FROM iot_devices WHERE id = ?').get(deviceId);
  return row ? mapDevice(row) : null;
}

export function assignDevice(deviceId: string, input: { workerId?: string; siteId?: string; zoneId?: string; taskId?: string }) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE iot_devices
    SET assigned_worker_id = COALESCE(?, assigned_worker_id),
        assigned_site_id = COALESCE(?, assigned_site_id),
        assigned_zone_id = COALESCE(?, assigned_zone_id),
        assigned_task_id = COALESCE(?, assigned_task_id),
        updated_at = ?
    WHERE id = ?
  `).run(input.workerId ?? null, input.siteId ?? null, input.zoneId ?? null, input.taskId ?? null, now, deviceId);
  return getDevice(deviceId);
}

export function unassignDevice(deviceId: string) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE iot_devices
    SET assigned_worker_id = NULL,
        assigned_site_id = NULL,
        assigned_zone_id = NULL,
        assigned_task_id = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, deviceId);
  return getDevice(deviceId);
}

export function getCurrentEnvironmentByZone(zoneId: string) {
  return db.query<EnvironmentReadingRow, [string]>(`
    SELECT * FROM environment_readings
    WHERE zone_id = ? AND valid = 1
    ORDER BY
      CASE
        WHEN restricted_zone_detected = 1 THEN 4
        WHEN temperature_c >= 35 THEN 3
        WHEN surface_condition IN ('WET', 'MUDDY', 'UNEVEN') THEN 2
        ELSE 1
      END DESC,
      recorded_at DESC
    LIMIT 1
  `).get(zoneId);
}

export function getCurrentEnvironmentBySite(siteId: string) {
  return db.query<EnvironmentReadingRow, [string]>(`
    SELECT * FROM environment_readings
    WHERE site_id = ? AND valid = 1
    ORDER BY recorded_at DESC
    LIMIT 20
  `).all(siteId);
}

export function getEnvironmentHistory(zoneId: string) {
  return db.query<EnvironmentReadingRow, [string]>(`
    SELECT * FROM environment_readings
    WHERE zone_id = ?
    ORDER BY recorded_at DESC
    LIMIT 50
  `).all(zoneId);
}

export function getRestRequests() {
  return db.query('SELECT * FROM rest_requests ORDER BY requested_at DESC').all();
}

export function getRestRequest(requestId: string) {
  return db.query('SELECT * FROM rest_requests WHERE id = ?').get(requestId);
}

export function approveRestRequest(requestId: string, decidedBy = 'manager-demo') {
  const request = db.query<{ device_id: string; worker_id: string; task_id: string | null }, [string]>('SELECT * FROM rest_requests WHERE id = ?').get(requestId);
  if (!request) return null;

  const breakSession = createBreakSession({
    workerId: request.worker_id,
    taskId: request.task_id,
    deviceId: request.device_id,
    source: 'MANAGER_APPROVED',
    plannedMinutes: 10
  });

  db.prepare(`
    UPDATE rest_requests
    SET status = 'MANAGER_APPROVED', decision = 'APPROVED', decision_reason = 'Manager approved rest request',
        decided_by = ?, decided_at = ?, break_session_id = ?
    WHERE id = ?
  `).run(decidedBy, new Date().toISOString(), breakSession.id, requestId);

  publishDeviceCommand({
    deviceId: request.device_id,
    commandType: 'REST_START',
    priority: 'HIGH',
    payload: {
      breakSessionId: breakSession.id,
      breakMinutes: breakSession.plannedMinutes,
      buzzerPattern: 'REST_APPROVED',
      displayMessage: 'Rest break approved'
    },
    relatedWorkerId: request.worker_id,
    relatedTaskId: request.task_id,
    relatedRestRequestId: requestId,
    relatedBreakSessionId: breakSession.id
  });

  return getRestRequest(requestId);
}

export function rejectRestRequest(requestId: string, reason: string, decidedBy = 'manager-demo') {
  db.prepare(`
    UPDATE rest_requests
    SET status = 'REJECTED', decision = 'REJECTED', decision_reason = ?, decided_by = ?, decided_at = ?
    WHERE id = ?
  `).run(reason, decidedBy, new Date().toISOString(), requestId);
  return getRestRequest(requestId);
}

export function getCurrentBreak(workerId: string) {
  return db.query('SELECT * FROM break_sessions WHERE worker_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1').get(workerId, 'BREAK_ACTIVE');
}

export function completeBreak(workerId: string) {
  const now = new Date().toISOString();
  db.prepare('UPDATE break_sessions SET status = ?, completed_at = ? WHERE worker_id = ? AND status = ?').run('COMPLETED', now, workerId, 'BREAK_ACTIVE');
  db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('working', workerId);
  return getCurrentBreak(workerId);
}

export function getActiveIncidents() {
  return db.query('SELECT * FROM emergency_incidents WHERE state IN (?, ?) ORDER BY opened_at DESC').all('OPEN', 'ACKNOWLEDGED');
}

export function getIncidentCenter() {
  return {
    activeIncidents: getActiveIncidents(),
    incidentHistory: db.query('SELECT * FROM emergency_incidents ORDER BY opened_at DESC LIMIT 50').all(),
    nearMissReports: db.query(`
      SELECT * FROM motion_telemetry_summaries
      WHERE impact_detected = 1 OR fall_candidate = 1
      ORDER BY window_end DESC
      LIMIT 30
    `).all()
  };
}

export function getIncident(incidentId: string) {
  return db.query('SELECT * FROM emergency_incidents WHERE id = ?').get(incidentId);
}

export function updateIncidentState(incidentId: string, state: 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED' | 'FALSE_ALARM') {
  const now = new Date().toISOString();
  const updates: Record<string, string> = {
    ACKNOWLEDGED: 'state = ?, acknowledged_at = ?',
    ESCALATED: 'state = ?, escalation_level = escalation_level + 1',
    RESOLVED: 'state = ?, resolved_at = ?',
    FALSE_ALARM: 'state = ?, resolved_at = ?'
  };
  const sql = `UPDATE emergency_incidents SET ${updates[state]} WHERE id = ?`;
  state === 'ESCALATED' ? db.prepare(sql).run(state, incidentId) : db.prepare(sql).run(state, now, incidentId);
  return getIncident(incidentId);
}

export function getLatestRisk(workerId: string) {
  return db.query('SELECT * FROM risk_evaluations WHERE worker_id = ? ORDER BY evaluated_at DESC LIMIT 1').get(workerId);
}

export function getRiskHistory(workerId: string) {
  return db.query('SELECT * FROM risk_evaluations WHERE worker_id = ? ORDER BY evaluated_at DESC LIMIT 50').all(workerId);
}

export function evaluateWorkerRisk(workerId: string) {
  const device = db.query<DeviceRow, [string]>('SELECT * FROM iot_devices WHERE assigned_worker_id = ? LIMIT 1').get(workerId);
  if (!device) return null;

  const environment = device.assigned_zone_id ? getCurrentEnvironmentByZone(device.assigned_zone_id) : null;
  const risk = evaluateRisk({
    continuousWorkMinutes: 134,
    taskWorkload: 'High',
    temperatureC: environment?.temperature_c,
    humidityPct: environment?.humidity_pct,
    surfaceCondition: environment?.surface_condition,
    restrictedZoneDetected: Boolean(environment?.restricted_zone_detected)
  });

  return persistRiskEvaluation(device, risk);
}

export function getDataReadiness(projectId: string) {
  const evaluatedAt = new Date().toISOString();
  const completeTaskCount = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM tasks WHERE status IN ('Review', 'Done')").get()?.count ?? 0;
  const environmentCount = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM environment_readings WHERE valid = 1').get()?.count ?? 0;
  const telemetryCount = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM motion_telemetry_summaries').get()?.count ?? 0;

  const status = {
    id: `readiness-${projectId}`,
    projectId,
    completeTaskCount,
    completeProjectDays: 0,
    environmentCoveragePct: Math.min(100, environmentCount * 20),
    workerTelemetryCoveragePct: Math.min(100, telemetryCount * 25),
    taskOutcomeCoveragePct: Math.min(100, completeTaskCount * 25),
    missingFields: ['actualDuration', 'actualOutput', 'labelledSensorOutcome'].filter((_, index) => index >= completeTaskCount),
    planningMode: completeTaskCount >= 8 && environmentCount >= 20 && telemetryCount >= 20 ? 'RULE_BASED' : 'COLLECTION',
    evaluatedAt
  };

  db.prepare(`
    INSERT OR REPLACE INTO data_collection_status (
      id, project_id, complete_task_count, complete_project_days, environment_coverage_pct,
      worker_telemetry_coverage_pct, task_outcome_coverage_pct, missing_fields, planning_mode, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    status.id,
    status.projectId,
    status.completeTaskCount,
    status.completeProjectDays,
    status.environmentCoveragePct,
    status.workerTelemetryCoveragePct,
    status.taskOutcomeCoveragePct,
    JSON.stringify(status.missingFields),
    status.planningMode,
    status.evaluatedAt
  );

  return status;
}

export function updateSiteConditions(input: {
  siteId: string;
  zoneId: string;
  temperatureC: number;
  humidityPct: number;
  weather: string;
  surfaceCondition: string;
  craneActive: boolean;
  restrictedZoneDetected: boolean;
}) {
  const receivedAt = new Date().toISOString();
  const validationError = validateEnvironmentPayload({
    temperatureC: input.temperatureC,
    humidityPct: input.humidityPct,
    weather: input.weather,
    surfaceCondition: input.surfaceCondition,
    craneActive: input.craneActive,
    restrictedZoneDetected: input.restrictedZoneDetected
  });

  if (validationError) {
    return { ok: false, error: validationError };
  }

  db.prepare(`
    INSERT INTO environment_readings (
      id, device_id, site_id, zone_id, temperature_c, humidity_pct, weather, surface_condition,
      crane_active, restricted_zone_detected, battery_pct, signal_strength, recorded_at,
      received_at, valid, validation_error, data_source
    ) VALUES (?, 'manual-site-condition', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1, NULL, 'MANUAL_UPDATE')
  `).run(
    crypto.randomUUID(),
    input.siteId,
    input.zoneId,
    input.temperatureC,
    input.humidityPct,
    input.weather,
    input.surfaceCondition,
    input.craneActive ? 1 : 0,
    input.restrictedZoneDetected ? 1 : 0,
    receivedAt,
    receivedAt
  );

  const affectedDevices = db.query<DeviceRow, [string, string]>(`
    SELECT * FROM iot_devices
    WHERE assigned_site_id = ? AND assigned_zone_id = ?
  `).all(input.siteId, input.zoneId);

  const riskEvaluations = affectedDevices.map((device) => {
    const risk = evaluateRisk({
      continuousWorkMinutes: 134,
      taskWorkload: 'High',
      temperatureC: input.temperatureC,
      humidityPct: input.humidityPct,
      surfaceCondition: input.surfaceCondition,
      restrictedZoneDetected: input.restrictedZoneDetected
    });

    const riskRow = persistRiskEvaluation(device, risk);

    if (risk.intervention === 'REST_REQUIRED' || risk.intervention === 'SOS_REQUIRED') {
      createNotification(
        'environment-risk-updated',
        'Environment risk updated',
        `${device.name} risk changed to ${risk.riskLevel}; scheduling recommendations should be reviewed.`,
        risk.intervention === 'SOS_REQUIRED' ? 'danger' : 'warning',
        device.assigned_worker_id
      );
    }

    return riskRow;
  });

  return {
    ok: true,
    currentEnvironment: getCurrentEnvironmentByZone(input.zoneId),
    affectedRiskEvaluations: riskEvaluations,
    schedulingRecommendation: riskEvaluations.some((risk) => risk.intervention !== 'NONE')
      ? 'Review assignment timing and break coverage for affected zone.'
      : 'No scheduling adjustment required by current deterministic policy.'
  };
}

function routeMessage(parsedTopic: ParsedTopic, envelope: Envelope, receivedAt: string, device: DeviceRow) {
  updateDeviceHeartbeat(device.id, envelope, receivedAt);

  if (parsedTopic.category === 'telemetry' && parsedTopic.kind === 'environment') {
    return processEnvironmentTelemetry(envelope, receivedAt, device);
  }

  if (parsedTopic.category === 'telemetry' && parsedTopic.kind === 'motion') {
    return processMotionTelemetry(envelope, receivedAt, device);
  }

  if (parsedTopic.category === 'events' && parsedTopic.kind === 'sos') {
    return processSos(envelope, receivedAt, device);
  }

  if (parsedTopic.category === 'events' && parsedTopic.kind === 'rest-request') {
    return processRestRequest(envelope, receivedAt, device);
  }

  if (parsedTopic.category === 'status' && parsedTopic.kind === 'heartbeat') {
    return { type: 'heartbeat', device: getDevice(device.id) };
  }

  if (parsedTopic.category === 'status' && parsedTopic.kind === 'connection') {
    const status = envelope.payload.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
    db.prepare('UPDATE iot_devices SET status = ?, updated_at = ? WHERE id = ?').run(status, receivedAt, device.id);
    return { type: 'connection', device: getDevice(device.id) };
  }

  if (parsedTopic.category === 'commands' && parsedTopic.kind === 'ack') {
    return processCommandAck(envelope, receivedAt, device);
  }

  if (parsedTopic.category === 'commands' && parsedTopic.kind === 'result') {
    return processCommandResult(envelope, receivedAt, device);
  }

  throw new Error(`No handler for topic kind ${parsedTopic.category}/${parsedTopic.kind}`);
}

function processEnvironmentTelemetry(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  const validationError = validateEnvironmentPayload(envelope.payload);
  const valid = !validationError;
  const siteId = device.assigned_site_id ?? envelope.siteId ?? null;
  const zoneId = device.assigned_zone_id ?? envelope.zoneId ?? null;

  db.prepare(`
    INSERT INTO environment_readings (
      id, device_id, site_id, zone_id, temperature_c, humidity_pct, weather, surface_condition,
      crane_active, restricted_zone_detected, battery_pct, signal_strength, recorded_at,
      received_at, valid, validation_error, data_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IOT_DEVICE')
  `).run(
    crypto.randomUUID(),
    envelope.deviceId,
    siteId,
    zoneId,
    numberOrNull(envelope.payload.temperatureC),
    numberOrNull(envelope.payload.humidityPct),
    stringOrNull(envelope.payload.weather),
    stringOrNull(envelope.payload.surfaceCondition),
    envelope.payload.craneActive ? 1 : 0,
    envelope.payload.restrictedZoneDetected ? 1 : 0,
    integerOrNull(envelope.payload.batteryPct),
    integerOrNull(envelope.payload.signalStrength),
    envelope.recordedAt,
    receivedAt,
    valid ? 1 : 0,
    validationError
  );

  if (!valid) {
    return { type: 'environment', valid: false, validationError };
  }

  const risk = evaluateRisk({
    continuousWorkMinutes: 134,
    taskWorkload: 'High',
    temperatureC: numberOrNull(envelope.payload.temperatureC),
    humidityPct: numberOrNull(envelope.payload.humidityPct),
    surfaceCondition: stringOrNull(envelope.payload.surfaceCondition),
    restrictedZoneDetected: Boolean(envelope.payload.restrictedZoneDetected)
  });

  const riskRow = persistRiskEvaluation(device, risk);

  if (risk.intervention === 'REST_REQUIRED') {
    const breakSession = createBreakSession({
      workerId: device.assigned_worker_id ?? 'unknown-worker',
      taskId: device.assigned_task_id,
      deviceId: device.id,
      source: 'RISK_POLICY',
      plannedMinutes: risk.breakMinutes,
      riskEvaluationId: riskRow.id
    });
    db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('break', device.assigned_worker_id);
    publishDeviceCommand({
      deviceId: device.id,
      commandType: 'REST_START',
      priority: 'HIGH',
      payload: {
        breakSessionId: breakSession.id,
        breakMinutes: risk.breakMinutes,
        buzzerPattern: 'REST_REQUIRED',
        displayMessage: 'Rest required by site safety policy'
      },
      relatedWorkerId: device.assigned_worker_id,
      relatedTaskId: device.assigned_task_id,
      relatedBreakSessionId: breakSession.id
    });
    createNotification('iot-rest-required', 'Rest required', `${device.name} crossed the configured rest threshold.`, 'warning', device.assigned_worker_id);
  }

  return { type: 'environment', valid: true, risk };
}

function processMotionTelemetry(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  const validationError = validateMotionPayload(envelope.payload);
  if (validationError) {
    throw new Error(validationError);
  }

  db.prepare(`
    INSERT INTO motion_telemetry_summaries (
      id, device_id, worker_id, task_id, zone_id, window_start, window_end,
      maximum_acceleration_g, average_tilt_degrees, maximum_tilt_change_degrees,
      movement_state, inactive_seconds, impact_detected, fall_candidate, sample_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    envelope.deviceId,
    device.assigned_worker_id,
    device.assigned_task_id,
    device.assigned_zone_id,
    envelope.recordedAt,
    receivedAt,
    numberOrNull(envelope.payload.peakAccelerationG) ?? 0,
    numberOrNull(envelope.payload.tiltDegrees) ?? 0,
    numberOrNull(envelope.payload.tiltChangeDegrees) ?? 0,
    stringOrNull(envelope.payload.movementState) ?? 'MOVING',
    integerOrNull(envelope.payload.inactiveSeconds) ?? 0,
    envelope.payload.impactDetected ? 1 : 0,
    envelope.payload.fallCandidate ? 1 : 0,
    1
  );

  if (envelope.payload.impactDetected && envelope.payload.fallCandidate) {
    createNotification('iot-fall-candidate', 'Fall candidate', `${device.name} reported an impact and fall candidate.`, 'danger', device.assigned_worker_id);
  }

  return { type: 'motion' };
}

function processSos(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  const existingIncident = db.query('SELECT * FROM emergency_incidents WHERE trigger_message_id = ?').get(envelope.messageId);
  if (existingIncident) {
    return { type: 'sos', incident: existingIncident, duplicate: true };
  }

  persistDeviceEvent(envelope, receivedAt, device);
  const incidentId = crypto.randomUUID();
  const environment = device.assigned_zone_id ? getCurrentEnvironmentByZone(device.assigned_zone_id) : null;
  const motion = db.query('SELECT * FROM motion_telemetry_summaries WHERE device_id = ? ORDER BY window_end DESC LIMIT 1').get(device.id);

  db.prepare(`
    INSERT INTO emergency_incidents (
      id, worker_id, task_id, zone_id, state, trigger_source, device_id, trigger_message_id,
      opened_at, last_known_environment, last_known_motion, escalation_level
    ) VALUES (?, ?, ?, ?, 'OPEN', 'IOT_SOS_BUTTON', ?, ?, ?, ?, ?, 1)
  `).run(
    incidentId,
    device.assigned_worker_id ?? envelope.workerId ?? 'unknown-worker',
    device.assigned_task_id ?? envelope.taskId ?? null,
    device.assigned_zone_id ?? envelope.zoneId ?? null,
    device.id,
    envelope.messageId,
    receivedAt,
    JSON.stringify(environment),
    JSON.stringify(motion)
  );

  db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('emergency', device.assigned_worker_id);
  createNotification('iot-sos-open', 'SOS open', `${device.name} pressed the emergency button.`, 'danger', device.assigned_worker_id);

  const command = publishDeviceCommand({
    deviceId: device.id,
    commandType: 'BUZZER',
    priority: 'CRITICAL',
    payload: {
      pattern: 'SOS_ACKNOWLEDGED',
      repeat: 1,
      durationMs: 1000
    },
    relatedWorkerId: device.assigned_worker_id,
    relatedTaskId: device.assigned_task_id,
    relatedIncidentId: incidentId
  });

  return { type: 'sos', incident: getIncident(incidentId), command };
}

function processRestRequest(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  persistDeviceEvent(envelope, receivedAt, device);
  const environment = device.assigned_zone_id ? getCurrentEnvironmentByZone(device.assigned_zone_id) : null;
  const sensor = db.query('SELECT * FROM motion_telemetry_summaries WHERE device_id = ? ORDER BY window_end DESC LIMIT 1').get(device.id);
  const risk = evaluateRisk({
    continuousWorkMinutes: 134,
    taskWorkload: 'High',
    temperatureC: environment?.temperature_c,
    humidityPct: environment?.humidity_pct,
    surfaceCondition: environment?.surface_condition,
    restrictedZoneDetected: Boolean(environment?.restricted_zone_detected)
  });
  const requestId = crypto.randomUUID();
  const autoApprove = true;
  const breakSession = autoApprove
    ? createBreakSession({
        workerId: device.assigned_worker_id ?? 'unknown-worker',
        taskId: device.assigned_task_id,
        deviceId: device.id,
        source: 'WORKER_REQUEST',
        plannedMinutes: risk.breakMinutes || 10
      })
    : null;

  db.prepare(`
    INSERT INTO rest_requests (
      id, worker_id, device_id, task_id, zone_id, source, status, requested_at,
      risk_score_at_request, environment_snapshot, sensor_snapshot, decision,
      decision_reason, decided_by, decided_at, break_session_id
    ) VALUES (?, ?, ?, ?, ?, 'IOT_REST_BUTTON', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    requestId,
    device.assigned_worker_id ?? 'unknown-worker',
    device.id,
    device.assigned_task_id,
    device.assigned_zone_id,
    autoApprove ? 'AUTO_APPROVED' : 'REQUESTED',
    receivedAt,
    risk.riskScore,
    JSON.stringify(environment),
    JSON.stringify(sensor),
    autoApprove ? 'APPROVED' : null,
    autoApprove ? 'Worker-requested rest is auto-approved by MVP policy' : null,
    autoApprove ? 'SYSTEM' : null,
    autoApprove ? receivedAt : null,
    breakSession?.id ?? null
  );

  createNotification('iot-rest-request', 'Rest requested', `${device.name} requested a break.`, 'warning', device.assigned_worker_id);

  const command = autoApprove
    ? publishDeviceCommand({
        deviceId: device.id,
        commandType: 'REST_START',
        priority: 'HIGH',
        payload: {
          breakSessionId: breakSession?.id,
          breakMinutes: breakSession?.plannedMinutes ?? 10,
          buzzerPattern: 'REST_APPROVED',
          displayMessage: 'Rest break approved'
        },
        relatedWorkerId: device.assigned_worker_id,
        relatedTaskId: device.assigned_task_id,
        relatedRestRequestId: requestId,
        relatedBreakSessionId: breakSession?.id ?? null
      })
    : null;

  return { type: 'rest-request', restRequest: getRestRequest(requestId), command };
}

function processCommandAck(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  const commandId = stringOrNull(envelope.payload.commandId);
  if (!commandId) throw new Error('commandId is required for COMMAND_ACK');

  const accepted = envelope.payload.accepted !== false;
  db.prepare(`
    UPDATE device_commands
    SET status = ?, acknowledged_at = ?, failure_reason = ?
    WHERE command_id = ? AND device_id = ?
  `).run(accepted ? 'ACKNOWLEDGED' : 'FAILED', receivedAt, accepted ? null : stringOrNull(envelope.payload.reason) ?? 'Device rejected command', commandId, device.id);

  persistDeviceEvent(envelope, receivedAt, device);
  return { type: 'command-ack', command: getCommand(commandId) };
}

function processCommandResult(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  const commandId = stringOrNull(envelope.payload.commandId);
  if (!commandId) throw new Error('commandId is required for COMMAND_RESULT');

  const status = envelope.payload.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED';
  db.prepare(`
    UPDATE device_commands
    SET status = ?, executed_at = ?, completed_at = ?, failure_reason = ?
    WHERE command_id = ? AND device_id = ?
  `).run(
    status,
    stringOrNull(envelope.payload.executedAt),
    stringOrNull(envelope.payload.completedAt) ?? receivedAt,
    status === 'FAILED' ? stringOrNull(envelope.payload.errorMessage) ?? 'Device reported command failure' : null,
    commandId,
    device.id
  );

  persistDeviceEvent(envelope, receivedAt, device);
  return { type: 'command-result', command: getCommand(commandId) };
}

function persistRawMessage(input: {
  messageId: string;
  deviceId: string;
  topic: string;
  rawPayload: string;
  receivedAt: string;
  status: ProcessingStatus;
  schemaVersion?: string;
  eventType?: string;
  recordedAt?: string;
  error?: string;
}) {
  db.prepare(`
    INSERT OR IGNORE INTO raw_iot_messages (
      id, message_id, device_id, topic, schema_version, event_type, raw_payload,
      recorded_at, received_at, processing_status, processing_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    input.messageId,
    input.deviceId,
    input.topic,
    input.schemaVersion ?? null,
    input.eventType ?? null,
    input.rawPayload,
    input.recordedAt ?? null,
    input.receivedAt,
    input.status,
    input.error ?? null
  );
}

function markRawMessage(messageId: string, status: ProcessingStatus, error?: string) {
  db.prepare('UPDATE raw_iot_messages SET processing_status = ?, processing_error = ? WHERE message_id = ?').run(status, error ?? null, messageId);
}

function authenticateDevice(deviceId: string) {
  return db.query<DeviceRow, [string]>('SELECT * FROM iot_devices WHERE id = ? OR mqtt_client_id = ?').get(deviceId, deviceId);
}

function updateDeviceHeartbeat(deviceId: string, envelope: Envelope, receivedAt: string) {
  db.prepare(`
    UPDATE iot_devices
    SET status = 'ONLINE',
        firmware_version = COALESCE(?, firmware_version),
        last_seen_at = ?,
        battery_pct = COALESCE(?, battery_pct),
        signal_strength = COALESCE(?, signal_strength),
        updated_at = ?
    WHERE id = ?
  `).run(
    envelope.firmwareVersion ?? stringOrNull(envelope.payload.currentFirmwareVersion),
    receivedAt,
    integerOrNull(envelope.payload.batteryPct),
    integerOrNull(envelope.payload.signalStrength),
    receivedAt,
    deviceId
  );

  const battery = integerOrNull(envelope.payload.batteryPct);
  if (battery !== null && battery <= 20) {
    createNotification('iot-low-battery', 'Low battery', `${deviceId} battery is at ${battery}%.`, 'warning');
  }
}

function persistDeviceEvent(envelope: Envelope, receivedAt: string, device: DeviceRow) {
  db.prepare(`
    INSERT OR IGNORE INTO device_events (
      id, message_id, device_id, worker_id, task_id, zone_id, event_type,
      payload, recorded_at, received_at, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    envelope.messageId,
    envelope.deviceId,
    device.assigned_worker_id ?? envelope.workerId ?? null,
    device.assigned_task_id ?? envelope.taskId ?? null,
    device.assigned_zone_id ?? envelope.zoneId ?? null,
    envelope.eventType,
    JSON.stringify(envelope.payload),
    envelope.recordedAt,
    receivedAt,
    new Date().toISOString()
  );
}

function persistRiskEvaluation(device: DeviceRow, risk: RiskEvaluation) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO risk_evaluations (
      id, worker_id, device_id, task_id, zone_id, risk_score, risk_level,
      intervention, break_minutes, reasons, policy_version, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    device.assigned_worker_id ?? 'unknown-worker',
    device.id,
    device.assigned_task_id,
    device.assigned_zone_id,
    risk.riskScore,
    risk.riskLevel,
    risk.intervention,
    risk.breakMinutes,
    JSON.stringify(risk.reasons),
    risk.policyVersion,
    new Date().toISOString()
  );

  return { id, ...risk };
}

function createBreakSession(input: {
  workerId: string;
  taskId?: string | null;
  deviceId: string;
  source: string;
  plannedMinutes: number;
  riskEvaluationId?: string | null;
}) {
  const now = new Date();
  const id = crypto.randomUUID();
  const endsAt = new Date(now.getTime() + input.plannedMinutes * 60_000);

  db.prepare(`
    INSERT INTO break_sessions (
      id, worker_id, task_id, device_id, source, status, planned_minutes,
      started_at, ends_at, risk_evaluation_id
    ) VALUES (?, ?, ?, ?, ?, 'BREAK_ACTIVE', ?, ?, ?, ?)
  `).run(id, input.workerId, input.taskId ?? null, input.deviceId, input.source, input.plannedMinutes, now.toISOString(), endsAt.toISOString(), input.riskEvaluationId ?? null);

  db.prepare('UPDATE workers SET status = ? WHERE id = ?').run('break', input.workerId);

  return {
    id,
    workerId: input.workerId,
    taskId: input.taskId ?? null,
    deviceId: input.deviceId,
    source: input.source,
    status: 'BREAK_ACTIVE',
    plannedMinutes: input.plannedMinutes,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString()
  };
}

function getCommand(commandId: string) {
  return db.query<CommandRow, [string]>('SELECT * FROM device_commands WHERE command_id = ?').get(commandId);
}

function createNotification(idPrefix: string, title: string, detail: string, tone: 'neutral' | 'success' | 'warning' | 'danger', targetWorkerId?: string | null) {
  db.prepare(`
    INSERT INTO notifications (
      id, title, detail, tone, target_label, target_section, target_worker_id, read
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(`${idPrefix}-${crypto.randomUUID()}`, title, detail, tone, 'Open IoT', 'dashboard', targetWorkerId ?? null);
}

function mapDevice(row: DeviceRow) {
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
    signalStrength: row.signal_strength,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateEnvironmentPayload(payload: Record<string, unknown>) {
  const temperatureC = numberOrNull(payload.temperatureC);
  const humidityPct = numberOrNull(payload.humidityPct);
  const batteryPct = integerOrNull(payload.batteryPct);
  const weather = stringOrNull(payload.weather);
  const surfaceCondition = stringOrNull(payload.surfaceCondition);

  if (temperatureC === null || temperatureC < -20 || temperatureC > 70) return 'temperatureC outside configured physical range';
  if (humidityPct === null || humidityPct < 0 || humidityPct > 100) return 'humidityPct must be between 0 and 100';
  if (batteryPct !== null && (batteryPct < 0 || batteryPct > 100)) return 'batteryPct must be between 0 and 100';
  if (weather && !weatherValues.has(weather)) return 'weather is not supported';
  if (surfaceCondition && !surfaceValues.has(surfaceCondition)) return 'surfaceCondition is not supported';
  return null;
}

function validateMotionPayload(payload: Record<string, unknown>) {
  const peakAccelerationG = numberOrNull(payload.peakAccelerationG);
  const tiltDegrees = numberOrNull(payload.tiltDegrees);
  const movementState = stringOrNull(payload.movementState);

  if (peakAccelerationG === null || peakAccelerationG < 0 || peakAccelerationG > 16) return 'peakAccelerationG outside configured range';
  if (tiltDegrees === null || tiltDegrees < 0 || tiltDegrees > 180) return 'tiltDegrees must be between 0 and 180';
  if (movementState && !movementValues.has(movementState)) return 'movementState is not supported';
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
