const LOGIN_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_EMAIL_MAX_LENGTH = 320;
export const LOGIN_RECOVERY_ATTEMPT_THRESHOLD = 3;

export function normalizeLoginEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isCurrentLoginFailure(submitted, current) {
  return Boolean(
    submitted &&
      current &&
      submitted.generation === current.generation &&
      normalizeLoginEmail(submitted.email) === normalizeLoginEmail(current.email),
  );
}

export function emptyLoginFailureState() {
  return { email: '', attempts: 0 };
}

export function changeLoginFailureEmail(state, email) {
  const normalizedEmail = normalizeLoginEmail(email);
  if (state?.email === normalizedEmail) return state;
  return { email: normalizedEmail, attempts: 0 };
}

export function recordLoginFailure(state, email, result) {
  if (
    result?.ok === true ||
    result?.needsVerification === true ||
    result?.rateLimited === true ||
    result?.invalidCredentials !== true
  ) {
    return state;
  }

  const normalizedEmail = normalizeLoginEmail(email);
  if (
    normalizedEmail.length > LOGIN_EMAIL_MAX_LENGTH ||
    !LOGIN_EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return state;
  }

  const previousAttempts =
    state?.email === normalizedEmail &&
    Number.isSafeInteger(state.attempts) &&
    state.attempts >= 0
      ? state.attempts
      : 0;
  return { email: normalizedEmail, attempts: previousAttempts + 1 };
}

export function shouldSuggestPasswordReset(state, email) {
  const normalizedEmail = normalizeLoginEmail(email);
  return Boolean(
    normalizedEmail &&
      normalizedEmail.length <= LOGIN_EMAIL_MAX_LENGTH &&
      LOGIN_EMAIL_PATTERN.test(normalizedEmail) &&
      state?.email === normalizedEmail &&
      Number.isSafeInteger(state.attempts) &&
      state.attempts >= LOGIN_RECOVERY_ATTEMPT_THRESHOLD,
  );
}
