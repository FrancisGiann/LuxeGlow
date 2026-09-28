const NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000;
const ARRIVAL_EARLY_WINDOW_MS = 15 * 60 * 1000;

export function canRecordAppointmentArrival(appointment, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const startMs = Date.parse(appointment?.start_at);
  return Boolean(
    Number.isFinite(nowMs) &&
      Number.isFinite(startMs) &&
      appointment?.status === 'Confirmed' &&
      !appointment.arrived_at &&
      nowMs >= startMs - ARRIVAL_EARLY_WINDOW_MS,
  );
}

export function findDueNoShowAppointment(appointments, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return null;

  return (Array.isArray(appointments) ? appointments : [])
    .filter((appointment) => {
      if (
        !appointment ||
        appointment.status !== 'Confirmed' ||
        appointment.arrived_at ||
        appointment.no_show_reviewed_at
      ) return false;
      const startMs = Date.parse(appointment.start_at);
      return Number.isFinite(startMs) && nowMs >= startMs + NO_SHOW_GRACE_PERIOD_MS;
    })
    .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at))[0] || null;
}
