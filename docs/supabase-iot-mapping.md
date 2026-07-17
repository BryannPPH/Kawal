# Supabase IoT Mapping

Use this mode when Supabase already receives sensor rows from the wearable/IoT pipeline but the app tables are not created yet.

Set:

```env
DATA_SOURCE=supabase
SUPABASE_DATA_MODEL=iot
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_SCHEMA=public
```

## Tables Used

| Supabase table | App usage | Relationship |
| --- | --- | --- |
| `environment_condition` | Latest site environment, task temperature/humidity, IoT environment notification, risk context | Global stream. Latest `created_at` row is applied to the active site stub. |
| `work_hours` | Worker live status, duration, fatigue, current field task | Parent work session. `id` is referenced by `inactivity_log.work_hours_id` and `rest_break.work_hours_id`. |
| `inactivity_log` | No-movement alerts, near-miss reports, fatigue load | Child of `work_hours` through `work_hours_id`. |
| `rest_break` | Rest request/pending break, worker break status, manager rest queue | Child of `work_hours` through `work_hours_id`. |

`rest_break.status` is the manager decision contract: `PENDING` appears in the active queue, `APPROVED` starts the worker break state, and `REJECTED` closes the request without starting a break.
| `warning` | SOS/fall/no-movement incidents, notification bell, Incident Center | Event stream. No FK in the current table, so it is linked by time to the latest active worker/session stub. |

## Stubbed Until App Tables Exist

The following app concepts are stubbed from local demo constants and enriched with IoT rows:

- `users`
- `workers`
- `tasks`
- `notifications` read state
- device metadata
- assignment persistence

When you later add real app tables, switch `SUPABASE_DATA_MODEL=workforce`.
