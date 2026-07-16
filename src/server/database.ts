import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { notifications, tasks, workers } from '../constants/workforce';
import type { AuthUser, ManagerSection, UserRole } from '../types/navigation';
import type { Notification, Task, Tone, Worker, WorkerStatus, WorkforceData } from '../types/workforce';

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
      id, title, owner, location, status, due, tone
    ) VALUES (
      $id, $title, $owner, $location, $status, $due, $tone
    )
  `);

  const insertMany = db.transaction((seedTasks: Task[]) => {
    for (const task of seedTasks) {
      insertTask.run({
        $id: task.id,
        $title: task.title,
        $owner: task.owner,
        $location: task.location,
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

type TaskRow = Omit<Task, 'tone'> & {
  tone: Tone;
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

export function getTasks(): Task[] {
  return db.query<TaskRow, []>('SELECT * FROM tasks ORDER BY rowid').all();
}

export function createTask(input: { title: string; owner?: string; location: string; due?: string }): Task {
  const task: Task = {
    id: slugify(`${input.title}-${Date.now()}`),
    title: input.title.trim(),
    owner: input.owner?.trim() || 'Unassigned',
    location: input.location.trim(),
    status: 'Open',
    due: input.due?.trim() || 'Today',
    tone: 'neutral'
  };

  db.prepare(`
    INSERT INTO tasks (
      id, title, owner, location, status, due, tone
    ) VALUES (
      $id, $title, $owner, $location, $status, $due, $tone
    )
  `).run({
    $id: task.id,
    $title: task.title,
    $owner: task.owner,
    $location: task.location,
    $status: task.status,
    $due: task.due,
    $tone: task.tone
  });

  return task;
}

export function getNotifications(): Notification[] {
  return db.query<NotificationRow, []>('SELECT * FROM notifications ORDER BY rowid').all().map(mapNotification);
}

export function getWorkforceData(): WorkforceData {
  return {
    workers: getWorkers(),
    tasks: getTasks(),
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
