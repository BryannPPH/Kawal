export type FatigueInput = {
  temperatureC?: number | null;
  humidityPct?: number | null;
  continuousWorkMinutes?: number;
  workloadLevel?: string | null;
  restHistoryMinutes?: number;
  iotRestButton?: boolean;
  iotSosButton?: boolean;
};

export type FatigueEvaluation = {
  fatigueScore: number;
  fatigueLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  intervention: 'NONE' | 'BREAK_RECOMMENDED' | 'BREAK_REQUIRED';
  breakMinutes: number;
  reasons: string[];
  policyVersion: 'fatigue-engine-v1';
};

export function computeFatigue(input: FatigueInput): FatigueEvaluation {
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

  if (input.workloadLevel?.toLowerCase() === 'high') {
    score += 18;
    reasons.push('High workload level');
  } else if (input.workloadLevel?.toLowerCase() === 'medium') {
    score += 8;
    reasons.push('Medium workload level');
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
