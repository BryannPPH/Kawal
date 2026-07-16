import { describe, expect, it } from 'vitest';
import { workers } from '../constants/workforce';
import { recommendWorkers } from './workerAssignmentEngine';

describe('Worker Assignment Engine', () => {
  it('returns ranked worker recommendations with reasons', () => {
    const recommendations = recommendWorkers({
      taskTemplate: 'Steel beam install',
      requiredSkills: ['steel'],
      requiredCertifications: ['Helmet', 'Harness'],
      zone: 'Zone C',
      recommendedCrewSize: 2,
      workers
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]).toMatchObject({
      workerId: 'budi',
      workerName: 'Budi Santoso'
    });
    expect(recommendations[0].reasons.length).toBeGreaterThan(0);
  });

  it('keeps new workers assignable with a cold-start explanation', () => {
    const recommendations = recommendWorkers({
      taskTemplate: 'Material staging',
      requiredSkills: ['staging'],
      requiredCertifications: ['Helmet'],
      zone: 'Zone D',
      recommendedCrewSize: 1,
      workers: [
        {
          id: 'new-worker',
          name: 'New Worker',
          role: 'General Crew',
          task: 'New employee onboarding',
          status: 'waiting',
          zone: 'Zone D',
          time: '00:00',
          workload: 'Low',
          fatigue: 0,
          pay: 'Rp0',
          match: 0
        }
      ]
    });

    expect(recommendations[0].workerId).toBe('new-worker');
    expect(recommendations[0].reasons.join(' ')).toContain('Cold-start worker profile');
  });
});
