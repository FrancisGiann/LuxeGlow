export const staffA = '00000000-0000-0000-0000-00000000000a';
export const staffB = '00000000-0000-0000-0000-00000000000b';
export const getServices = async () => [
  { id: 'short', name: 'Synthetic short', minutes: 30, price: 100, duration: '30m' },
  { id: 'extra', name: 'Synthetic extra', minutes: 60, price: 100, duration: '60m' },
];
export const getBookableStaff = async () => [
  { id: staffA, name: 'Synthetic A', average_rating: 0 },
  { id: staffB, name: 'Synthetic B', average_rating: 0 },
];
export const getSalonDateStatus = async (date) => ({ date, isClosed: false });
export async function getAvailableSlots(date, duration, staff) {
  const state = window.syntheticState;
  const fail = state.fail && staff;
  const slots = ['11:00 AM', '11:30 AM'].map((time) => ({
    time, available: !staff || !(state.blocked[staff]?.includes(time) || (state.longBlocked === staff && duration >= 90)),
  }));
  window.syntheticCalls.push({ date, duration, staff });
  if (staff) await new Promise((resolve) => setTimeout(resolve, state.delay || 0));
  if (fail) throw new Error('Synthetic offline');
  return slots;
}
export const createAppointment = async () => ({ success: false, error: window.syntheticState.bookConflict ? 'That slot is no longer available.' : 'Synthetic submission disabled' });
const toast = () => {};
export const useToast = () => toast;
export const useAuth = () => ({ isAuthenticated: Boolean(window.syntheticState.auth), status: window.syntheticState.auth ? 'authenticated' : 'unauthenticated', openAuth: () => {} });
export const useDashboard = () => ({ refresh: () => {} });
