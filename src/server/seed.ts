import { db, getNotifications, getTasks, getUsers, getWorkers, resetAndSeedDatabase } from './database';

resetAndSeedDatabase();

const summary = {
  users: getUsers().length,
  workers: getWorkers().length,
  tasks: (await getTasks()).length,
  notifications: getNotifications().length
};

db.close();

console.log(`Seeded database: ${summary.users} users, ${summary.workers} workers, ${summary.tasks} tasks, ${summary.notifications} notifications`);
