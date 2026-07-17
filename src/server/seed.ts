import { db, getNotifications, getUsers, getWorkers, resetAndSeedDatabase } from './database';

resetAndSeedDatabase();

const summary = {
  users: getUsers().length,
  workers: getWorkers().length,
  tasks: db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM tasks').get()?.count ?? 0,
  notifications: getNotifications().length
};

db.close();

console.log(`Seeded database: ${summary.users} users, ${summary.workers} workers, ${summary.tasks} tasks, ${summary.notifications} notifications`);
