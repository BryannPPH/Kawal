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

- Manager: `manager@garudie.test` / `manager123`
- Worker: `worker@garudie.test` / `worker123`

## Scripts

```bash
bun install
bun run dev          # frontend + backend
bun run dev:frontend # frontend only
bun run dev:api      # backend only
bun run db:seed      # reset + seed SQLite
bun run build
bun run test
```

## API

- `GET /api/health`
- `GET /api/workforce`
- `POST /api/auth/login`
- `GET /api/workers`
- `GET /api/tasks`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
