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
  `);
}

function seedDatabase() {
  seedUsers();
  seedWorkers();
  seedTasks();
  seedNotifications();
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
      id, title, owner, status, due, tone
    ) VALUES (
      $id, $title, $owner, $status, $due, $tone
    )
  `);

  const insertMany = db.transaction((seedTasks: Task[]) => {
    for (const task of seedTasks) {
      insertTask.run({
        $id: task.id,
        $title: task.title,
        $owner: task.owner,
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
