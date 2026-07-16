import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { notifications, tasks, workers } from '../constants/workforce';
import type { AuthUser, ManagerSection, UserRole } from '../types/navigation';
import type { Notification, SchedulerRecommendation, Task, Tone, Worker, WorkerStatus, WorkforceData } from '../types/workforce';
import { estimateCapacity, inferWorkload } from './capacityEstimator';
import { chronosUnavailableForecast, forecastProductivity } from './chronosForecasting';
import type { ChronosForecastInput } from './chronosForecasting';
import { recommendWorkers } from './workerAssignmentEngine';

const databasePath = join(process.cwd(), 'data', 'garudie.sqlite');

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath, {
  create: true
});

const users = [
  {
    id: 'manager-demo',
    name: 'Project Manager',
    email: 'manager@gmail.com',
    role: 'manager',
    password: 'mm'
  },
  {
    id: 'worker-demo',
    name: 'Budi Santoso',
    email: 'worker@gmail.com',
    role: 'worker',
    password: 'ww'
  },
  {
    id: 'hse-demo',
    name: 'HSE Officer',
    email: 'hse@gmail.com',
    role: 'hse',
    password: 'hh'
  },
  {
    id: 'foreman-demo',
    name: 'Site Foreman',
    email: 'foreman@gmail.com',
    role: 'foreman',
    password: 'ff'
  }
] satisfies Array<AuthUser & { password: string }>;

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase() {
  createTables();
  seedDatabase();
}

