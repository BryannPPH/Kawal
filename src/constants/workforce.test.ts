import { describe, expect, it } from 'vitest';
import { statusLabels, tasks, workers } from './workforce';

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

  it('has labels for every worker status in use', () => {
    const statuses = new Set(workers.map((worker) => worker.status));

    expect([...statuses].every((status) => status in statusLabels)).toBe(true);
  });
});
