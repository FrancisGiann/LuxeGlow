import { toAppointmentDate } from './format';

const RECENT_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Client-side classification of the aggregated dashboard appointments
 * (audit #3). The PHP payload is untouched — we only sort it into tabs:
 *  - Upcoming: Pending/Confirmed, today or later (soonest first)
 *  - Recent:   Completed within the last 30 days (newest first)
 *  - History:  everything else (past due, cancelled, older completed)
 */
export function classifyAppointments(appointments = []) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const recentFloor = todayStart - RECENT_WINDOW_DAYS * DAY_MS;

  const withTs = appointments.map((a) => ({ ...a, ts: toAppointmentDate(a.raw_date, a.raw_time).getTime() }));

  const upcoming = [];
  const recent = [];
  const history = [];

  for (const a of withTs) {
    if ((a.status === 'Pending' || a.status === 'Confirmed') && a.ts >= todayStart) {
      upcoming.push(a);
    } else if (a.status === 'Completed' && a.ts >= recentFloor) {
      recent.push(a);
    } else {
      history.push(a);
    }
  }

  upcoming.sort((a, b) => a.ts - b.ts);
  recent.sort((a, b) => b.ts - a.ts);
  history.sort((a, b) => b.ts - a.ts);

  return { upcoming, recent, history };
}
