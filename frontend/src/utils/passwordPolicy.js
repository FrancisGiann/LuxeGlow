export const PASSWORD_MIN_LENGTH = 8;

// Keep this aligned with the symbol set supported by Supabase Auth.
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~";
export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one symbol.';
export const PASSWORD_POLICY_HINT = PASSWORD_POLICY_MESSAGE;

export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const requirements = {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: [...value].some((character) => PASSWORD_SYMBOLS.includes(character)),
  };

  return {
    ...requirements,
    valid: Object.values(requirements).every(Boolean),
  };
}

export function getPasswordPolicyError(password) {
  return validatePassword(password).valid ? '' : PASSWORD_POLICY_MESSAGE;
}
