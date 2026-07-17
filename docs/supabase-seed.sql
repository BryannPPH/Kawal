insert into users (id, name, email, role, password_hash) values
  ('manager-demo', 'Project Manager', 'manager@gmail.com', 'manager', 'b706e10508d884375481929d30651ad7257200f40d06815e87e3349fb06f46d3'),
  ('worker-demo', 'Budi Santoso', 'worker@gmail.com', 'worker', 'de538ef9dbf8c1f140e45c370fbe41ba841d67186e39807d20aa5c6b40b11089'),
  ('hse-demo', 'HSE Officer', 'hse@gmail.com', 'hse', '17d8beb49dc9e9a2d891a6ffa21d5b54483ab8f48f3f78dd0fd7ae4fb208f91b'),
  ('foreman-demo', 'Site Foreman', 'foreman@gmail.com', 'foreman', 'ca9832d666b79e4d0eea385c56e6abc0cfc756c247c51752b9eefb072541e94b')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  password_hash = excluded.password_hash;

insert into workers (id, name, role, task, status, zone, time, yesterday_worked_minutes, workload, fatigue, pay, "match") values
  ('budi', 'Budi Santoso', 'Steel Crew', 'Install steel beam', 'working', 'Zone C', '02:14', 485, 'Balanced', 24, 'Rp180.000', 94),
  ('ag', 'Agus Pratama', 'Crane Signal', 'Crane signal check', 'working', 'Zone B', '01:42', 535, 'Medium', 36, 'Rp150.000', 88),
  ('rizky', 'Rizky Maulana', 'General Crew', 'Awaiting steel crew', 'waiting', 'Gate 2', '00:00', 430, 'Low', 12, 'Rp95.000', 81),
  ('dewi', 'Dewi Lestari', 'Safety Support', 'Ready near Zone B', 'waiting', 'Zone B', '00:00', 475, 'Low', 18, 'Rp120.000', 84),
  ('sari', 'Sari Ningsih', 'Scaffold Crew', 'Mandatory break', 'break', 'Rest Area', '00:12', 565, 'Medium', 58, 'Rp145.000', 76),
  ('dimas', 'Dimas Ardi', 'Inspector', 'Scaffold inspection', 'done', 'Zone A', '03:20', 410, 'High', 44, 'Rp210.000', 89)
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  task = excluded.task,
  status = excluded.status,
  zone = excluded.zone,
  time = excluded.time,
  yesterday_worked_minutes = excluded.yesterday_worked_minutes,
  workload = excluded.workload,
  fatigue = excluded.fatigue,
  pay = excluded.pay,
  "match" = excluded."match";

