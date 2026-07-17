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

  it('penalizes fatigued workers more strongly for high-intensity work', () => {
    const candidate = {
      ...workers[0],
      id: 'fatigued-candidate',
      name: 'Fatigued Candidate',
      match: 45,
      fatigue: 60
    };
    const commonInput = {
      taskTemplate: 'Steel beam install',
      requiredSkills: ['steel'],
      requiredCertifications: ['Helmet', 'Harness'],
      zone: 'Zone C',
      recommendedCrewSize: 1,
      workers: [candidate]
    };
    const low = recommendWorkers({ ...commonInput, intensity: 'Low' })[0];
    const high = recommendWorkers({ ...commonInput, intensity: 'High' })[0];

    expect(high.score).toBeLessThan(low.score);
    expect(high.reasons.join(' ')).toContain('High-intensity task');
  });

  it('accounts for prior-day overtime when ranking demanding work', () => {
    const rested = { ...workers[1], id: 'rested', name: 'Rested Worker', match: 70, yesterdayWorkedMinutes: 480 };
    const overtime = { ...rested, id: 'overtime', name: 'Overtime Worker', yesterdayWorkedMinutes: 600 };
    const recommendations = recommendWorkers({
      taskTemplate: 'Material handling',
      zone: 'Zone B',
      recommendedCrewSize: 2,
      intensity: 'High',
      workload: 'High',
      workers: [overtime, rested]
    });

    expect(recommendations[0].workerId).toBe('rested');
    expect(recommendations[1].reasons.join(' ')).toContain('prior-day overtime');
  });
});
