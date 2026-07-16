import type { RiskLevel, RiskScore, TelemetryReading } from '../types/site';

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function riskLevel(score: number): RiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 68) return 'high';
  if (score >= 42) return 'medium';
  return 'low';
}

export function calculateRisk(reading: TelemetryReading): RiskScore {
  const drivers: string[] = [];
  let score = 12;

  if (reading.temperature > 36) {
    score += (reading.temperature - 36) * 4.2;
    drivers.push('Temperature above operating range');
  }

  if (reading.vibration > 3.5) {
    score += (reading.vibration - 3.5) * 9.5;
    drivers.push('Vibration anomaly detected');
  }

  if (reading.humidity > 70) {
    score += (reading.humidity - 70) * 1.7;
    drivers.push('Humidity can degrade stored material');
  }

  if (reading.occupancy > 55) {
    score += (reading.occupancy - 55) * 0.7;
    drivers.push('High occupancy limits evacuation buffer');
  }

  if (reading.smokePpm > 4) {
    score += reading.smokePpm * 5.4;
    drivers.push('Smoke sensor above baseline');
  }

  const normalizedScore = Math.round(clamp(score));

  return {
    zoneId: reading.zoneId,
    score: normalizedScore,
    level: riskLevel(normalizedScore),
    drivers: drivers.length > 0 ? drivers : ['Telemetry inside expected range']
  };
}

export function calculateSiteRisk(readings: TelemetryReading[]) {
  return readings.map(calculateRisk).sort((a, b) => b.score - a.score);
}
