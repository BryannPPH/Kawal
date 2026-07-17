export type WorkHourSession = {
  start_time: string;
  stop_time: string | null;
  duration_seconds: number | null;
};

export function calculatePreviousDayWorkedMinutes(sessions: WorkHourSession[], now = new Date()) {
  const jakartaOffsetMilliseconds = 7 * 60 * 60 * 1000;
  const jakartaNow = new Date(now.getTime() + jakartaOffsetMilliseconds);
  const dayEndMilliseconds = Date.UTC(
    jakartaNow.getUTCFullYear(),
    jakartaNow.getUTCMonth(),
    jakartaNow.getUTCDate()
  ) - jakartaOffsetMilliseconds;
  const dayStartMilliseconds = dayEndMilliseconds - 24 * 60 * 60 * 1000;

  const workedMilliseconds = sessions.reduce((total, session) => {
    const sessionStart = new Date(session.start_time);

    if (Number.isNaN(sessionStart.getTime())) {
      return total;
    }

    const recordedStop = session.stop_time ? new Date(session.stop_time) : null;
    const durationStop = (session.duration_seconds ?? 0) > 0
      ? new Date(sessionStart.getTime() + (session.duration_seconds ?? 0) * 1000)
      : null;
    const sessionEnd = recordedStop && !Number.isNaN(recordedStop.getTime())
      ? recordedStop
      : durationStop ?? sessionStart;
    const overlapStart = Math.max(sessionStart.getTime(), dayStartMilliseconds);
    const overlapEnd = Math.min(sessionEnd.getTime(), dayEndMilliseconds);

    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0);

  return Math.round(workedMilliseconds / 60_000);
}
