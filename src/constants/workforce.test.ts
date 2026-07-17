import { describe, expect, it } from 'vitest';
import { notifications, statusLabels, tasks, workers } from './workforce';

describe('workforce constants', () => {
  it('keeps a valid selected worker seed available', () => {
    expect(workers[0]).toMatchObject({
      id: 'budi',
      status: 'working',
      zone: 'Zone C'
    });
  });

  it('keeps task tones within the supported visual states', () => {
    const supportedTones = new Set(['neutral', 'success', 'warning', 'danger']);

    expect(tasks.every((task) => supportedTones.has(task.tone))).toBe(true);
  });

  it('seeds a usable unassigned task queue', () => {
    expect(tasks.length).toBeGreaterThanOrEqual(20);
    expect(tasks.every((task) => task.owner === 'Unassigned' && task.status === 'Open')).toBe(true);
  });

  it('spreads seeded tasks across an operational week', () => {
    const deadlineDays = new Set(tasks.map((task) => task.deadline.slice(0, 10)));

    expect(deadlineDays.size).toBeGreaterThanOrEqual(7);
  });

  it('seeds a varied crew for assignment ranking', () => {
    expect(workers.length).toBeGreaterThanOrEqual(12);
    expect(new Set(workers.map((worker) => worker.role)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(workers.map((worker) => worker.workload)).size).toBe(3);
  });

  it('has labels for every worker status in use', () => {
    const statuses = new Set(workers.map((worker) => worker.status));

    expect([...statuses].every((status) => status in statusLabels)).toBe(true);
  });

  it('routes every notification to a manager section', () => {
    const supportedSections = new Set(['dashboard', 'workers', 'tasks', 'payroll']);

    expect(notifications.every((notification) => supportedSections.has(notification.targetSection))).toBe(true);
  });
});
