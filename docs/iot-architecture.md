# Kawal IoT Backend MVP

## Current Repository Audit

- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Backend: Bun HTTP API in `src/server/index.ts`.
- Database: SQLite through `bun:sqlite`; no ORM.
- Authentication: demo email/password login from the `users` table, with `manager` and `worker` roles.
- Existing domain tables: `users`, `workers`, `tasks`, `notifications`.
- Existing API style: plain Bun route checks returning JSON.
- Real-time mechanism: none yet; frontend currently fetches API data.
- Environment conventions: `.env.example`, `API_PORT`, and MQTT variables.
- Tests: Vitest.
- Docker/deployment: no Docker setup currently exists.

## Implemented Slice

The backend now stores and processes IoT data through deterministic rules:

- `iot_devices`
- `raw_iot_messages`
- `environment_readings`
- `motion_telemetry_summaries`
- `device_events`
- `device_commands`
- `rest_requests`
- `break_sessions`
- `emergency_incidents`
- `fatigue_evaluations`
- `risk_evaluations` legacy compatibility table
- `data_collection_status`

The MVP has a seeded device:

```text
device-001 -> worker budi -> Zone C -> steel-beam-install
```

## Topic Contract

Device-to-backend:

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

Backend-to-device command records:

```text
construction/v1/devices/{deviceId}/commands/buzzer
construction/v1/devices/{deviceId}/commands/rest
construction/v1/devices/{deviceId}/commands/emergency
construction/v1/devices/{deviceId}/commands/status-request
```

The current prototype records command publication in SQLite. A physical MQTT bridge should publish those command rows to the broker with QoS 1 and no retain flag.

## Deterministic Policy Boundary

No ML model is used for SOS, rest approval, buzzer command delivery, command acknowledgement, or emergency state. Fatigue decisions use `fatigue-engine-v1` and store the fatigue score, intervention, break duration, and reasons. SOS button events are handled by the Incident Center and are not used as Fatigue Engine inputs.

## Local Simulation

Start the API and frontend:

```bash
bun run dev
```

Run scenarios:

```bash
bun run simulate normal-shift
bun run simulate high-temperature
bun run simulate rest-button
bun run simulate sos-button
bun run simulate fall-candidate
bun run simulate buzzer-success
bun run simulate buzzer-failure
bun run simulate offline-device
bun run simulate reset
```

Useful API checks:

```bash
curl http://127.0.0.1:3001/api/iot/overview
curl http://127.0.0.1:3001/api/incidents/active
curl http://127.0.0.1:3001/api/rest-requests
curl http://127.0.0.1:3001/api/workers/budi/fatigue/latest
```

## Development Plan

1. Backend MVP, completed in this slice:
   - SQLite IoT tables.
   - Seeded wearable device.
   - Message validation and topic parsing.
   - Raw-message storage and deduplication.
   - Environment and motion persistence.
   - Manual SOS incident flow.
   - Manual rest request flow.
   - Deterministic Fatigue Engine.
   - Buzzer/rest command records.
   - Command ack/result handling.
   - Heartbeat/offline maintenance.
   - HTTP endpoints and simulator.

2. MQTT bridge:
   - Add an MQTT client dependency.
   - Connect using `MQTT_BROKER_URL` and credentials.
   - Subscribe to the wildcard topics.
   - Forward incoming payloads into `processIoTMessage`.
   - Publish `device_commands` rows to command topics with QoS 1.
   - Mark broker publish failures separately from device execution failures.

3. Frontend integration:
   - Poll or stream `/api/iot/overview`.
   - Show IoT connected/offline states.
   - Show command pending, acknowledged, activated, and failed states.
   - Show active SOS incidents and rest requests on the manager route.
   - Show active break countdown on the worker route using server `ends_at`.

4. Hardening:
   - Replace demo auth with request authorization.
   - Add per-device credentials and topic ACLs.
   - Add migration files if the project adopts a migration runner.
   - Add integration tests that run under Bun against a temporary SQLite file.
   - Add Docker only if the repository introduces Docker for the existing app.
