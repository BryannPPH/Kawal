import { db, getNotifications, getUsers, getWorkers, resetAndSeedDatabase } from './database';

resetAndSeedDatabase();

const taskWindow = db.query<{
  first_deadline: string;
  last_deadline: string;
  scheduled_days: number;
}, []>(`
  SELECT
    MIN(deadline) AS first_deadline,
    MAX(deadline) AS last_deadline,
    COUNT(DISTINCT substr(deadline, 1, 10)) AS scheduled_days
  FROM tasks
`).get();

const summary = {
  users: getUsers().length,
  workers: getWorkers().length,
  tasks: db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM tasks').get()?.count ?? 0,
  notifications: getNotifications().length,
  scheduledDays: taskWindow?.scheduled_days ?? 0,
  firstDeadline: taskWindow?.first_deadline,
  lastDeadline: taskWindow?.last_deadline
};

db.close();

console.log(`Seeded database: ${summary.users} users, ${summary.workers} workers, ${summary.tasks} tasks, ${summary.notifications} notifications`);
console.log(`Task schedule: ${summary.scheduledDays} days, ${formatDate(summary.firstDeadline)} to ${formatDate(summary.lastDeadline)}`);

function formatDate(value?: string) {
  if (!value) return 'n/a';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}
