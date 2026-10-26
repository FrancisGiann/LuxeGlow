// Format checks only; Supabase Auth validates signup and verifies email control.
export const SIGNUP_EMAIL_MAX_LENGTH = 254;

export function normalizeSignupEmail(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function signupEmailError(value) {
  const email = normalizeSignupEmail(value);
  if (!email) return 'Enter your email address.';
  if (new TextEncoder().encode(email).length > SIGNUP_EMAIL_MAX_LENGTH) {
    return 'Your email address is too long. Use an address of 254 bytes or fewer.';
  }
  const parts = email.split('@');
  if (parts.length !== 2) return 'Enter an email address like name@example.com.';
  const [local, domain] = parts;
  if (!local || new TextEncoder().encode(local).length > 64 || !domain
    // Reject controls as well as whitespace and address-list syntax.
    // eslint-disable-next-line no-control-regex
    || /[\s\x00-\x1f\x7f<>(),;:\\"]/u.test(email)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || !domain.includes('.') || domain.split('.').some((label) => !label || label.length > 63
      || !/^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label))) {
    return 'Enter an email address like name@example.com.';
  }
  return '';
}

const DOMAIN_SUGGESTIONS = Object.freeze({
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'yahoo.con': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
});

export function suggestedSignupEmail(value) {
  if (signupEmailError(value)) return '';
  const [local, domain] = normalizeSignupEmail(value).split('@');
  const suggestion = DOMAIN_SUGGESTIONS[domain.toLowerCase()];
  return suggestion ? `${local}@${suggestion}` : '';
}
