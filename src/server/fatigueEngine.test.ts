import { describe, expect, it } from 'vitest';
import { computeFatigue } from './fatigueEngine';

describe('Fatigue Engine', () => {
  it('requires a break when cumulative fatigue crosses the high threshold', () => {
    const evaluation = computeFatigue({
      temperatureC: 36,
      humidityPct: 84,
      continuousWorkMinutes: 150,
      workloadLevel: 'High',
      restHistoryMinutes: 0
    });

    expect(evaluation).toMatchObject({
      fatigueLevel: 'CRITICAL',
      intervention: 'BREAK_REQUIRED',
      breakMinutes: 20,
      policyVersion: 'fatigue-engine-v1'
    });
  });

  it('treats SOS as an Incident Center signal instead of fatigue input', () => {
    const evaluation = computeFatigue({
      temperatureC: 26,
      humidityPct: 55,
      continuousWorkMinutes: 20,
      workloadLevel: 'Low',
      restHistoryMinutes: 25,
      iotSosButton: true
    });

    expect(evaluation.intervention).toBe('NONE');
    expect(evaluation.reasons).toContain('IoT SOS is handled by Incident Center, not Fatigue Engine');
  });
});
