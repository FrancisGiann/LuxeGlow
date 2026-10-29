// Isolated proof of the login decision. This module is not wired into the app.
// Store and Auth adapters must run on a trusted server; never return a phone
// number or a service credential to the browser.

const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;
const PH_MOBILE = /^\+639\d{9}$/u;

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function normalizePhilippineMobile(value) {
  const input = String(value ?? '').replace(/[\s().-]/gu, '');
  const phone = /^09\d{9}$/u.test(input) ? `+63${input.slice(1)}` : input;
  return PH_MOBILE.test(phone) ? phone : null;
}

const INVALID = { ok: false, status: 401, error: 'Invalid email or password.' };
const UNAVAILABLE = { ok: false, status: 503, error: 'Sign-in is unavailable. Try again later.' };

export async function loginWithEmailAlias({ email, password, ip, store, auth, limits }) {
  const loginEmail = normalizeEmail(email);
  if (!loginEmail || typeof password !== 'string' || !password || password.length > 1024) return INVALID;
  // Reserve before lookup, including unknown addresses, to avoid enumeration.
  if (!(await limits.reserve(loginEmail, ip))) return { ok: false, status: 429, error: 'Try again later.' };

  try {
    const alias = await store.lookup(loginEmail);
    if (!alias) {
      // Preserve existing verified-email customer and staff Auth behavior.
      const result = await auth.signInEmailPassword(loginEmail, password, ip);
      if (!result?.session) return INVALID;
      await limits.releaseSuccess(loginEmail, ip);
      return { ok: true, session: result.session };
    }

    // An unverified email is a login label only. It is never a recovery target.
    if (alias.kind !== 'customer' || alias.emailVerifiedAt ||
        !alias.phoneVerifiedAt || !PH_MOBILE.test(alias.phone) ||
        new Date(alias.expiresAt).getTime() <= Date.now()) return INVALID;

    const result = await auth.signInPhonePassword(alias.phone, password, ip);
    if (!result?.session || result.user?.id !== alias.userId) return INVALID;
    // Read the authoritative Auth record after password verification. This also
    // catches a phone change or a reassigned alias during the Auth call.
    const [currentUser, currentAlias, profile] = await Promise.all([
      auth.getUserById(alias.userId), store.lookup(loginEmail), store.getProfile(alias.userId),
    ]);
    if (!currentUser?.phoneConfirmedAt || currentUser.phone !== alias.phone ||
        currentAlias?.userId !== alias.userId || currentAlias?.phone !== alias.phone ||
        currentAlias?.emailVerifiedAt || new Date(currentAlias?.expiresAt).getTime() <= Date.now() ||
        profile?.role !== 'customer' ||
        profile?.isActive !== true) return INVALID;
    await limits.releaseSuccess(loginEmail, ip);
    return { ok: true, session: result.session };
  } catch {
    return UNAVAILABLE;
  }
}

export async function maySendRecoveryEmail({ email, store, auth }) {
  const recoveryEmail = normalizeEmail(email);
  if (!recoveryEmail) return false;
  const record = await store.lookup(recoveryEmail);
  if (!record?.recoveryEmailVerifiedAt || record.emailVerifiedAt !== record.recoveryEmailVerifiedAt) return false;
  const user = await auth.getUserById(record.userId);
  // Auth's native recovery email must be independently confirmed and still be
  // the same address. A phone OTP never sets this state.
  return user?.email?.toLowerCase() === recoveryEmail && !!user.emailConfirmedAt;
}

export async function claimEmailAlias({ email, userId, store, auth }) {
  const loginEmail = normalizeEmail(email);
  if (!loginEmail) return { ok: false, error: 'Invalid email address.' };
  const user = await auth.getUserById(userId);
  if (!user?.phoneConfirmedAt || !PH_MOBILE.test(user.phone)) {
    return { ok: false, error: 'Phone verification is required.' };
  }
  // Production store must perform this atomically with a unique index, check
  // Auth email identities, and coordinate with a Before User Created hook.
  const claimed = await store.claimIfAvailable({
    email: loginEmail, userId, phone: user.phone, expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  return claimed ? { ok: true } : { ok: false, error: 'This email address is unavailable.' };
}
