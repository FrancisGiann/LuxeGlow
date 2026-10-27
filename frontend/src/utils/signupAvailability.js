import { normalizeSignupEmail, signupEmailError } from './signupEmail.js';

export const EMAIL_UNAVAILABLE_MESSAGE = 'This email is unavailable for a new account. Sign in or reset your password.';
export const EMAIL_CHECK_ERROR = 'Could not check this email right now. Please try again.';
const keyFor = (email) => normalizeSignupEmail(email).toLowerCase();

// Each edit invalidates pending responses, including A -> B -> A changes.
export function createSignupAvailabilityChecker(check, onState) {
  let generation = 0;
  let currentEmail = '';
  let pending = null;
  let controller = null;
  let state = { status: 'idle' };
  const emit = (next) => { state = next; onState(next); };
  const change = (email = '') => {
    generation += 1;
    currentEmail = keyFor(email);
    controller?.abort();
    controller = null;
    pending = null;
    emit({ status: 'idle' });
  };
  return {
    change,
    cancel() { generation += 1; controller?.abort(); pending = null; },
    async check(email) {
      const key = keyFor(email);
      if (key !== currentEmail) change(email);
      if (signupEmailError(email)) return { status: 'invalid' };
      if (pending) return pending;
      if (state.status === 'unavailable' || state.status === 'available') return state;
      const attempt = generation;
      controller = new AbortController();
      emit({ status: 'checking' });
      pending = (async () => {
        let result;
        try { result = await check(email, controller.signal); }
        catch { result = { ok: false }; }
        if (attempt !== generation) return { status: 'stale' };
        const next = result?.ok === true && typeof result.available === 'boolean'
          ? { status: result.available ? 'available' : 'unavailable' }
          : { status: 'error', message: result?.error || EMAIL_CHECK_ERROR };
        emit(next);
        pending = null;
        return next;
      })();
      return pending;
    },
  };
}
