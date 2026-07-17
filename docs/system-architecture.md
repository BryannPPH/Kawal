# Kawal System Architecture

Repository-derived architecture for the current Kawal workforce safety system.

## 1. Input Layer

### Worker App Inputs
- Worker login and role routing
- Start / pause / complete task actions
- PPE camera capture before starting work
- Completion proof photo capture or upload
- SOS button
- Rest request button
- Hazard report form

### Manager App Inputs
- Task creation wizard
- Recommended assignment approval
- Worker rest grant
- Completion proof accept / reject
- Incident acknowledge / escalate / resolve
- Notification navigation and review

### IoT / Simulator Inputs
- Local simulator script: `scripts/simulate-iot.ts`
- MQTT-style topic contract in `src/server/iotContracts.ts`
- Supported device topics:
  - environment telemetry
  - motion telemetry
  - SOS event
  - rest request event
  - heartbeat / connection status
  - command acknowledgement / result

### Supabase IoT Inputs
When `DATA_SOURCE=supabase` and `SUPABASE_DATA_MODEL=iot`, the app reads:
- `environment_condition`
- `work_hours`
- `warning`
- `inactivity_log`
- `rest_break`

## 2. Ingestion and Adapter Layer

### Bun API Gateway
- File: `src/server/index.ts`
- Runtime: `Bun.serve`
- Responsibilities:
  - auth endpoints
  - workforce API
  - worker action API
  - task API
  - IoT API
  - incident API
  - rest request API
  - Chronos forecast proxy

### Local IoT Processor
- Files:
  - `src/server/iot.ts`
  - `src/server/iotContracts.ts`
- Responsibilities:
  - validate device envelopes
  - parse IoT topics
  - persist raw IoT messages
  - create SOS incidents
  - create rest requests
  - store telemetry summaries
  - record device commands

### Supabase Adapter
- File: `src/server/supabase.ts`
- Modes:
  - `workforce`: reads full app tables from Supabase
  - `iot`: reads the current IoT tables and enriches local app stubs
- Runtime overlays in IoT mode:
  - notification read state
  - incident action state
  - task proof review state

### Worker Action Adapter
- File: `src/server/workerActions.ts`
- Handles worker-facing workflow:
  - start task
  - PPE verification
  - completion proof submission
  - hazard reporting
  - rest request
  - SOS trigger

## 3. State and Storage Layer

### Local SQLite
- File: `src/server/database.ts`
- Database path: `data/garudie.sqlite`
- Main app tables:
  - `users`
  - `workers`
  - `tasks`
  - `notifications`
  - `ppe_checks`

### Local IoT Tables
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
- `risk_evaluations`
- `data_collection_status`

### Supabase Storage
- Workforce schema:
  - defined in `docs/supabase-schema.sql`
- Seed data:
  - defined in `docs/supabase-seed.sql`
- IoT table mapping:
  - defined in `docs/supabase-iot-mapping.md`

### Browser Storage
- File: `src/lib/authStorage.ts`
- Used for:
  - demo auth session
  - current user role
  - route persistence

## 4. Decision and Engine Layer

### Worker Assignment Engine
- File: `src/server/workerAssignmentEngine.ts`
- Ranks available workers using:
  - availability
  - skill match
  - certification match
  - zone match
  - workload
  - fatigue
  - cold-start fallback

### Capacity Estimator
- File: `src/server/capacityEstimator.ts`
- Estimates:
  - worker-hours
  - crew size
  - task duration
  - finish time
  - feasibility
  - workload level

### Fatigue Engine
- File: `src/server/fatigueEngine.ts`
- Produces:
  - fatigue score
  - fatigue level
  - rest intervention
  - reason list

### Risk and Incident Engine
- File: `src/server/iot.ts`
- Handles:
  - SOS incidents
  - fall / warning signals
  - restricted-zone risk
  - incident state transitions
  - active incident center

### Notification and Activity Logger
- Implemented across:
  - `src/server/database.ts`
  - `src/server/workerActions.ts`
  - `src/server/supabase.ts`
- Produces manager and worker notifications for:
  - assignment
  - PPE verification
  - completion proof review
  - SOS
  - rest request
  - hazard report
  - environment updates

## 5. AI and Forecast Layer

### Chronos Forecast Service
- Service: `services/chronos_api/main.py`
- Framework: FastAPI
- Model: `amazon/chronos-2`
- Endpoint: `POST /forecast`
- Backend client: `src/server/chronosForecasting.ts`
- Used for:
  - task scheduler forecast
  - productivity forecast
  - delay prediction
  - suggested additional crew
  - rest recommendation context

### PPE Computer Vision
- File: `src/server/ppe.ts`
- Providers:
  - `demo`
  - `openai`
- OpenAI mode checks:
  - safety helmet
  - safety harness
  - confidence
  - pass / fail / review status

