export function isSupportedProfileRole(role) {
  return role === 'customer' || isStaffRole(role);
}

export function isStaffRole(role) {
  return role === 'head' || role === 'admin';
}
