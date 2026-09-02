const PASSWORD_SETUP_TYPES = new Set(['invite', 'recovery']);

function currentUrl() {
  return typeof window !== 'undefined' ? window.location.href : '';
}

/**
 * Read only non-secret auth callback metadata before supabase-js clears a
 * successful implicit-flow fragment from the address bar.
 */
export function inspectAuthRedirect(url = currentUrl()) {
  if (!url) return { type: '', isPasswordSetup: false, isResetPath: false, hasError: false, hasCallbackCredentials: false };

  let parsed;
  try {
    parsed = new URL(url, 'http://localhost');
  } catch {
    return { type: '', isPasswordSetup: false, isResetPath: false, hasError: false, hasCallbackCredentials: false };
  }

  const params = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');
  parsed.searchParams.forEach((value, key) => params.set(key, value));
  const type = String(params.get('type') || '').trim().toLowerCase();
  const hasError = Boolean(params.get('error') || params.get('error_code') || params.get('error_description'));
  // Retain only the fact that an implicit/PKCE callback carried credentials;
  // never copy access, refresh, or authorization-code values into app state.
  const hasCallbackCredentials = Boolean(
    (params.get('access_token') && params.get('refresh_token')) || params.get('code')
  );

  return {
    type,
    isPasswordSetup: PASSWORD_SETUP_TYPES.has(type),
    isResetPath: /\/reset-password\/?$/.test(parsed.pathname),
    hasError,
    hasCallbackCredentials,
  };
}

export function passwordSetupError() {
  return 'This password link is invalid or expired. Request a new one.';
}

export function routerBasePath(routerBase = '/') {
  const value = String(routerBase || '/').trim();
  if (!value || value === '/') return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

export function passwordResetPath(routerBase = '/') {
  return `${routerBasePath(routerBase)}/reset-password`;
}
