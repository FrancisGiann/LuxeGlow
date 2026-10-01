const NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000;
const MANILA_CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  calendar: 'gregory',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function manilaCalendarDate(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const parts = MANILA_CALENDAR_DATE_FORMATTER.formatToParts(timestamp);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function canRecordAppointmentArrival(appointment, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const startMs = Date.parse(appointment?.start_at);
  const todayInManila = manilaCalendarDate(nowMs);
  const appointmentDateInManila = manilaCalendarDate(startMs);
  return Boolean(
    Number.isFinite(nowMs) &&
      Number.isFinite(startMs) &&
      todayInManila &&
      todayInManila === appointmentDateInManila &&
      appointment?.status === 'Confirmed' &&
      !appointment.arrived_at,
  );
}

export function findDueNoShowAppointment(appointments, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return null;
  const todayInManila = manilaCalendarDate(nowMs);
  if (!todayInManila) return null;

  return (Array.isArray(appointments) ? appointments : [])
    .filter((appointment) => {
      if (
        !appointment ||
        appointment.status !== 'Confirmed' ||
        appointment.arrived_at ||
        appointment.no_show_reviewed_at
      ) return false;
      const startMs = Date.parse(appointment.start_at);
      return (
        Number.isFinite(startMs) &&
        manilaCalendarDate(startMs) === todayInManila &&
        nowMs >= startMs + NO_SHOW_GRACE_PERIOD_MS
      );
    })
    .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at))[0] || null;
}
