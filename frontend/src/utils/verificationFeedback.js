export const LOGIN_VERIFICATION_MESSAGE = 'If this address needs verification, check its inbox and spam folder. If you still cannot sign in, try again later or use Forgot password.';
export const VERIFICATION_REQUEST_FAILED_MESSAGE = 'Could not request a verification email. Please try again later.';
export const MAX_VERIFICATION_COOLDOWN_SECONDS = 300;

export function verificationRequestFeedback(result) {
  const retryAfter = Number(result?.retryAfter);
  if (result?.ok !== true && Number.isFinite(retryAfter) && retryAfter > 0) {
    return 'Please wait before requesting another verification email.';
  }
  if (result?.ok === true) return LOGIN_VERIFICATION_MESSAGE;
  return VERIFICATION_REQUEST_FAILED_MESSAGE;
}

export function verificationCooldownSeconds(result) {
  const retryAfter = Number(result?.retryAfter);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(Math.ceil(retryAfter), MAX_VERIFICATION_COOLDOWN_SECONDS);
  }
  return 60;
}
