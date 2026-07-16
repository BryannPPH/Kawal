# Supabase IoT Data Contract

The dashboard keeps calling the local Bun API. The Bun API reads from SQLite by default, or from Supabase when `DATA_SOURCE=supabase`.

Recommended hackathon flow:

```txt
IoT device / simulator
  -> Supabase HTTP, Edge Function, or Bun /api/dev/iot/messages
  -> Supabase tables
  -> Bun API
  -> React dashboard
```

## Required Environment

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_SCHEMA=public
```

Run `docs/supabase-schema.sql` first, then `docs/supabase-seed.sql`.

## Topic Format

```text
construction/v1/devices/{deviceId}/telemetry/environment
construction/v1/devices/{deviceId}/telemetry/motion
construction/v1/devices/{deviceId}/events/sos
construction/v1/devices/{deviceId}/events/rest-request
construction/v1/devices/{deviceId}/status/heartbeat
construction/v1/devices/{deviceId}/status/connection
construction/v1/devices/{deviceId}/commands/ack
construction/v1/devices/{deviceId}/commands/result
```

## Shared Envelope

Every IoT message uses one envelope. Keep `schemaVersion` at `1.0` until the contract changes.

```json
{
  "schemaVersion": "1.0",
  "messageId": "uuid-or-device-generated-id",
  "deviceId": "device-001",
  "workerId": "budi",
  "siteId": "site-001",
  "zoneId": "Zone C",
  "taskId": "steel-beam-install",
  "eventType": "ENVIRONMENT_TELEMETRY",
  "recordedAt": "2026-07-16T11:45:00.000Z",
  "sequenceNumber": 1721123100,
  "firmwareVersion": "0.1.0",
  "payload": {}
}
```

## Environment Telemetry

Topic: `construction/v1/devices/device-001/telemetry/environment`

```json
{
  "schemaVersion": "1.0",
  "messageId": "env-001",
  "deviceId": "device-001",
  "workerId": "budi",
  "siteId": "site-001",
  "zoneId": "Zone C",
  "taskId": "steel-beam-install",
  "eventType": "ENVIRONMENT_TELEMETRY",
  "recordedAt": "2026-07-16T11:45:00.000Z",
  "sequenceNumber": 1,
  "firmwareVersion": "0.1.0",
  "payload": {
    "temperatureC": 35.5,
    "humidityPct": 72,
    "weather": "HOT",
    "surfaceCondition": "WET",
    "craneActive": true,
    "restrictedZoneDetected": false,
    "batteryPct": 76,
    "signalStrength": -64
  }
}
```

## Motion Telemetry

Topic: `construction/v1/devices/device-001/telemetry/motion`

```json
{
  "schemaVersion": "1.0",
  "messageId": "motion-001",
  "deviceId": "device-001",
  "workerId": "budi",
  "siteId": "site-001",
  "zoneId": "Zone C",
  "taskId": "steel-beam-install",
  "eventType": "MOTION_TELEMETRY",
  "recordedAt": "2026-07-16T11:45:05.000Z",
  "sequenceNumber": 2,
  "firmwareVersion": "0.1.0",
  "payload": {
    "accelerationX": 1.2,
    "accelerationY": 0.8,
    "accelerationZ": 2.2,
    "peakAccelerationG": 6.8,
    "tiltDegrees": 82,
    "tiltChangeDegrees": 62,
    "movementState": "FALL_CANDIDATE",
    "inactiveSeconds": 18,
    "impactDetected": true,
    "fallCandidate": true,
    "batteryPct": 79
  }
}
```

## SOS Event

Topic: `construction/v1/devices/device-001/events/sos`

```json
{
  "schemaVersion": "1.0",
  "messageId": "sos-001",
  "deviceId": "device-001",
  "workerId": "budi",
  "siteId": "site-001",
  "zoneId": "Zone C",
  "taskId": "steel-beam-install",
  "eventType": "SOS_BUTTON_PRESSED",
  "recordedAt": "2026-07-16T11:46:00.000Z",
  "sequenceNumber": 3,
  "firmwareVersion": "0.1.0",
  "payload": {
    "buttonPressDurationMs": 1500,
    "batteryPct": 81
  }
}
```

## Rest Request Event

Topic: `construction/v1/devices/device-001/events/rest-request`

```json
{
  "schemaVersion": "1.0",
  "messageId": "rest-001",
  "deviceId": "device-001",
  "workerId": "budi",
  "siteId": "site-001",
  "zoneId": "Zone C",
  "taskId": "steel-beam-install",
  "eventType": "REST_BUTTON_PRESSED",
  "recordedAt": "2026-07-16T11:47:00.000Z",
  "sequenceNumber": 4,
  "firmwareVersion": "0.1.0",
  "payload": {
    "buttonPressDurationMs": 800,
    "reasonCode": "WORKER_REQUEST",
    "batteryPct": 80
  }
}
```

## Direct Supabase Inserts

If the IoT system writes directly to Supabase instead of going through Bun, insert into:

- `raw_iot_messages` for the immutable original message.
- `environment_readings` for environment telemetry.
- `motion_telemetry_summaries` for motion windows.
- `emergency_incidents` for SOS.
- `rest_requests` for worker break requests.
- `risk_evaluations` when a rule/edge function evaluates safety risk.

For the hackathon MVP, the simpler path is to let devices call a Supabase Edge Function or the Bun dev endpoint and let that function populate those derived tables.
