import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { getEventListeners } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const original = Object.fromEntries(['fetch', 'window', 'document', 'localStorage', 'BroadcastChannel', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, globalThis[key]]));
const env = Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SMS_SIGNUP_ENABLED'].map((key) => [key, process.env[key]]));
const storage = new Map();
const localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
const window = Object.assign(new EventTarget(), { location: new URL('https://site.test/'), localStorage });
Object.assign(globalThis, { window, document: Object.assign(new EventTarget(), { visibilityState: 'visible', body: { style: {} } }), localStorage, BroadcastChannel: undefined, IS_REACT_ACT_ENVIRONMENT: true });
Object.assign(process.env, { VITE_SUPABASE_URL: 'https://supabase.test', VITE_SUPABASE_ANON_KEY: 'synthetic-test-key', VITE_SMS_SIGNUP_ENABLED: 'true' });
const delay = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const fields = { first_name: 'Synthetic', last_name: 'Customer', email: 'synthetic@example.com', phone: '09170001122', password: 'Synthetic1!', confirm_password: 'Synthetic1!' };
let server, supabase, authRedirect, api, AuthProvider, useAuth, AuthModal, ToastProvider, renderer, auth, state;
let sequence = 0;
function identity(kind) {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const user = { id, role: 'authenticated', aud: 'authenticated', phone: '639170001122', email: `${kind}@example.com`, user_metadata: {} };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, session_id: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', amr: [{ method: kind === 'proof' ? 'otp' : 'password' }] })}.c3ludGhldGlj`;
  const session = { user, access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer' };
  state.sessions.set(token, { ...session, kind, alive: true });
  return session;
}
function bearer(init) { return new Headers(init.headers).get('authorization')?.replace(/^Bearer /i, '') || ''; }
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'supabase.test', 'This test must never access an external service');
  const token = bearer(init);
  const call = { path: url.pathname, scope: url.searchParams.get('scope'), token };
  state.calls.push(call);
  if (url.pathname === '/functions/v1/signup-email-availability') return Response.json({ available: true });
  if (url.pathname === '/auth/v1/signup') return Response.json({ user: { id: 'synthetic-signup' }, session: null });
  if (url.pathname === '/auth/v1/verify') {
    if (JSON.parse(init.body || '{}').type === 'recovery') return Response.json(identity('primary'));
    const gate = state.verifyGates.shift();
    if (gate) await gate.promise;
    if (state.invalidOtp) return Response.json({ code: 'otp_expired', message: 'Token has expired or is invalid' }, { status: 403 });
    const proof = identity('proof');
    state.proofs.push(proof.access_token);
    return Response.json(proof);
  }
  if (url.pathname === '/functions/v1/claim-sms-signup') {
    const gate = state.claimGates.shift();
    if (gate) await gate.promise;
    else await delay(10); // Allow queued AuthProvider profile refreshes to run.
    if (state.claimThrows) throw new Error('Synthetic claim transport failure');
    const proof = state.sessions.get(token);
    assert.equal(proof?.kind, 'proof', 'Claim must use the captured isolated proof token');
    if (!proof?.alive) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (state.claimFails) return Response.json({ error: 'Could not finish signup' }, { status: 503 });
    state.claimed.push(token);
    return Response.json({ success: true });
  }
  if (url.pathname === '/auth/v1/logout') {
    const session = state.sessions.get(token);
    if (state.cleanupFails && session?.kind === 'proof') return Response.json({ code: 'unexpected_failure', message: 'Synthetic cleanup failure' }, { status: 500 });
    if (session) session.alive = false;
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/auth/v1/user') {
    const session = state.sessions.get(token);
    return session?.alive ? Response.json(session.user) : Response.json({ code: 'session_not_found', message: 'Session from session_id claim in JWT does not exist' }, { status: 403 });
  }
  if (url.pathname === '/rest/v1/profiles') {
    const session = state.sessions.get(token);
    // Real signup RLS intentionally returns no profile for an OTP session.
    return Response.json(session?.kind === 'primary' && session.alive ? [{ id: session.user.id, role: 'customer', is_active: true }] : []);
  }
  throw new Error(`Unexpected synthetic request: ${url.pathname}`);
};
function Probe() { const value = useAuth(); React.useLayoutEffect(() => { auth = value; }, [value]); return null; }
async function mount(withModal = false) {
  await act(async () => {
    const provider = React.createElement(AuthProvider, null, React.createElement(Probe), withModal ? React.createElement(AuthModal) : null);
    renderer = TestRenderer.create(withModal ? React.createElement(MemoryRouter, null, React.createElement(ToastProvider, null, provider)) : provider);
    await delay(10);
  });
  await act(async () => { assert.equal((await auth.register(fields)).ok, true); });
  assert.equal(auth.modalView, 'verify-phone');
}
async function startVerification() {
  let promise;
  await act(async () => { promise = auth.verifyPhoneCode('123456'); await delay(); });
  return { promise };
}
async function finish(promise) { let result; await act(async () => { result = await promise; await delay(10); }); return result; }
function proofCleanupCalls() { return state.calls.filter((call) => call.path === '/auth/v1/logout' && state.proofs.includes(call.token)); }
function assertIsolatedCleanup(count = 1) {
  const calls = proofCleanupCalls();
  assert.equal(calls.length, count);
  for (const call of calls) assert.equal(call.scope, 'local');
  assert.equal(state.calls.some((call) => call.path === '/rest/v1/profiles' && state.proofs.includes(call.token)), false);
  assert.equal([...storage.values()].some((value) => state.proofs.some((token) => value.includes(token))), false);
}
async function signInPrimary() {
  const primary = identity('primary');
  await act(async () => { assert.equal((await supabase.auth.setSession(primary)).error, null); await delay(10); });
  return primary;
}
async function assertPrimaryPreserved(primary) {
  assert.equal((await supabase.auth.getSession()).data.session?.access_token, primary.access_token);
  assert.equal(state.sessions.get(primary.access_token).alive, true);
  assert.equal(state.calls.some((call) => call.path === '/auth/v1/logout' && call.token === primary.access_token), false);
}
before(async () => {
  state = { sessions: new Map(), calls: [], proofs: [], claimed: [], verifyGates: [], claimGates: [] };
  server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  ({ AuthProvider, useAuth } = await server.ssrLoadModule('/src/context/AuthContext.jsx'));
  ({ supabase, authRedirect } = await server.ssrLoadModule('/src/lib/supabase.js'));
  api = await server.ssrLoadModule('/src/api/endpoints.js');
  ({ AuthModal } = await server.ssrLoadModule('/src/components/auth/AuthModal.jsx'));
  ({ ToastProvider } = await server.ssrLoadModule('/src/components/ui/Toast.jsx'));
});
beforeEach(async () => {
  await supabase.auth.signOut({ scope: 'local' });
  storage.clear();
  state = { sessions: new Map(), calls: [], proofs: [], claimed: [], verifyGates: [], claimGates: [] };
  auth = null;
  Object.assign(authRedirect, { type: '', isPasswordSetup: false, isResetPath: false, hasError: false, hasCallbackCredentials: false });
});
afterEach(async () => {
  if (renderer) { await act(async () => renderer.unmount()); renderer = null; }
  assert.equal(getEventListeners(window, 'visibilitychange').length, 2, 'Temporary proof clients must dispose their event listeners');
  assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
});
after(async () => {
  await supabase?.auth.stopAutoRefresh();
  await server?.close();
  Object.assign(globalThis, original);
  for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test('mounted AuthProvider completes signup without exposing the OTP session or triggering profile signout', async () => {
  await mount();
  const events = [];
  const { data } = supabase.auth.onAuthStateChange((event) => events.push(event));
  const result = await finish(auth.verifyPhoneCode('123456'));
  data.subscription.unsubscribe();
  assert.deepEqual(result, { ok: true });
  assert.equal(auth.modalView, 'login');
  assert.equal(auth.isAuthenticated, false);
  assert.equal((await supabase.auth.getSession()).data.session, null);
  assert.equal(events.includes('SIGNED_IN'), false);
  assert.equal(state.claimed.length, 1);
  assertIsolatedCleanup();
});

test('rapid duplicate verification calls share one attempt', async () => {
  await mount();
  const gate = deferred(); state.verifyGates.push(gate);
  const first = auth.verifyPhoneCode('123456');
  assert.equal(auth.verifyPhoneCode('123456'), first);
  gate.resolve();
  assert.deepEqual(await finish(first), { ok: true });
  assert.equal(state.calls.filter((call) => call.path === '/auth/v1/verify').length, 1);
  assertIsolatedCleanup();
});

for (const action of ['close', 'navigate', 'unmount']) test(`cancellation by ${action} before OTP response skips claim and cleans the returned proof`, async () => {
  await mount();
  const gate = deferred(); state.verifyGates.push(gate);
  const { promise } = await startVerification();
  await act(async () => {
    if (action === 'close') auth.closeAuth();
    if (action === 'navigate') auth.openAuth('forgot-request');
    if (action === 'unmount') { renderer.unmount(); renderer = null; }
  });
  gate.resolve();
  assert.deepEqual(await finish(promise), { ok: false, cancelled: true });
  assert.equal(state.claimed.length, 0);
  assert.equal(state.calls.some((call) => call.path === '/functions/v1/claim-sms-signup'), false);
  if (action !== 'unmount') assert.equal(auth.modalView, action === 'close' ? null : 'forgot-request');
  assertIsolatedCleanup();
});

test('closing after claim dispatch awaits its outcome without reopening the modal', async () => {
  await mount();
  const gate = deferred(); state.claimGates.push(gate);
  const { promise } = await startVerification();
  assert.equal(state.calls.some((call) => call.path === '/functions/v1/claim-sms-signup'), true);
  await act(async () => auth.closeAuth());
  gate.resolve();
  assert.deepEqual(await finish(promise), { ok: false, cancelled: true });
  assert.equal(auth.modalView, null);
  assert.equal(auth.sessionNotice, '');
  assert.equal(state.claimed.length, 1); // A dispatched claim cannot be rolled back by closing.
  assertIsolatedCleanup();
});

for (const stage of ['verify', 'claim']) test(`a new shared login during ${stage} survives cleanup and stale signup completion`, async () => {
  await mount();
  const gate = deferred(); state[stage === 'verify' ? 'verifyGates' : 'claimGates'].push(gate);
  const { promise } = await startVerification();
  const primary = await signInPrimary();
  gate.resolve();
  assert.deepEqual(await finish(promise), { ok: false, cancelled: true });
  await assertPrimaryPreserved(primary);
  assert.equal(auth.customer?.id, primary.user.id);
  assert.equal(auth.sessionNotice, '');
  assertIsolatedCleanup();
});

test('old completion cannot clear or finish a replacement verification attempt', async () => {
  await mount();
  const firstGate = deferred(); state.claimGates.push(firstGate);
  const { promise: first } = await startVerification();
  await act(async () => { auth.closeAuth(); });
  await act(async () => { await auth.register({ ...fields, email: 'replacement@example.com' }); });
  const secondGate = deferred(); state.verifyGates.push(secondGate);
  const { promise: second } = await startVerification();
  firstGate.resolve();
  assert.deepEqual(await finish(first), { ok: false, cancelled: true });
  assert.equal(auth.verifyPhoneCode('123456'), second);
  assert.equal(auth.modalView, 'verify-phone');
  secondGate.resolve();
  assert.deepEqual(await finish(second), { ok: true });
  assert.equal(auth.modalView, 'login');
  assertIsolatedCleanup(2);
});

test('invalid OTP never claims or logs out any session', async () => {
  await mount(); state.invalidOtp = true;
  assert.equal((await finish(auth.verifyPhoneCode('123456'))).error, 'That code is invalid or expired.');
  assert.equal(state.claimed.length, 0);
  assertIsolatedCleanup(0);
});

for (const scenario of ['success', 'claimFails', 'claimThrows', 'cleanupFails']) test(`existing primary login survives isolated proof ${scenario}`, async () => {
  const primary = await signInPrimary();
  if (scenario !== 'success') state[scenario] = true;
  const result = await api.verifySignupPhone({ phone: fields.phone, email: fields.email, code: '123456' });
  assert.equal(result.success, scenario === 'success');
  if (scenario === 'cleanupFails') assert.match(result.error, /^Account created\./);
  await assertPrimaryPreserved(primary);
  assertIsolatedCleanup();
});

async function submitPhoneForm() {
  let promise;
  await act(async () => {
    const originalFormData = globalThis.FormData;
    globalThis.FormData = class { get(name) { return name === 'code' ? '123456' : null; } };
    try { promise = renderer.root.findAllByType('form').find((node) => node.findAllByProps({ id: 'signup-sms-code' }).length).props.onSubmit({ preventDefault() {}, currentTarget: {} }); }
    finally { globalThis.FormData = originalFormData; }
    await delay();
  });
  return { promise };
}
function submitButton() { return renderer.root.findAllByType('form').find((node) => !String(node.props.className).split(' ').includes('hidden')).findAllByType('button').find((node) => node.props.type === 'submit'); }

test('AuthModal resets cancelled busy state without writing an old failure into a newer view', async () => {
  await mount(true);
  const gate = deferred(); state.claimGates.push(gate);
  const { promise } = await submitPhoneForm();
  assert.equal(submitButton().props.disabled, true);
  await act(async () => { auth.closeAuth(); });
  await act(async () => { auth.openAuth('login'); });
  assert.equal(submitButton().props.disabled, false);
  state.claimFails = true;
  gate.resolve();
  await finish(promise);
  assert.equal(auth.modalView, 'login');
  assert.equal(submitButton().props.disabled, false);
  assert.equal(renderer.root.findAll((node) => node.props.role === 'alert').length, 0);
  assert.equal(JSON.stringify(renderer.toJSON()).includes('Could not verify that code'), false);
  assertIsolatedCleanup();
});

test('AuthModal old completion does not clear the busy state of a replacement code submission', async () => {
  await mount(true);
  const firstGate = deferred(); state.claimGates.push(firstGate);
  const { promise: first } = await submitPhoneForm();
  await act(async () => auth.closeAuth());
  await act(async () => { await auth.register({ ...fields, email: 'replacement@example.com' }); });
  const secondGate = deferred(); state.verifyGates.push(secondGate);
  const { promise: second } = await submitPhoneForm();
  assert.equal(submitButton().props.disabled, true);
  firstGate.resolve();
  await finish(first);
  assert.equal(submitButton().props.disabled, true);
  secondGate.resolve();
  await finish(second);
  assert.equal(auth.modalView, 'login');
  assert.equal(submitButton().props.disabled, false);
  assertIsolatedCleanup(2);
});


test('same-identity SIGNED_IN events do not cancel an isolated verification', async () => {
  const primary = await signInPrimary();
  await mount();
  const gate = deferred(); state.claimGates.push(gate);
  const { promise } = await startVerification();
  await act(async () => { assert.equal((await supabase.auth.setSession(primary)).error, null); });
  gate.resolve();
  assert.deepEqual(await finish(promise), { ok: true });
  await assertPrimaryPreserved(primary);
  assertIsolatedCleanup();
});

test('a password-recovery callback cancels pending signup without losing the recovery screen/session', async () => {
  await mount();
  const gate = deferred(); state.claimGates.push(gate);
  const { promise } = await startVerification();
  Object.assign(authRedirect, { type: 'recovery', isResetPath: true, isPasswordSetup: true, hasCallbackCredentials: true });
  let recovery;
  await act(async () => {
    recovery = await supabase.auth.verifyOtp({ token_hash: 'synthetic-recovery-hash', type: 'recovery' });
    assert.equal(recovery.error, null);
    await delay(10);
  });
  assert.equal(auth.modalView, 'forgot-reset');
  gate.resolve();
  assert.deepEqual(await finish(promise), { ok: false, cancelled: true });
  assert.equal(auth.modalView, 'forgot-reset');
  assert.equal(auth.passwordSetup?.ready, true);
  await assertPrimaryPreserved(recovery.data.session);
  assertIsolatedCleanup();
});
