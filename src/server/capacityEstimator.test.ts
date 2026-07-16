import { describe, expect, it } from 'vitest';
import { estimateCapacity } from './capacityEstimator';

describe('capacity estimator', () => {
  it('estimates worker-hours, crew size, duration, finish time, and feasibility', () => {
    const estimate = estimateCapacity({
      taskTemplate: 'Concrete pour',
      quantity: 40,
      deadline: '2026-07-17T18:00:00.000Z',
      environment: {
        temperatureC: 30,
        humidityPct: 65,
        workload: 'Medium'
      },
      availableWorkerCount: 6,
      now: new Date('2026-07-17T08:00:00.000Z')
    });

    expect(estimate.totalWorkerHours).toBeGreaterThan(0);
    expect(estimate.recommendedCrewSize).toBeGreaterThan(0);
    expect(estimate.estimatedDuration).toMatch(/[hm]/);
    expect(estimate.estimatedFinishTime).toContain('2026-07-17T');
    expect(estimate.deadlineFeasibilityStatus).toBe('FEASIBLE');
  });

  it('reduces productivity under high temperature, humidity, and workload', () => {
    const normal = estimateCapacity({
      taskTemplate: 'Cleanup',
      quantity: 100,
      deadline: '2026-07-17T18:00:00.000Z',
      environment: { temperatureC: 28, humidityPct: 60, workload: 'Low' },
      now: new Date('2026-07-17T08:00:00.000Z')
    });

    const harsh = estimateCapacity({
      taskTemplate: 'Cleanup',
      quantity: 100,
      deadline: '2026-07-17T18:00:00.000Z',
      environment: { temperatureC: 36, humidityPct: 85, workload: 'High' },
      now: new Date('2026-07-17T08:00:00.000Z')
    });

    expect(harsh.totalWorkerHours).toBeGreaterThan(normal.totalWorkerHours);
    expect(harsh.warnings.length).toBeGreaterThan(0);
  });
});
