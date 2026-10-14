const INVALID_CREDENTIALS = 'Invalid email or password.';

function errorCodeFromPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const code = payload.code;
  const legacyCode = payload.error_code;

  if (legacyCode !== undefined) {
    if (typeof legacyCode !== 'string' || !legacyCode) return null;
    if (code !== undefined && code !== 400 && code !== legacyCode) return null;
    return legacyCode;
  }

  return typeof code === 'string' && code ? code : null;
}

export function classifyLoginAuthFailure(status, payload) {
  if (status !== 400) {
    return {
      status: 401,
      body: { error: INVALID_CREDENTIALS },
    };
  }

  const code = errorCodeFromPayload(payload);

  if (code === 'invalid_credentials') {
    return {
      status: 401,
      body: { error: INVALID_CREDENTIALS, invalid_credentials: true },
    };
  }

  if (code === 'email_not_confirmed') {
    return {
      status: 401,
      body: {
        error: 'Verify your email address to continue.',
        needs_verification: true,
      },
    };
  }

  return {
    status: 401,
    body: { error: INVALID_CREDENTIALS },
  };
}
