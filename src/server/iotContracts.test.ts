import { describe, expect, it } from 'vitest';
import { evaluateDeterministicFatigue, parseIoTTopic, validateIoTEnvelope } from './iotContracts';

const validEnvelope = {
  schemaVersion: '1.0',
  messageId: 'message-001',
  deviceId: 'device-001',
  workerId: 'budi',
  siteId: 'site-001',
  zoneId: 'Zone C',
  taskId: 'steel-beam-install',
  eventType: 'ENVIRONMENT_TELEMETRY',
  recordedAt: '2026-07-16T14:30:00.000Z',
  sequenceNumber: 1024,
  firmwareVersion: '0.1.0',
  payload: {
    temperatureC: 34.7
  }
};

describe('IoT contracts', () => {
  it('parses versioned device topics', () => {
    expect(parseIoTTopic('construction/v1/devices/device-001/telemetry/environment')).toEqual({
      deviceId: 'device-001',
      category: 'telemetry',
      kind: 'environment'
    });
  });

  it('rejects unsupported topics', () => {
    expect(parseIoTTopic('construction/v1/sites/site-001/telemetry/environment')).toBeNull();
  });

  it('accepts valid message envelopes', () => {
    expect(validateIoTEnvelope(validEnvelope, 'device-001')).toMatchObject({ ok: true });
  });

  it('rejects messages whose device does not match the topic', () => {
    expect(validateIoTEnvelope(validEnvelope, 'device-002')).toEqual({
      ok: false,
      error: 'deviceId does not match topic'
    });
  });

  it('returns deterministic break intervention decisions for high-fatigue work', () => {
    const decision = evaluateDeterministicFatigue({
      continuousWorkMinutes: 140,
      taskWorkload: 'High',
      temperatureC: 35.5,
      humidityPct: 82
    });

    expect(decision).toMatchObject({
      fatigueLevel: 'CRITICAL',
      intervention: 'BREAK_REQUIRED',
      breakMinutes: 20,
      policyVersion: 'fatigue-engine-v1'
    });
    expect(decision.reasons).toContain('High temperature increases fatigue load');
  });

  it('keeps SOS separate from fatigue intervention logic', () => {
    const decision = evaluateDeterministicFatigue({
      continuousWorkMinutes: 20,
      taskWorkload: 'Low',
      temperatureC: 27,
      humidityPct: 55,
      restHistoryMinutes: 25,
      iotSosButton: true
    });

    expect(decision.intervention).toBe('NONE');
    expect(decision.reasons).toContain('IoT SOS is handled by Incident Center, not Fatigue Engine');
  });
});