insert into tasks (
  id, title, owner, location, task_template, project, zone, quantity, unit,
  deadline, priority, intensity, notes, scheduler_recommendation, status, due, tone
) values
  (
    'steel-beam-install', 'Steel beam install', 'Budi Santoso', 'Zone C',
    'Steel beam install', 'Core Tower', 'Zone C', 8, 'beams', '2h 15m',
    'High', 'High', '',
    '{"recommendedWorkerCount":3,"estimatedTaskDuration":"2h 30m","recommendedStartTime":"Next available safe window","estimatedCompletionTime":"Before current shift end","selectedWorkerRecommendations":[{"workerId":"budi","workerName":"Budi Santoso","explanation":"Strong task match and currently assigned near the work zone."}],"expectedProductivityRate":"High with 3-worker crew","deadlineFeasibilityStatus":"Feasible with safety review","requiredPpeAndCertifications":["Helmet","Safety shoes","Harness if working at height"],"dependencyStatus":"No blocking dependency in placeholder scheduler","currentEnvironmentalConditions":"Uses latest Supabase telemetry when scheduler is deployed","safetyAndOperationalWarnings":["Supervisor confirmation required before start"],"schedulerStatus":"Placeholder Supabase seed."}'::jsonb,
    'In progress', '2h 15m', 'warning'
  ),
  (
    'harness-audit', 'Harness audit', 'Dewi Lestari', 'Zone B',
    'Harness audit', 'Core Tower', 'Zone B', 18, 'workers', '45m',
    'Medium', 'Medium', '',
    '{"recommendedWorkerCount":2,"estimatedTaskDuration":"1h 30m","recommendedStartTime":"Next available safe window","estimatedCompletionTime":"Same day","selectedWorkerRecommendations":[{"workerId":"dewi","workerName":"Dewi Lestari","explanation":"Safety support role fits audit work."}],"expectedProductivityRate":"Standard crew output","deadlineFeasibilityStatus":"Feasible","requiredPpeAndCertifications":["Helmet","Safety shoes"],"dependencyStatus":"No blocking dependency","currentEnvironmentalConditions":"Pending latest telemetry","safetyAndOperationalWarnings":["Standard toolbox check required"],"schedulerStatus":"Placeholder Supabase seed."}'::jsonb,
    'Assigned', '45m', 'neutral'
  ),
  (
    'scaffold-photo-proof', 'Scaffold photo proof', 'Dimas Ardi', 'Zone A',
    'Scaffold photo proof', 'Podium', 'Zone A', 1, 'report', 'Ready',
    'Low', 'Low', '',
    '{"recommendedWorkerCount":1,"estimatedTaskDuration":"30m","recommendedStartTime":"Now","estimatedCompletionTime":"Ready","selectedWorkerRecommendations":[{"workerId":"dimas","workerName":"Dimas Ardi","explanation":"Inspector is assigned to the report."}],"expectedProductivityRate":"One report","deadlineFeasibilityStatus":"Feasible","requiredPpeAndCertifications":["Helmet"],"dependencyStatus":"No blocking dependency","currentEnvironmentalConditions":"Pending latest telemetry","safetyAndOperationalWarnings":[],"schedulerStatus":"Placeholder Supabase seed."}'::jsonb,
    'Review', 'Ready', 'success'
  ),
  (
    'wet-surface-cleanup', 'Wet surface cleanup', 'Unassigned', 'Zone C',
    'Wet surface cleanup', 'Podium', 'Zone C', 120, 'm2', '30m',
    'Critical', 'High', '',
    '{"recommendedWorkerCount":3,"estimatedTaskDuration":"2h 30m","recommendedStartTime":"Next safe available window","estimatedCompletionTime":"Before current shift end","selectedWorkerRecommendations":[{"workerId":"budi","workerName":"Budi Santoso","explanation":"High match and already near Zone C."}],"expectedProductivityRate":"High with 3-worker crew","deadlineFeasibilityStatus":"Needs supervisor confirmation","requiredPpeAndCertifications":["Helmet","Safety shoes","Supervisor safety sign-off"],"dependencyStatus":"Confirm restricted area status","currentEnvironmentalConditions":"Wet surface reported","safetyAndOperationalWarnings":["Supervisor confirmation required before start"],"schedulerStatus":"Placeholder Supabase seed."}'::jsonb,
    'Open', '30m', 'danger'
  )
on conflict (id) do update set
  title = excluded.title,
  owner = excluded.owner,
  location = excluded.location,
  task_template = excluded.task_template,
  project = excluded.project,
  zone = excluded.zone,
  quantity = excluded.quantity,
  unit = excluded.unit,
  deadline = excluded.deadline,
  priority = excluded.priority,
  intensity = excluded.intensity,
  notes = excluded.notes,
  scheduler_recommendation = excluded.scheduler_recommendation,
  status = excluded.status,
  due = excluded.due,
  tone = excluded.tone;

insert into notifications (id, title, detail, tone, target_label, target_section, target_worker_id, read, created_at) values
  ('hazard-zone-c', 'Hazard report', 'Wet surface reported near Zone C.', 'danger', 'Open Tasks', 'tasks', null, false, now() - interval '4 minutes'),
  ('fatigue-sari', 'Fatigue watch', 'Sari reached the break threshold.', 'warning', 'View Worker', 'workers', 'sari', false, now() - interval '18 minutes'),
  ('review-dimas', 'Review ready', 'Dimas uploaded scaffold inspection proof.', 'success', 'Review Tasks', 'tasks', null, false, now() - interval '1 hour')
on conflict (id) do update set
  title = excluded.title,
  detail = excluded.detail,
  tone = excluded.tone,
  target_label = excluded.target_label,
  target_section = excluded.target_section,
  target_worker_id = excluded.target_worker_id,
  read = excluded.read,
  created_at = excluded.created_at;

insert into iot_devices (
  id, mqtt_client_id, name, device_type, status, firmware_version,
  assigned_worker_id, assigned_site_id, assigned_zone_id, assigned_task_id,
  last_seen_at, battery_pct, signal_strength, created_at, updated_at
) values (
  'device-001', 'device-001', 'Budi Wearable', 'WEARABLE', 'ONLINE', '0.1.0',
  'budi', 'site-001', 'Zone C', 'steel-beam-install',
  now(), 82, -61, now(), now()
)
on conflict (id) do update set
  mqtt_client_id = excluded.mqtt_client_id,
  name = excluded.name,
  device_type = excluded.device_type,
  status = excluded.status,
  firmware_version = excluded.firmware_version,
  assigned_worker_id = excluded.assigned_worker_id,
  assigned_site_id = excluded.assigned_site_id,
  assigned_zone_id = excluded.assigned_zone_id,
  assigned_task_id = excluded.assigned_task_id,
  last_seen_at = excluded.last_seen_at,
  battery_pct = excluded.battery_pct,
  signal_strength = excluded.signal_strength,
  updated_at = now();
