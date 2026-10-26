export function validateStaffRosterEntry(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return { success: false, error: 'Enter staff details.' };
  }
  if (typeof fields.full_name !== 'string') return { success: false, error: 'Enter a full name.' };
  if (fields.position_title != null && typeof fields.position_title !== 'string') {
    return { success: false, error: 'Enter a valid position title.' };
  }
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const full_name = normalize(fields.full_name);
  const position_title = normalize(fields.position_title) || null;
  if (!full_name || [...full_name].length > 201 || /[\p{Cc}\p{Cf}]/u.test(full_name)) {
    return { success: false, error: 'Full name must be 1–201 characters without control characters.' };
  }
  if (position_title && ([...position_title].length > 100 || /[\p{Cc}\p{Cf}]/u.test(position_title))) {
    return { success: false, error: 'Position title must be 100 characters or fewer without control characters.' };
  }
  return { success: true, value: { full_name, position_title } };
}
