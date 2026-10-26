export const LOGIN_VERIFICATION_MESSAGE = 'If this address needs verification, check its inbox and spam folder. If you still cannot sign in, try again later or use Forgot password.';
export const VERIFICATION_REQUEST_FAILED_MESSAGE = 'Could not request a verification email. Please try again later.';
// Local button retry delay; Supabase sending limits can last longer.
export const VERIFICATION_RETRY_DELAY_SECONDS = 60;
export const MAX_VERIFICATION_COOLDOWN_SECONDS = 300;

export function verificationRequestFeedback(result) {
  if (result?.ok !== true && result?.rateLimited === true) {
    return 'Please wait before trying again. Email sending limits may last longer than this timer.';
  }
  if (result?.ok === true) return LOGIN_VERIFICATION_MESSAGE;
  return VERIFICATION_REQUEST_FAILED_MESSAGE;
}

export function verificationCooldownSeconds(result) {
  const cooldownSeconds = Number(result?.cooldownSeconds);
  if (Number.isFinite(cooldownSeconds) && cooldownSeconds > 0) {
    return Math.min(Math.ceil(cooldownSeconds), MAX_VERIFICATION_COOLDOWN_SECONDS);
  }
  return VERIFICATION_RETRY_DELAY_SECONDS;
}
