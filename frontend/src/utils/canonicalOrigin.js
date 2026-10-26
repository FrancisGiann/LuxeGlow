// The login gateway intentionally allows only the canonical production origin.
// Redirect the www alias before importing App (and therefore Supabase Auth).
// Preserve deep links and Auth callback data without logging either.
export function canonicalProductionUrl(location) {
  if (String(location?.hostname || '').toLowerCase() !== 'www.astridnails.online') return null;
  const target = new URL('https://astridnails.online/');
  target.pathname = location.pathname || '/';
  target.search = location.search || '';
  target.hash = location.hash || '';
  return target.href;
}
