# Kawal

React + TypeScript dashboard with a Bun API backend and SQLite or Supabase data source for workforce assignment, task tracking, notifications, IoT safety telemetry, and payroll review.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Bun API server
- SQLite via `bun:sqlite`
- Optional Supabase REST data source
- Lucide React icons
- Vitest

## Architecture

```txt
React dashboard
  -> Vite /api proxy
  -> Bun API
  -> SQLite database at data/garudie.sqlite or Supabase REST
```

SQLite is initialized and seeded automatically when the API starts. Supabase is enabled with `DATA_SOURCE=supabase`.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `docs/supabase-schema.sql`.
4. Run `docs/supabase-seed.sql`.
5. Copy `.env.example` to `.env` and set:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_SCHEMA=public
```

The React app still calls the Bun API. The Bun API fetches dashboard data from Supabase when `DATA_SOURCE=supabase`.

## PPE Computer Vision

Worker `Start Task` opens the camera first. The captured frame is sent to `POST /api/workers/:workerId/ppe-check`.

Local demo mode:

```env
PPE_CHECK_PROVIDER=demo
```

OpenAI vision mode:

```env
PPE_CHECK_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_PPE_MODEL=gpt-5
```

The backend asks the vision model to return helmet and harness detection as JSON, stores the result in `ppe_checks`, and only allows task start when the latest PPE check is `PASSED`.

## Demo Login

- Manager: `manager@gmail.com` / `mm`
- Worker: `worker@gmail.com` / `ww`
- HSE: `hse@gmail.com` / `hh`
- Foreman: `foreman@gmail.com` / `ff`

## Scripts

```bash
bun install
bun run dev          # frontend + backend
bun run dev:frontend # frontend only
bun run dev:api      # backend only
bun run db:seed      # reset + seed SQLite
bun run simulate sos-button
bun run build
bun run test
```

## API

- `GET /api/health`
- `GET /api/workforce`
- `POST /api/auth/login`
- `GET /api/workers`
- `GET /api/tasks`
- `POST /api/tasks` with task template, project, zone, quantity, unit, deadline, priority, notes
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `GET /api/iot/overview`
- `GET /api/iot/devices`
- `GET /api/incidents/active`
- `GET /api/incidents/center`
- `GET /api/rest-requests`
- `GET /api/workers/:workerId/risk/latest`
- `POST /api/sites/:siteId/environment/current`

## IoT Backend MVP

The IoT communication layer stores wearable telemetry, creates SOS incidents, creates rest requests, evaluates deterministic risk, records buzzer/rest commands, and tracks command acknowledgement/result states. See `docs/iot-architecture.md` for the MQTT topics, simulator commands, and development plan.

For Supabase mode, use `docs/supabase-iot-contract.md` for the JSON payloads that devices or simulators should send. The dev simulator can still call `POST /api/dev/iot/messages`; when `DATA_SOURCE=supabase`, that endpoint writes the derived IoT records to Supabase.
