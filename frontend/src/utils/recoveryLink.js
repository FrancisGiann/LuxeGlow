export function parseRecoveryLink(hash = window.location.hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const id = params.get('recovery_id') || '';
  const token = params.get('recovery_token') || '';
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) || !/^[0-9a-f]{64}$/.test(token)) return null;
  return { id, token };
}
