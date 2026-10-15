const PHONE_INPUT_CHARACTERS = /^[+0-9 ().-]$/;
const PHONE_NUMBER_PATTERN = /^\+?[0-9 ().-]+$/;

export function sanitizePhoneInput(value) {
  const input = (typeof value === 'string' ? value : '').replace(/^\s+/, '');
  let output = '';
  let hasDigit = false;
  let leadingPlusAllowed = true;
  for (const character of input) {
    if (!PHONE_INPUT_CHARACTERS.test(character)) {
      if (!output) leadingPlusAllowed = false;
      continue;
    }
    if (character === '+') {
      if (leadingPlusAllowed && !output && !hasDigit) output = '+';
      continue;
    }
    output += character;
    if (/^[0-9]$/.test(character)) hasDigit = true;
  }
  return output;
}

export function isValidPhoneNumber(value) {
  if (typeof value !== 'string') return false;
  const phone = value.trim();
  if (!phone || phone.length > 50 || !PHONE_NUMBER_PATTERN.test(phone)) return false;
  if ((phone.match(/\+/g) || []).length > 1 || (phone.includes('+') && !phone.startsWith('+'))) return false;
  const digits = phone.match(/[0-9]/g) || [];
  return digits.length >= 7 && digits.length <= 15;
}
