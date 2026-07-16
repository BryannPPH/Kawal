create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('manager', 'worker', 'hse', 'foreman')),
  password_hash text not null
);

create table if not exists workers (
  id text primary key,
  name text not null,
  role text not null,
  task text not null,
  status text not null check (status in ('waiting', 'working', 'break', 'done', 'emergency')),
  zone text not null,
  time text not null,
  workload text not null,
  fatigue integer not null default 0,
  pay text not null,
  "match" integer not null default 0
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  owner text not null,
  location text not null default '',
  task_template text not null default '',
  project text not null default '',
  zone text not null default '',
  quantity numeric not null default 0,
  unit text not null default '',
  deadline text not null default '',
  priority text not null default '',
  notes text not null default '',
  scheduler_recommendation jsonb not null default '{}'::jsonb,
  status text not null,
  due text not null,
  tone text not null check (tone in ('neutral', 'success', 'warning', 'danger'))
);

create table if not exists notifications (
  id text primary key,
  title text not null,
  detail text not null,
  tone text not null check (tone in ('neutral', 'success', 'warning', 'danger')),
  target_label text not null,
  target_section text not null check (target_section in ('dashboard', 'workers', 'tasks', 'payroll', 'iot', 'incidents')),
  target_worker_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists iot_devices (
  id text primary key,
  mqtt_client_id text not null unique,
  name text not null,
  device_type text not null default 'WEARABLE',
  status text not null default 'OFFLINE',
  firmware_version text,
  assigned_worker_id text,
  assigned_site_id text,
  assigned_zone_id text,
  assigned_task_id text,
  last_seen_at timestamptz,
  battery_pct integer,
  signal_strength integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists raw_iot_messages (
  id text primary key default gen_random_uuid()::text,
  message_id text not null unique,
  device_id text not null,
  topic text not null,
  schema_version text,
  event_type text,
  raw_payload jsonb not null,
  recorded_at timestamptz,
  received_at timestamptz not null default now(),
  processing_status text not null,
  processing_error text
);

create table if not exists environment_readings (
  id text primary key default gen_random_uuid()::text,
  device_id text not null,
  site_id text,
  zone_id text,
  temperature_c numeric,
  humidity_pct numeric,
  weather text,
  surface_condition text,
  crane_active boolean not null default false,
  restricted_zone_detected boolean not null default false,
  battery_pct integer,
  signal_strength integer,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  valid boolean not null default true,
  validation_error text,
  data_source text not null default 'supabase-http'
);

create table if not exists motion_telemetry_summaries (
  id text primary key default gen_random_uuid()::text,
  device_id text not null,
  worker_id text,
  task_id text,
  zone_id text,
  window_start timestamptz not null,
  window_end timestamptz not null,
  maximum_acceleration_g numeric not null default 0,
  average_tilt_degrees numeric not null default 0,
  maximum_tilt_change_degrees numeric not null default 0,
  movement_state text not null,
  inactive_seconds integer not null default 0,
  impact_detected boolean not null default false,
  fall_candidate boolean not null default false,
  sample_count integer not null default 1
);

create table if not exists device_events (
  id text primary key default gen_random_uuid()::text,
  message_id text not null unique,
  device_id text not null,
  worker_id text,
  task_id text,
  zone_id text,
  event_type text not null,
  payload jsonb not null,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz not null default now()
);

create table if not exists device_commands (
  id text primary key default gen_random_uuid()::text,
  command_id text not null unique,
  device_id text not null,
  command_type text not null,
  priority text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  published_at timestamptz,
  acknowledged_at timestamptz,
  executed_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0,
  related_worker_id text,
  related_task_id text,
  related_incident_id text,
  related_rest_request_id text,
  related_break_session_id text,
  created_by text not null default 'garudie-api'
);

create table if not exists rest_requests (
  id text primary key,
  worker_id text not null,
  device_id text not null,
  task_id text,
  zone_id text,
  source text not null,
  status text not null,
  requested_at timestamptz not null,
  risk_score_at_request integer not null,
  environment_snapshot jsonb,
  sensor_snapshot jsonb,
  decision text,
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  break_session_id text
);

create table if not exists break_sessions (
  id text primary key,
  worker_id text not null,
  task_id text,
  device_id text not null,
  source text not null,
  status text not null,
  planned_minutes integer not null,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  completed_at timestamptz,
  risk_evaluation_id text
);

create table if not exists emergency_incidents (
  id text primary key,
  worker_id text not null,
  task_id text,
  zone_id text,
  state text not null,
  trigger_source text not null,
  device_id text not null,
  trigger_message_id text not null unique,
  opened_at timestamptz not null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  last_known_environment jsonb,
  last_known_motion jsonb,
  escalation_level integer not null default 1
);

create table if not exists risk_evaluations (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null,
  device_id text,
  task_id text,
  zone_id text,
  risk_score integer not null,
  risk_level text not null,
  intervention text not null,
  break_minutes integer not null default 0,
  reasons text not null,
  policy_version text not null,
  evaluated_at timestamptz not null default now()
);

create index if not exists raw_iot_messages_device_recorded_idx on raw_iot_messages (device_id, recorded_at desc);
create index if not exists environment_readings_zone_recorded_idx on environment_readings (zone_id, recorded_at desc);
create index if not exists motion_worker_window_idx on motion_telemetry_summaries (worker_id, window_end desc);
create index if not exists incidents_state_opened_idx on emergency_incidents (state, opened_at desc);
create index if not exists rest_requests_status_requested_idx on rest_requests (status, requested_at desc);
create index if not exists risk_worker_evaluated_idx on risk_evaluations (worker_id, evaluated_at desc);
