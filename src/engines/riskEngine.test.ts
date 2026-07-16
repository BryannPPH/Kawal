import { describe, expect, it } from 'vitest';
import { calculateRisk } from './riskEngine';
import type { TelemetryReading } from '../types/site';

const baseReading: TelemetryReading = {
  zoneId: 'assembly',
  temperature: 31,
  vibration: 1.2,
  humidity: 50,
  occupancy: 12,
  smokePpm: 0,
  updatedAt: '2026-07-16T00:00:00.000Z'
};

describe('riskEngine', () => {
  it('keeps normal telemetry at low risk', () => {
    const risk = calculateRisk(baseReading);

    expect(risk.level).toBe('low');
    expect(risk.score).toBeLessThan(42);
  });

  it('escalates severe telemetry to critical risk', () => {
    const risk = calculateRisk({
      ...baseReading,
      temperature: 52,
      vibration: 8,
      occupancy: 90,
      smokePpm: 8
    });

    expect(risk.level).toBe('critical');
    expect(risk.drivers).toContain('Smoke sensor above baseline');
  });
});
