import { autoAssignTask, createTask, db, getTasks, getWorkers, initializeDatabase } from '../src/server/database';
import { getWorkerAppData } from '../src/server/workerActions';

initializeDatabase();
db.exec('BEGIN');

try {
  const task = await createTask({
    taskTemplate: 'Steel beam installation',
    project: 'Workflow verification',
    zone: 'Zone C',
    quantity: 12,
    unit: 'beams',
    deadline: '2030-01-01T12:00',
    priority: 'High',
    notes: 'Transaction-scoped test task'
  });

  if (task.owner !== 'Unassigned') throw new Error('New task should be unassigned');
  if (!task.schedulerRecommendation.selectedWorkerRecommendations.length) throw new Error('Scheduler returned no worker recommendations');
  if (!(await getTasks()).some((storedTask) => storedTask.id === task.id)) throw new Error('Created task was not persisted');

  const assignedTask = await autoAssignTask(task.id);

  if (!assignedTask || assignedTask.owner === 'Unassigned' || assignedTask.status !== 'Assigned') {
    throw new Error('Automatic assignment did not update the task');
  }

  const assignedWorker = getWorkers().find((worker) => worker.name === assignedTask.owner);

  if (!assignedWorker || assignedWorker.status !== 'waiting') {
    throw new Error('Assigned worker was not moved to the waiting-for-start state');
  }

  const workerApp = await getWorkerAppData(assignedWorker.id);

  if (!workerApp.tasks.some((assignedWorkerTask) => assignedWorkerTask.id === task.id)) {
    throw new Error('Assigned task is not visible in the worker app');
  }

  console.log(`Task workflow passed: ${task.id} assigned to ${assignedTask.owner}`);
} finally {
  db.exec('ROLLBACK');
}