export function resetAndSeedDatabase() {
  createTables();
  db.exec(`
    DELETE FROM data_collection_status;
    DELETE FROM fatigue_evaluations;
    DELETE FROM ppe_checks;
    DELETE FROM risk_evaluations;
    DELETE FROM emergency_incidents;
    DELETE FROM break_sessions;
    DELETE FROM rest_requests;
    DELETE FROM device_commands;
    DELETE FROM device_events;
    DELETE FROM motion_telemetry_summaries;
    DELETE FROM environment_readings;
    DELETE FROM raw_iot_messages;
    DELETE FROM iot_devices;
    DELETE FROM notifications;
    DELETE FROM tasks;
    DELETE FROM workers;
    DELETE FROM users;
  `);
  seedDatabase();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL,
      zone TEXT NOT NULL,
      time TEXT NOT NULL,
      workload TEXT NOT NULL,
      fatigue INTEGER NOT NULL,
      pay TEXT NOT NULL,
      match INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      owner TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      task_template TEXT NOT NULL DEFAULT '',
      project TEXT NOT NULL DEFAULT '',
      zone TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT '',
      temperature_c REAL,
      humidity_pct REAL,
      task_workload TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      scheduler_recommendation TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      due TEXT NOT NULL,
      tone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      tone TEXT NOT NULL,
      target_label TEXT NOT NULL,
      target_section TEXT NOT NULL,
      target_worker_id TEXT,
      read INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ppe_checks (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      task_id TEXT,
      helmet_detected INTEGER NOT NULL,
      harness_detected INTEGER NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      reason TEXT NOT NULL,
      checked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS iot_devices (
      id TEXT PRIMARY KEY,
      mqtt_client_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      status TEXT NOT NULL,
      firmware_version TEXT,
      assigned_worker_id TEXT,
      assigned_site_id TEXT,
      assigned_zone_id TEXT,
      assigned_task_id TEXT,
      last_seen_at TEXT,
      battery_pct INTEGER,
      signal_strength INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_iot_messages (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      schema_version TEXT,
      event_type TEXT,
      raw_payload TEXT NOT NULL,
      recorded_at TEXT,
      received_at TEXT NOT NULL,
      processing_status TEXT NOT NULL,
      processing_error TEXT
    );

    CREATE TABLE IF NOT EXISTS environment_readings (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      site_id TEXT,
      zone_id TEXT,
      temperature_c REAL,
      humidity_pct REAL,
      weather TEXT,
      surface_condition TEXT,
      crane_active INTEGER NOT NULL DEFAULT 0,
      restricted_zone_detected INTEGER NOT NULL DEFAULT 0,
      battery_pct INTEGER,
      signal_strength INTEGER,
      recorded_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      valid INTEGER NOT NULL,
      validation_error TEXT,
      data_source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS motion_telemetry_summaries (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      worker_id TEXT,
      task_id TEXT,
      zone_id TEXT,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      maximum_acceleration_g REAL NOT NULL,
      average_tilt_degrees REAL NOT NULL,
      maximum_tilt_change_degrees REAL NOT NULL,
      movement_state TEXT NOT NULL,
      inactive_seconds INTEGER NOT NULL,
      impact_detected INTEGER NOT NULL,
      fall_candidate INTEGER NOT NULL,
      sample_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_events (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      worker_id TEXT,
      task_id TEXT,
      zone_id TEXT,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_commands (
      id TEXT PRIMARY KEY,
      command_id TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      command_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      published_at TEXT,
      acknowledged_at TEXT,
      executed_at TEXT,
      completed_at TEXT,
      failure_reason TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      related_worker_id TEXT,
      related_task_id TEXT,
      related_incident_id TEXT,
      related_rest_request_id TEXT,
      related_break_session_id TEXT,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rest_requests (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      task_id TEXT,
      zone_id TEXT,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      risk_score_at_request INTEGER NOT NULL,
      fatigue_score_at_request INTEGER,
      environment_snapshot TEXT,
      sensor_snapshot TEXT,
      decision TEXT,
      decision_reason TEXT,
      decided_by TEXT,
      decided_at TEXT,
      break_session_id TEXT
    );

    CREATE TABLE IF NOT EXISTS break_sessions (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      task_id TEXT,
      device_id TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      planned_minutes INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      completed_at TEXT,
      risk_evaluation_id TEXT
    );

    CREATE TABLE IF NOT EXISTS emergency_incidents (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      task_id TEXT,
      zone_id TEXT,
      state TEXT NOT NULL,
      trigger_source TEXT NOT NULL,
      device_id TEXT NOT NULL,
      trigger_message_id TEXT NOT NULL UNIQUE,
      opened_at TEXT NOT NULL,
      acknowledged_at TEXT,
      resolved_at TEXT,
      last_known_environment TEXT,
      last_known_motion TEXT,
      escalation_level INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS risk_evaluations (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      device_id TEXT,
      task_id TEXT,
      zone_id TEXT,
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      intervention TEXT NOT NULL,
      break_minutes INTEGER NOT NULL,
      reasons TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      evaluated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fatigue_evaluations (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      device_id TEXT,
      task_id TEXT,
      zone_id TEXT,
      fatigue_score INTEGER NOT NULL,
      fatigue_level TEXT NOT NULL,
      intervention TEXT NOT NULL,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      reasons TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      evaluated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_collection_status (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      complete_task_count INTEGER NOT NULL,
      complete_project_days INTEGER NOT NULL,
      environment_coverage_pct INTEGER NOT NULL,
      worker_telemetry_coverage_pct INTEGER NOT NULL,
      task_outcome_coverage_pct INTEGER NOT NULL,
      missing_fields TEXT NOT NULL,
      planning_mode TEXT NOT NULL,
      evaluated_at TEXT NOT NULL
    );
  `);

  addColumnIfMissing('tasks', 'location', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'task_template', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'project', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'zone', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'quantity', 'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing('tasks', 'unit', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'deadline', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'priority', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'temperature_c', 'REAL');
  addColumnIfMissing('tasks', 'humidity_pct', 'REAL');
  addColumnIfMissing('tasks', 'task_workload', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'notes', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('tasks', 'scheduler_recommendation', "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing('rest_requests', 'fatigue_score_at_request', 'INTEGER');
}

function seedDatabase() {
  seedUsers();
  seedWorkers();
  seedTasks();
  seedNotifications();
  seedIoTDevices();
}

function seedUsers() {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, name, email, role, password_hash
    ) VALUES (
      $id, $name, $email, $role, $passwordHash
    )
  `);

  const insertMany = db.transaction((seedUsers: typeof users) => {
    for (const user of seedUsers) {
      insertUser.run({
        $id: user.id,
        $name: user.name,
        $email: user.email,
        $role: user.role,
        $passwordHash: hashPassword(user.password)
      });
    }
  });

  insertMany(users);
}

function seedWorkers() {
  const insertWorker = db.prepare(`
    INSERT OR IGNORE INTO workers (
      id, name, role, task, status, zone, time, workload, fatigue, pay, match
    ) VALUES (
      $id, $name, $role, $task, $status, $zone, $time, $workload, $fatigue, $pay, $match
    )
  `);

  const insertMany = db.transaction((seedWorkers: Worker[]) => {
    for (const worker of seedWorkers) {
      insertWorker.run({
        $id: worker.id,
        $name: worker.name,
        $role: worker.role,
        $task: worker.task,
        $status: worker.status,
        $zone: worker.zone,
        $time: worker.time,
        $workload: worker.workload,
        $fatigue: worker.fatigue,
        $pay: worker.pay,
        $match: worker.match
      });
    }
  });

  insertMany(workers);
}

function seedTasks() {
  const insertTask = db.prepare(`
    INSERT OR IGNORE INTO tasks (
      id, title, owner, location, task_template, project, zone, quantity, unit,
      deadline, priority, temperature_c, humidity_pct, task_workload, notes,
      scheduler_recommendation, status, due, tone
    ) VALUES (
      $id, $title, $owner, $location, $taskTemplate, $project, $zone, $quantity, $unit,
      $deadline, $priority, $temperatureC, $humidityPct, $workload, $notes,
      $schedulerRecommendation, $status, $due, $tone
    )
  `);

  const insertMany = db.transaction((seedTasks: Task[]) => {
    for (const task of seedTasks) {
      insertTask.run({
        $id: task.id,
        $title: task.title,
        $owner: task.owner,
        $location: task.location,
        $taskTemplate: task.taskTemplate,
        $project: task.project,
        $zone: task.zone,
        $quantity: task.quantity,
        $unit: task.unit,
        $deadline: task.deadline,
        $priority: task.priority,
        $temperatureC: task.temperatureC,
        $humidityPct: task.humidityPct,
        $workload: task.workload,
        $notes: task.notes,
        $schedulerRecommendation: JSON.stringify(task.schedulerRecommendation),
        $status: task.status,
        $due: task.due,
        $tone: task.tone
      });
    }
  });

  insertMany(tasks);
}

function seedNotifications() {
  const insertNotification = db.prepare(`
    INSERT OR IGNORE INTO notifications (
      id, title, detail, tone, target_label, target_section, target_worker_id, read
    ) VALUES (
      $id, $title, $detail, $tone, $targetLabel, $targetSection, $targetWorkerId, $read
    )
  `);

  const insertMany = db.transaction((seedNotifications: Notification[]) => {
    for (const notification of seedNotifications) {
      insertNotification.run({
        $id: notification.id,
        $title: notification.title,
        $detail: notification.detail,
        $tone: notification.tone,
        $targetLabel: notification.targetLabel,
        $targetSection: notification.targetSection,
        $targetWorkerId: notification.targetWorkerId ?? null,
        $read: notification.read ? 1 : 0
      });
    }
  });

  insertMany(notifications);
}

function seedIoTDevices() {
  const now = new Date().toISOString();
  const insertDevice = db.prepare(`
    INSERT OR IGNORE INTO iot_devices (
      id, mqtt_client_id, name, device_type, status, firmware_version,
      assigned_worker_id, assigned_site_id, assigned_zone_id, assigned_task_id,
      last_seen_at, battery_pct, signal_strength, created_at, updated_at
    ) VALUES (
      $id, $mqttClientId, $name, $deviceType, $status, $firmwareVersion,
      $assignedWorkerId, $assignedSiteId, $assignedZoneId, $assignedTaskId,
      $lastSeenAt, $batteryPct, $signalStrength, $createdAt, $updatedAt
    )
  `);

  insertDevice.run({
    $id: 'device-001',
    $mqttClientId: 'device-001',
    $name: 'Budi Wearable',
    $deviceType: 'WEARABLE',
    $status: 'ONLINE',
    $firmwareVersion: '0.1.0',
    $assignedWorkerId: 'budi',
    $assignedSiteId: 'site-001',
    $assignedZoneId: 'Zone C',
    $assignedTaskId: 'steel-beam-install',
    $lastSeenAt: now,
    $batteryPct: 82,
    $signalStrength: -61,
    $createdAt: now,
    $updatedAt: now
  });
}

type WorkerRow = Omit<Worker, 'status'> & {
  status: WorkerStatus;
};

type TaskRow = Omit<Task, 'tone' | 'taskTemplate' | 'temperatureC' | 'humidityPct' | 'workload' | 'schedulerRecommendation'> & {
  tone: Tone;
  task_template: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  task_workload: string;
  scheduler_recommendation: string;
};

type EnvironmentRow = {
  temperature_c: number | null;
  humidity_pct: number | null;
  recorded_at: string;
};

type NotificationRow = {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  target_label: string;
  target_section: ManagerSection;
  target_worker_id: string | null;
  read: number;
};

type UserRow = AuthUser & {
  password_hash: string;
  role: UserRole;
};

export function getUsers(): AuthUser[] {
  return db
    .query<UserRow, []>('SELECT id, name, email, role, password_hash FROM users ORDER BY rowid')
    .all()
    .map(({ password_hash: _passwordHash, ...user }) => user);
}

export function authenticateUser(email: string, password: string): AuthUser | null {
  const row = db.query<UserRow, [string]>('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim());

  if (!row || row.password_hash !== hashPassword(password)) {
    return null;
  }

  const { password_hash: _passwordHash, ...user } = row;
  return user;
}

export function getWorkers(): Worker[] {
  return db.query<WorkerRow, []>('SELECT * FROM workers ORDER BY rowid').all();
}

export async function getTasks(): Promise<Task[]> {
  const availableWorkers = getWorkers();
  const rows = db.query<TaskRow, []>('SELECT * FROM tasks ORDER BY rowid').all();
  return Promise.all(rows.map((row) => mapTask(row, availableWorkers)));
}

export async function createTask(input: {
  taskTemplate: string;
  project: string;
  zone: string;
  quantity: number;
  unit: string;
  deadline: string;
  priority: string;
  notes?: string;
}): Promise<Task> {
  const workload = inferWorkload(input.taskTemplate, input.quantity);
  const schedulerRecommendation = await buildSchedulerRecommendation({ ...input, workload }, getWorkers());
  const environment = getLatestEnvironment(input.zone);
  const task: Task = {
    id: slugify(`${input.taskTemplate}-${Date.now()}`),
    title: input.taskTemplate.trim(),
    owner: 'Unassigned',
    location: input.zone.trim(),
    taskTemplate: input.taskTemplate.trim(),
    project: input.project.trim(),
    zone: input.zone.trim(),
    quantity: input.quantity,
    unit: input.unit.trim(),
    deadline: input.deadline.trim(),
    priority: input.priority,
    temperatureC: environment?.temperature_c ?? null,
    humidityPct: environment?.humidity_pct ?? null,
    workload,
    notes: input.notes?.trim() ?? '',
    schedulerRecommendation,
    status: 'Open',
    due: input.deadline.trim(),
    tone: input.priority === 'Critical' ? 'danger' : input.priority === 'High' ? 'warning' : 'neutral'
  };

  db.prepare(`
    INSERT INTO tasks (
      id, title, owner, location, task_template, project, zone, quantity, unit,
      deadline, priority, temperature_c, humidity_pct, task_workload, notes,
      scheduler_recommendation, status, due, tone
    ) VALUES (
      $id, $title, $owner, $location, $taskTemplate, $project, $zone, $quantity, $unit,
      $deadline, $priority, $temperatureC, $humidityPct, $workload, $notes,
      $schedulerRecommendation, $status, $due, $tone
    )
  `).run({
    $id: task.id,
    $title: task.title,
    $owner: task.owner,
    $location: task.location,
    $taskTemplate: task.taskTemplate,
    $project: task.project,
    $zone: task.zone,
    $quantity: task.quantity,
    $unit: task.unit,
    $deadline: task.deadline,
    $priority: task.priority,
    $temperatureC: task.temperatureC,
    $humidityPct: task.humidityPct,
    $workload: task.workload,
    $notes: task.notes,
    $schedulerRecommendation: JSON.stringify(task.schedulerRecommendation),
    $status: task.status,
    $due: task.due,
    $tone: task.tone
  });

  return task;
}

export async function autoAssignTask(taskId: string): Promise<Task | null> {
  const row = db.query<TaskRow, [string]>('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!row) {
    return null;
  }

  const task = await mapTask(row, getWorkers());
  const bestWorker = task.schedulerRecommendation.selectedWorkerRecommendations[0];

  if (!bestWorker) {
    throw new Error('No eligible worker is available for automatic assignment');
  }

  db.transaction(() => {
    db.prepare('UPDATE tasks SET owner = ?, status = ? WHERE id = ?').run(bestWorker.workerName, 'Assigned', taskId);
    db.prepare('UPDATE workers SET task = ?, status = ?, zone = ?, workload = ? WHERE id = ?')
      .run(task.title, 'waiting', task.zone, task.workload, bestWorker.workerId);
    db.prepare('UPDATE iot_devices SET assigned_task_id = ?, assigned_zone_id = ?, updated_at = ? WHERE assigned_worker_id = ?')
      .run(taskId, task.zone, new Date().toISOString(), bestWorker.workerId);
    db.prepare(`
      INSERT INTO notifications (
        id, title, detail, tone, target_label, target_section, target_worker_id, read
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      `task-assigned-${crypto.randomUUID()}`,
      'New task assigned',
      `${task.title} was assigned in ${task.zone}. Complete PPE verification before starting.`,
      'neutral',
      'Open task',
      'tasks',
      bestWorker.workerId
    );
  })();

  const updatedRow = db.query<TaskRow, [string]>('SELECT * FROM tasks WHERE id = ?').get(taskId);
  return updatedRow ? mapTask(updatedRow, getWorkers()) : null;
}

export function getNotifications(): Notification[] {
  return db.query<NotificationRow, []>('SELECT * FROM notifications ORDER BY rowid').all().map(mapNotification);
}

export async function getWorkforceData(): Promise<WorkforceData> {
  return {
    workers: getWorkers(),
    tasks: await getTasks(),
    notifications: getNotifications()
  };
}

export function markNotificationRead(notificationId: string): Notification | null {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId);

  const row = db.query<NotificationRow, [string]>('SELECT * FROM notifications WHERE id = ?').get(notificationId);
  return row ? mapNotification(row) : null;
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    tone: row.tone,
    targetLabel: row.target_label,
    targetSection: row.target_section,
    targetWorkerId: row.target_worker_id ?? undefined,
    read: Boolean(row.read)
  };
}

function hashPassword(password: string) {
  return new Bun.CryptoHasher('sha256').update(`garudie:${password}`).digest('hex');
}

async function mapTask(row: TaskRow, availableWorkers: Worker[]): Promise<Task> {
  const environment = getLatestEnvironment(row.zone || row.location);
  const schedulerInput = {
    taskTemplate: row.task_template || row.title,
    project: row.project,
    zone: row.zone || row.location,
    quantity: row.quantity,
    unit: row.unit,
    deadline: row.deadline || row.due,
    priority: row.priority,
    workload: row.task_workload || inferWorkload(row.task_template || row.title, row.quantity)
  };

  return {
    id: row.id,
    title: row.title,
    owner: row.owner,
    location: row.location || row.zone,
    taskTemplate: schedulerInput.taskTemplate,
    project: row.project,
    zone: schedulerInput.zone,
    quantity: row.quantity,
    unit: row.unit,
    deadline: schedulerInput.deadline,
    priority: row.priority,
    temperatureC: environment?.temperature_c ?? null,
    humidityPct: environment?.humidity_pct ?? null,
    workload: schedulerInput.workload,
    notes: row.notes,
    schedulerRecommendation: await buildSchedulerRecommendation(schedulerInput, availableWorkers),
    status: row.status,
    due: row.due,
    tone: row.tone
  };
}

async function buildSchedulerRecommendation(input: {
  taskTemplate: string;
  project: string;
  zone: string;
  quantity: number;
  unit: string;
  deadline: string;
  priority: string;
  workload: string;
}, availableWorkers: Worker[]): Promise<SchedulerRecommendation> {
  const urgent = input.priority === 'High' || input.priority === 'Critical';
  const environment = getLatestEnvironment(input.zone);
  const capacity = estimateCapacity({
    taskTemplate: input.taskTemplate,
    quantity: input.quantity,
    deadline: input.deadline,
    environment: {
      temperatureC: environment?.temperature_c,
      humidityPct: environment?.humidity_pct,
      workload: input.workload
    },
    availableWorkerCount: availableWorkers.length
  });
  const workerCount = capacity.recommendedCrewSize;
  const requiredPpeAndCertifications = ['Helmet', 'Safety shoes', 'High-vis vest', urgent ? 'Supervisor safety sign-off' : 'Standard toolbox briefing'];
  const candidateWorkers = recommendWorkers({
    taskTemplate: input.taskTemplate,
    requiredSkills: [input.taskTemplate],
    requiredCertifications: requiredPpeAndCertifications,
    zone: input.zone,
    recommendedCrewSize: workerCount,
    workers: availableWorkers
  }).map((worker) => ({
    workerId: worker.workerId,
    workerName: worker.workerName,
    explanation: worker.explanation
  }));
  const activeWorkers = availableWorkers.filter((worker) => worker.status === 'working').length || workerCount;
  const breakMinutes = availableWorkers
    .filter((worker) => worker.status === 'break')
    .reduce((total, worker) => total + parseDurationMinutes(worker.time), 0);
  const chronosInput = getChronosForecastInput(input, capacity.totalWorkerHours, breakMinutes, activeWorkers);
  const chronosForecast = await forecastProductivity(chronosInput).catch((error) =>
    chronosUnavailableForecast(error instanceof Error ? error.message : 'Chronos model request failed')
  );

  return {
    totalWorkerHours: capacity.totalWorkerHours,
    recommendedWorkerCount: workerCount,
    recommendedCrewSize: capacity.recommendedCrewSize,
    estimatedTaskDuration: capacity.estimatedDuration,
    estimatedDuration: capacity.estimatedDuration,
    recommendedStartTime: urgent ? 'Next safe available window' : 'Next normal scheduling window',
    estimatedCompletionTime: capacity.estimatedFinishTime,
    estimatedFinishTime: capacity.estimatedFinishTime,
    predictedWorkload: capacity.predictedWorkload,
    selectedWorkerRecommendations: candidateWorkers,
    assignmentEngineVersion: 'worker-assignment-engine-v1',
    expectedProductivityRate: `${capacity.productivityRatePerWorkerHour} ${input.unit}/worker-hour`,
    deadlineFeasibilityStatus: capacity.deadlineFeasibilityStatus,
    capacityEstimatorVersion: capacity.estimatorVersion,
    requiredPpeAndCertifications,
    dependencyStatus: inferDependencyStatus(input),
    currentEnvironmentalConditions: environment
      ? `IoT telemetry: ${environment.temperature_c ?? '-'}C, ${environment.humidity_pct ?? '-'}% humidity at ${environment.recorded_at}.`
      : 'No current IoT telemetry for this zone; baseline capacity conditions are in use.',
    safetyAndOperationalWarnings: urgent
      ? ['High-priority task: confirm PPE, rest readiness, and zone access before assignment.', ...capacity.warnings]
      : ['Confirm zone access before dispatch.', ...capacity.warnings],
    chronosForecast,
    schedulerStatus: 'Live scheduler inference: capacity, worker assignment, fatigue status, and Chronos-2 forecasting are recalculated from current task and worker data.'
  };
}

function getLatestEnvironment(zone: string): EnvironmentRow | null {
  return db.query<EnvironmentRow, [string]>(`
    SELECT temperature_c, humidity_pct, recorded_at
    FROM environment_readings
    WHERE zone_id = ? AND valid = 1
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(zone.trim()) ?? null;
}

function inferDependencyStatus(input: { priority: string; workload: string; zone: string }) {
  if (input.priority === 'Critical') {
    return `Critical task in ${input.zone}: supervisor clearance required before dispatch.`;
  }

  if (input.workload === 'High') {
    return `High workload in ${input.zone}: verify crew availability and rest coverage before assignment.`;
  }

  return `No blocking dependency inferred for ${input.zone}.`;
}

function getChronosForecastInput(
  input: {
    taskTemplate: string;
    project: string;
    zone: string;
    quantity: number;
    workload: string;
  },
  currentWorkerHours: number,
  currentBreakMinutes: number,
  currentActiveWorkers: number
): ChronosForecastInput {
  const historicalRows = db.query<{
    quantity: number;
    scheduler_recommendation: string;
  }, [string, string, string]>(`
    SELECT quantity, scheduler_recommendation
    FROM tasks
    WHERE status IN ('Review', 'Done')
      AND (task_template = ? OR project = ? OR zone = ?)
    ORDER BY rowid DESC
    LIMIT 8
  `).all(input.taskTemplate, input.project, input.zone);

  const historical = historicalRows
    .map((row) => {
      const recommendation = parseStoredSchedulerRecommendation(row.scheduler_recommendation);
      return {
        completedQuantity: row.quantity,
        workerHours: recommendation?.totalWorkerHours ?? currentWorkerHours,
        breakMinutes: inferBreakMinutesFromRecommendation(recommendation),
        activeWorkers: recommendation?.recommendedCrewSize ?? currentActiveWorkers
      };
    })
    .filter((row) => row.completedQuantity > 0 && row.workerHours > 0 && row.activeWorkers > 0)
    .reverse();

  if (historical.length >= 2) {
    return {
      historicalCompletedQuantity: historical.map((row) => row.completedQuantity),
      workerHours: historical.map((row) => row.workerHours),
      breakMinutes: historical.map((row) => row.breakMinutes),
      activeWorkers: historical.map((row) => row.activeWorkers),
      predictionLength: 4
    };
  }

  return {
    historicalCompletedQuantity: [
      Math.max(1, Math.round(input.quantity * 0.72)),
      Math.max(1, Math.round(input.quantity * 0.86)),
      Math.max(1, input.quantity)
    ],
    workerHours: [
      Math.max(1, currentWorkerHours * 0.9),
      Math.max(1, currentWorkerHours),
      Math.max(1, currentWorkerHours * 1.08)
    ],
    breakMinutes: [
      Math.max(0, currentBreakMinutes),
      Math.max(0, currentBreakMinutes + (input.workload === 'High' ? 10 : 0)),
      Math.max(0, currentBreakMinutes + (input.workload === 'High' ? 15 : 5))
    ],
    activeWorkers: [currentActiveWorkers, currentActiveWorkers, currentActiveWorkers],
    predictionLength: 4
  };
}

function parseStoredSchedulerRecommendation(value: string): SchedulerRecommendation | null {
  try {
    const parsed = JSON.parse(value) as SchedulerRecommendation;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function inferBreakMinutesFromRecommendation(recommendation: SchedulerRecommendation | null) {
  if (!recommendation) return 0;
  return Array.isArray(recommendation.safetyAndOperationalWarnings)
    && recommendation.safetyAndOperationalWarnings.some((warning) => warning.toLowerCase().includes('rest'))
    ? 15
    : 0;
}

function parseDurationMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  const columns = db.query<{ name: string }, []>(`PRAGMA table_info(${tableName})`).all();

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
