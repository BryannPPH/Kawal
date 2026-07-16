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
  policyVersion: 'fatigue-engine-v1';
};

export type FatigueEvaluation = {
  fatigueScore: number;
  fatigueLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  intervention: 'NONE' | 'BREAK_RECOMMENDED' | 'BREAK_REQUIRED';
  breakMinutes: number;
  reasons: string[];
  policyVersion: 'fatigue-engine-v1';
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

export function evaluateDeterministicFatigue(input: {
  continuousWorkMinutes?: number;
  taskWorkload?: string | null;
  temperatureC?: number | null;
  humidityPct?: number | null;
  restHistoryMinutes?: number;
  iotRestButton?: boolean;
  iotSosButton?: boolean;
}): FatigueEvaluation {
  let score = 10;
  const reasons: string[] = [];

  if ((input.continuousWorkMinutes ?? 0) >= 180) {
    score += 32;
    reasons.push('Continuous work duration exceeds 180 minutes');
  } else if ((input.continuousWorkMinutes ?? 0) >= 120) {
    score += 22;
    reasons.push('Continuous work duration exceeds 120 minutes');
  } else if ((input.continuousWorkMinutes ?? 0) >= 90) {
    score += 12;
    reasons.push('Continuous work duration exceeds 90 minutes');
  }

  if (input.taskWorkload?.toLowerCase() === 'high') {
    score += 18;
    reasons.push('High workload level');
  } else if (input.taskWorkload?.toLowerCase() === 'medium') {
    score += 8;
    reasons.push('Medium workload level');
  }

  if ((input.temperatureC ?? 0) >= 35) {
    score += 20;
    reasons.push('High temperature increases fatigue load');
  } else if ((input.temperatureC ?? 0) >= 32) {
    score += 10;
    reasons.push('Elevated temperature increases fatigue load');
  }

  if ((input.humidityPct ?? 0) >= 80) {
    score += 10;
    reasons.push('High humidity increases fatigue load');
  }

  if ((input.restHistoryMinutes ?? 0) >= 20) {
    score -= 14;
    reasons.push('Recent rest history reduces fatigue score');
  } else if ((input.restHistoryMinutes ?? 0) === 0) {
    score += 8;
    reasons.push('No recent rest history recorded');
  }

  if (input.iotRestButton) {
    score = Math.max(score, 70);
    reasons.push('Worker pressed IoT rest button');
  }

  if (input.iotSosButton) {
    reasons.push('IoT SOS is handled by Incident Center, not Fatigue Engine');
  }

  const fatigueScore = Math.max(0, Math.min(100, Math.round(score)));
  const fatigueLevel = fatigueScore >= 85 ? 'CRITICAL' : fatigueScore >= 65 ? 'HIGH' : fatigueScore >= 40 ? 'MEDIUM' : 'LOW';
  const intervention = fatigueLevel === 'CRITICAL' || fatigueLevel === 'HIGH' ? 'BREAK_REQUIRED' : fatigueLevel === 'MEDIUM' ? 'BREAK_RECOMMENDED' : 'NONE';

  return {
    fatigueScore,
    fatigueLevel,
    intervention,
    breakMinutes: fatigueLevel === 'CRITICAL' ? 20 : fatigueLevel === 'HIGH' ? 15 : fatigueLevel === 'MEDIUM' ? 10 : 0,
    reasons: reasons.length ? reasons : ['Fatigue inputs are within configured thresholds'],
    policyVersion: 'fatigue-engine-v1'
  };
}

export function evaluateDeterministicRisk(input: Parameters<typeof evaluateDeterministicFatigue>[0]): RiskEvaluation {
  const fatigue = evaluateDeterministicFatigue(input);
  const intervention = fatigue.intervention === 'BREAK_REQUIRED'
    ? 'REST_REQUIRED'
    : fatigue.intervention === 'BREAK_RECOMMENDED'
      ? 'REST_RECOMMENDED'
      : 'NONE';
  return {
    riskScore: fatigue.fatigueScore,
    riskLevel: fatigue.fatigueLevel,
    intervention,
    breakMinutes: fatigue.breakMinutes,
    reasons: fatigue.reasons,
    policyVersion: fatigue.policyVersion
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
