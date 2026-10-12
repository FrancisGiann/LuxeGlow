import { toAppointmentDate } from './format.js';

/**
 * Client-side classification of the aggregated dashboard appointments
 * (audit #3). The payload is untouched — upcoming bookings and completed
 * visits are shown separately. Cancellations are not counted as visits.
 */
export function classifyAppointments(appointments = []) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const withTs = appointments.map((a) => ({ ...a, ts: toAppointmentDate(a.raw_date, a.raw_time).getTime() }));

  const upcoming = [];
  const history = [];

  for (const a of withTs) {
    if ((a.status === 'Pending' || a.status === 'Confirmed') && a.ts >= todayStart) {
      upcoming.push(a);
    } else if (a.status === 'Completed') {
      history.push(a);
    }
  }

  upcoming.sort((a, b) => a.ts - b.ts);
  history.sort((a, b) => b.ts - a.ts);

  return { upcoming, history };
}

export function filterCompletedAppointmentsByDate(appointments = [], date = '') {
  return appointments.filter((appointment) => appointment.status === 'Completed'
    && (!date || appointment.raw_date === date));
}
