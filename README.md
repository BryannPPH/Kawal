# Garudie Workforce

React + TypeScript dashboard with a Bun API backend and SQLite database for workforce assignment, task tracking, notifications, and payroll review.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Bun API server
- SQLite via `bun:sqlite`
- Lucide React icons
- Vitest

## Architecture

```txt
React dashboard
  -> Vite /api proxy
  -> Bun API
  -> SQLite database at data/garudie.sqlite
```

The database is initialized and seeded automatically when the API starts.

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
