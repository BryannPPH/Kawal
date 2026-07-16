import type { ActivityLogEntry, Intervention, RiskScore, TelemetryReading } from '../types/site';

export function telemetryLog(reading: TelemetryReading): ActivityLogEntry {
  return {
    id: `${reading.zoneId}-${reading.updatedAt}`,
    at: reading.updatedAt,
    kind: 'telemetry',
    message: `${reading.zoneId} telemetry updated: ${reading.temperature.toFixed(1)}C, vibration ${reading.vibration.toFixed(1)}`
  };
}

export function riskLog(risk: RiskScore, at = new Date().toISOString()): ActivityLogEntry {
  return {
    id: `${risk.zoneId}-${risk.score}-${at}`,
    at,
    kind: 'risk',
    message: `${risk.zoneId} risk recalculated to ${risk.score} (${risk.level})`
  };
}

export function interventionLog(intervention: Intervention, at = new Date().toISOString()): ActivityLogEntry {
  return {
    id: `${intervention.id}-${at}`,
    at,
    kind: 'intervention',
    message: `${intervention.title} queued with ${intervention.etaMinutes} min ETA`
  };
}
