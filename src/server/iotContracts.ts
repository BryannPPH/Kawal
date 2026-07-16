export const defaultTopicPrefix = 'construction/v1';

export type ParsedTopic = {
  deviceId: string;
  category: 'telemetry' | 'events' | 'status' | 'commands';
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

export type RiskEvaluation = {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  intervention: 'NONE' | 'REST_RECOMMENDED' | 'REST_REQUIRED' | 'SOS_REQUIRED';
  breakMinutes: number;
  reasons: string[];
  policyVersion: 'risk-policy-v1';
};

export function parseIoTTopic(topic: string, topicPrefix = defaultTopicPrefix): ParsedTopic | null {
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
    category: category as ParsedTopic['category'],
    kind
  };
}

export function validateIoTEnvelope(value: unknown, topicDeviceId?: string): { ok: true; envelope: Envelope } | { ok: false; error: string } {
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

export function evaluateDeterministicRisk(input: {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
