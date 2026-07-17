import { describe, expect, it } from 'vitest';
import { calculatePreviousDayWorkedMinutes } from './workHours';

describe('worker hour aggregation', () => {
  it('counts only the portion of sessions that overlaps the previous day', () => {
    const minutes = calculatePreviousDayWorkedMinutes([
      {
        start_time: '2026-07-16T08:00:00+07:00',
        stop_time: '2026-07-16T16:30:00+07:00',
        duration_seconds: 30_600
      },
      {
        start_time: '2026-07-15T23:00:00+07:00',
        stop_time: '2026-07-16T01:00:00+07:00',
        duration_seconds: 7_200
      },
      {
        start_time: '2026-07-17T08:00:00+07:00',
        stop_time: null,
        duration_seconds: 3_600
      }
    ], new Date('2026-07-17T12:00:00+07:00'));

    expect(minutes).toBe(570);
  });
});