### Deterministic Safety Boundary
- SOS handling is not ML-based.
- Rest button handling is not ML-based.
- Device command acknowledgement is not ML-based.
- These flows are deterministic and auditable.

## 6. Backend API Layer

### Core API
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/workforce`
- `GET /api/users`
- `GET /api/workers`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

### Worker API
- `GET /api/workers/:workerId/app`
- `POST /api/workers/:workerId/status`
- `POST /api/workers/:workerId/ppe-check`
- `POST /api/workers/:workerId/complete`
- `POST /api/workers/:workerId/hazards`
- `POST /api/workers/:workerId/rest-request`
- `POST /api/workers/:workerId/sos`

### Manager Task API
- `PATCH /api/tasks/:taskId/auto-assign`
- `PATCH /api/tasks/:taskId/review/accept`
- `PATCH /api/tasks/:taskId/review/reject`

### IoT and Incident API
- `GET /api/iot/overview`
- `GET /api/iot/devices`
- `POST /api/iot/devices/:deviceId/assign`
- `POST /api/iot/devices/:deviceId/unassign`
- `POST /api/iot/devices/:deviceId/commands/buzzer`
- `GET /api/incidents/active`
- `GET /api/incidents/center`
- `POST /api/incidents/:incidentId/acknowledge`
- `POST /api/incidents/:incidentId/escalate`
- `POST /api/incidents/:incidentId/resolve`
- `GET /api/rest-requests`
- `POST /api/rest-requests/:requestId/approve`
- `POST /api/rest-requests/:requestId/reject`

### Chronos API Proxy
- `POST /api/chronos/forecast`
- Forwards requests to:
  - `CHRONOS_API_URL`
  - default: `http://127.0.0.1:8001`

## 7. Frontend Application Layer

### React Shell
- File: `src/App.tsx`
- Routes:
  - `/login`
  - `/manager`
  - `/worker`
- Role routing:
  - worker users go to Worker App
  - manager and other non-worker users go to Manager Dashboard

### Manager Dashboard
- Entry: `src/pages/manager/ManagerPage.tsx`
- Views:
  - Dashboard
  - Workers
  - Tasks
  - IoT Safety Panel
  - Incident Center
  - Notifications
  - Payroll
- Shared data hook:
  - `src/hooks/useWorkforceData.ts`
  - polls `/api/workforce` every 5 seconds

### Worker Mobile App
- Entry: `src/pages/worker/WorkerPage.tsx`
- Features:
  - mobile phone frame UI
  - home task state
  - PPE camera flow
  - task proof camera / upload flow
  - worker notifications
  - SOS button
  - rest request
  - hazard reporting
  - profile and logout

## 8. Current System Flow

```text
Worker App / Manager App / IoT Simulator / Supabase IoT Tables
        |
        v
Bun API Gateway
        |
        +--> Worker Actions
        +--> IoT Processor
        +--> Supabase Adapter
        +--> Task and Assignment APIs
        |
        v
Decision Engines
        |
        +--> Assignment Engine
        +--> Capacity Estimator
        +--> Fatigue Engine
        +--> Risk and Incident Engine
        +--> PPE Vision Check
        +--> Chronos Forecast Client
        |
        v
Storage
        |
        +--> SQLite local database
        +--> Supabase REST
        +--> Runtime IoT overlays
        |
        v
React Dashboards
        |
        +--> Manager operational dashboard
        +--> Worker mobile workflow
```

## 9. Runtime Modes

### Local Demo Mode
```env
DATA_SOURCE=sqlite
PPE_CHECK_PROVIDER=demo
```

Uses:
- Bun API
- SQLite database
- seeded workforce data
- local IoT simulator
- demo PPE pass result

### Supabase IoT Mode
```env
DATA_SOURCE=supabase
SUPABASE_DATA_MODEL=iot
```

Uses:
- Supabase IoT tables as live input
- local demo workers/tasks enriched with IoT rows
- runtime overlays for incident actions and task proof review

### Supabase Workforce Mode
```env
DATA_SOURCE=supabase
SUPABASE_DATA_MODEL=workforce
```

Uses:
- Supabase app tables from `docs/supabase-schema.sql`
- Bun API remains the backend gateway
- React still calls `/api/*`

### Chronos Mode
```env
CHRONOS_API_URL=http://127.0.0.1:8001
```

Uses:
- FastAPI Chronos service
- `amazon/chronos-2`
- scheduler and rest recommendation forecast context

## 10. Pitch Summary

Kawal is a workforce safety operating system.

It combines worker mobile workflows, manager dashboards, IoT telemetry, PPE computer vision, deterministic safety rules, and Chronos productivity forecasting into one operational loop:

```text
Sense -> Verify -> Assign -> Monitor -> Intervene -> Review -> Learn
```

