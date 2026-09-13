export const STAFF_POSITION_TITLE_MAX_LENGTH = 100;

export function normalizeStaffPositionTitle(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

export function isStaffPositionTitleWithinLimit(value) {
  return value == null || (typeof value === 'string' && value.length <= STAFF_POSITION_TITLE_MAX_LENGTH);
}
