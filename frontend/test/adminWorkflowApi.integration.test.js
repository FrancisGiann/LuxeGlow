import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalEnv = Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].map((key) => [key, process.env[key]]));
const adminId = '123e4567-e89b-42d3-a456-426614174000';
const targetId = '987e4567-e89b-42d3-a456-426614174000';
const appointmentId = '423e4567-e89b-42d3-a456-426614174000';
const noShowAppointmentId = '523e4567-e89b-42d3-a456-426614174000';
const adminNoShowAppointmentId = '823e4567-e89b-42d3-a456-426614174000';
const rosterOwnerId = '623e4567-e89b-42d3-a456-426614174000';
const rosterStaffId = '723e4567-e89b-42d3-a456-426614174000';
const calls = [];
const profiles = new Map();
const staffMembers = new Map();
const faqs = new Map();
const closures = new Map();
const appointments = new Map();
let uploadStatus = 200;
let uploadBody = { success: true, mocked: true, image_url: 'https://fixture.invalid/image.webp', image_public_id: 'mock-image' };
let server;
let api;
let customerApi;
let supabase;

const json = (body, status = 200) => Response.json(body, { status });
const objectResponse = (request, rows) => {
  const values = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (String(request.headers.get('accept') || '').toLowerCase().includes('application/vnd.pgrst.object+json')) {
    if (values.length !== 1) return json({ code: 'PGRST116', details: `The result contains ${values.length} rows`, message: 'JSON object requested, multiple (or no) rows returned.' }, 406);
    return json(values[0]);
  }
  return json(values);
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method || 'GET';
  const request = new Request(url, init);
  const contentType = request.headers.get('content-type') || '';
  const body = contentType.includes('application/json') && init.body ? JSON.parse(init.body) : init.body;
  calls.push({ method, path: url.pathname, query: url.searchParams, body, request });

  if (url.pathname.endsWith('/auth/v1/user')) return json({ id: adminId, email: 'admin@example.test', user_metadata: {} });
  if (url.pathname.endsWith('/rest/v1/profiles')) {
    if (method === 'GET') {
      const idFilter = url.searchParams.get('id') || '';
      const id = idFilter.startsWith('eq.') ? idFilter.slice(3) : '';
      return objectResponse(request, profiles.get(id));
    }
    if (method === 'PATCH') {
      const idFilter = url.searchParams.get('id') || '';
      const id = idFilter.startsWith('eq.') ? idFilter.slice(3) : '';
      const profile = profiles.get(id);
      if (!profile) return json([], 200);
      Object.assign(profile, body || {});
      return json([], 200);
    }
  }
  if (url.pathname.endsWith('/rest/v1/faqs')) {
    if (method === 'POST') {
      const id = Number(body?.id) || Math.max(0, ...faqs.keys()) + 1;
      const row = { is_published: true, ...faqs.get(id), ...body, id };
      faqs.set(id, row);
      return objectResponse(request, row);
    }
    if (method === 'DELETE') {
      const idFilter = url.searchParams.get('id') || '';
      const id = Number(idFilter.startsWith('eq.') ? idFilter.slice(3) : 0);
      faqs.delete(id);
      return json([], 200);
    }
  }
  if (url.pathname.endsWith('/rest/v1/appointments') && method === 'PATCH') {
    const idFilter = url.searchParams.get('id') || '';
    const id = idFilter.startsWith('eq.') ? idFilter.slice(3) : '';
    const appointment = appointments.get(id);
    if (!appointment) return json([], 200);
    Object.assign(appointment, body || {});
    return json([], 200);
  }
  if (url.pathname.endsWith('/rest/v1/staff_members')) {
    const idFilter = url.searchParams.get('id') || '';
    const id = idFilter.startsWith('eq.') ? idFilter.slice(3) : '';
    if (method === 'GET') return objectResponse(request, [...staffMembers.values()]);
    if (method === 'PATCH') {
      const member = staffMembers.get(id);
      if (!member) return json([], 200);
      Object.assign(member, body || {});
      return objectResponse(request, [{
        id: member.id,
        is_active: member.is_active,
        is_bookable: member.is_bookable,
        position_title: member.position_title,
      }]);
    }
  }
  if (url.pathname.endsWith('/functions/v1/upload-service-image')) return json(uploadBody, uploadStatus);
  if (url.pathname.endsWith('/functions/v1/invite-staff')) return json({ success: true, user_id: targetId });
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.slice('/rest/v1/rpc/'.length);
    if (name === 'get_salon_closures') return json([...closures.values()].filter((item) => item.closure_date >= body.p_from && item.closure_date <= body.p_to));
    if (name === 'get_staff_rating_aggregates') return json([
      { staff_id: rosterStaffId, average_rating: 4.5, rating_count: 2 },
    ]);
    if (name === 'save_salon_closure') {
      const row = { closure_date: body.p_closure_date, reason: body.p_reason };
      closures.set(row.closure_date, row);
      return json(row);
    }
    if (name === 'delete_salon_closure') { closures.delete(body.p_closure_date); return json(null); }
    if (name === 'get_schedule_conflicts') return json([{ reference_no: 'BK-MOCK-CONFLICT', local_date: body.p_from, reason: 'Outside salon hours', status: 'Confirmed' }]);
    if (name === 'mark_appointment_arrived') {
      const appointment = appointments.get(body.p_appointment_id);
      if (!appointment || appointment.status !== 'Confirmed') return json({ message: 'Only confirmed appointments can be marked arrived.' }, 400);
      appointment.arrived_at = '2026-10-09T02:00:00.000Z';
      return json(appointment.arrived_at);
    }
    if (name === 'respond_to_no_show') {
      const appointment = appointments.get(body.p_appointment_id);
      if (!appointment || appointment.status !== 'Confirmed') return json('not_eligible');
      if (body.p_cancel) return json({ message: 'Manual no-show cancellation is unavailable.' }, 403);
      appointment.no_show_reviewed_at = '2026-10-09T02:00:00.000Z';
      return json('kept');
    }
    if (name === 'reschedule_appointment') {
      const appointment = appointments.get(body.p_appointment_id);
      if (!appointment) return json({ message: 'Appointment not found.' }, 404);
      Object.assign(appointment, { local_date: body.p_date, local_time: `${body.p_time}:00` });
      return json({ id: appointment.id, status: appointment.status });
    }
  }
  throw new Error(`Unexpected mock request: ${method} ${url.pathname}`);
};

globalThis.window = { location: { origin: 'https://fixture.example' } };
process.env.VITE_SUPABASE_URL = 'https://supabase.fixture.test';
process.env.VITE_SUPABASE_ANON_KEY = 'local-fixture-anon-key';

before(async () => {
  server = await createServer({ root: frontendRoot, configFile: resolve(frontendRoot, 'vite.config.js'), server: { middlewareMode: true }, appType: 'custom' });
  api = await server.ssrLoadModule('/src/api/admin.js');
  customerApi = await server.ssrLoadModule('/src/api/endpoints.js');
  ({ supabase } = await server.ssrLoadModule('/src/lib/supabase.js'));
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: adminId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.abcdefgh`;
  const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: 'fixture-refresh-token' });
  assert.equal(error, null);
});

beforeEach(() => {
  calls.length = 0;
  profiles.clear();
  profiles.set(adminId, { id: adminId, role: 'admin', is_active: true });
  profiles.set(targetId, { id: targetId, role: 'head', is_active: true, accepts_appointments: true });
  staffMembers.clear();
  staffMembers.set(rosterOwnerId, { id: rosterOwnerId, roster_key: 'owner-leth-s-alfabete', record_kind: 'owner', full_name: 'Leth S. Alfabete', position_title: null, is_active: true, is_bookable: false, created_at: '2026-10-14T00:00:00Z' });
  staffMembers.set(rosterStaffId, { id: rosterStaffId, roster_key: 'staff-jhona-hael-amparado', record_kind: 'staff', full_name: 'Jhona Hael Amparado', position_title: '   Nail   Artist ', is_active: true, is_bookable: true, created_at: '2026-10-14T00:00:00Z' });
  faqs.clear();
  faqs.set(1, { id: 1, question: 'How do I book?', answer: 'Book online.', display_order: 1, is_published: true });
  closures.clear();
  appointments.clear();
  appointments.set(appointmentId, { id: appointmentId, status: 'Confirmed', arrived_at: null });
  appointments.set(noShowAppointmentId, { id: noShowAppointmentId, status: 'Confirmed', no_show_reviewed_at: null });
  appointments.set(adminNoShowAppointmentId, { id: adminNoShowAppointmentId, status: 'Confirmed', no_show_reviewed_at: null });
  uploadStatus = 200;
  uploadBody = { success: true, mocked: true, image_url: 'https://fixture.invalid/image.webp', image_public_id: 'mock-image' };
});

after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('account activation and appointment access are separate scoped updates', async () => {
  assert.deepEqual(await api.updateAdminProfile(targetId, { accepts_appointments: false }), { success: true });
  assert.equal(profiles.get(targetId).accepts_appointments, false);
  assert.deepEqual(await api.updateAdminProfile(targetId, { is_active: false }), { success: true });
  assert.equal(profiles.get(targetId).is_active, false);
  const updates = calls.filter((call) => call.path.endsWith('/profiles') && call.method === 'PATCH');
  assert.equal(updates.length, 2);
  assert.ok(updates.every((call) => call.query.get('id') === `eq.${targetId}`));
});

test('team roster reads include safe published ratings and admin edits only allowed fields', async () => {
  const roster = await api.listAdminStaffMembers();
  assert.equal(roster.length, 2);
  assert.deepEqual(roster.find((member) => member.record_kind === 'owner'), {
    ...staffMembers.get(rosterOwnerId), average_rating: 0, rating_count: 0,
  });
  assert.equal(roster.find((member) => member.id === rosterStaffId).position_title, 'Nail Artist');
  assert.equal(roster.find((member) => member.id === rosterStaffId).average_rating, 4.5);
  assert.equal(roster.find((member) => member.id === rosterStaffId).rating_count, 2);
  const result = await api.updateAdminStaffMember(rosterStaffId, {
    is_active: false,
    position_title: 'Senior Nail Artist',
  });
  assert.deepEqual(result, {
    success: true,
    is_active: false,
    is_bookable: true,
    position_title: 'Senior Nail Artist',
  });
  const update = calls.find((call) => call.path.endsWith('/staff_members') && call.method === 'PATCH');
  assert.equal(update.query.get('id'), `eq.${rosterStaffId}`);
  assert.deepEqual(update.body, { is_active: false, position_title: 'Senior Nail Artist' });
});

test('staff updates reject malformed targets and unsupported fields before writing', async () => {
  const before = calls.length;
  assert.deepEqual(await api.updateAdminStaffMember('invalid', { is_active: false }), {
    success: false, error: 'Invalid staff member.',
  });
  assert.deepEqual(await api.updateAdminStaffMember(rosterStaffId, null), {
    success: false, error: 'Choose valid staff changes.',
  });
  assert.deepEqual(await api.updateAdminStaffMember(rosterStaffId, { record_kind: 'owner' }), {
    success: false, error: 'No staff changes supplied.',
  });
  assert.equal(calls.length, before);
});

test('FAQ create, edit, and delete send scoped API requests and update fixture state', async () => {
  const created = await api.saveFaq({ question: 'What should I bring?', answer: 'Nothing special.', display_order: 2 });
  assert.equal(created.success, true);
  assert.equal(faqs.size, 2);
  const edited = await api.saveFaq({ id: 2, question: 'What should I bring?', answer: 'Come as you are.', display_order: 2 });
  assert.equal(edited.success, true);
  assert.equal(faqs.get(2).answer, 'Come as you are.');
  assert.deepEqual(await api.deleteFaq(2), { success: true });
  assert.equal(faqs.has(2), false);
  assert.equal(calls.filter((call) => call.path.endsWith('/faqs') && call.method === 'POST').length, 2);
  assert.equal(calls.filter((call) => call.path.endsWith('/faqs') && call.method === 'DELETE').length, 1);
});

test('date closures and conflict lookup validate ranges and preserve the selected date', async () => {
  assert.equal((await api.saveAdminClosure('2026-12-25', 'Holiday')).success, true);
  assert.deepEqual(await api.listAdminClosures('2026-12-01', '2026-12-31'), [{ closure_date: '2026-12-25', reason: 'Holiday' }]);
  const conflicts = await api.listScheduleConflicts('2026-12-01', '2026-12-31');
  assert.equal(conflicts[0].reference_no, 'BK-MOCK-CONFLICT');
  assert.deepEqual(await api.deleteAdminClosure('2026-12-25'), { success: true });
  assert.equal(closures.size, 0);
  await assert.rejects(api.listAdminClosures('bad-date', '2026-12-31'), /valid closure date range/i);
});

test('arrival, no-show acknowledgment, and allowed staff transitions call their separate APIs', async () => {
  assert.deepEqual(await api.markAppointmentArrived(appointmentId), { success: true, arrived_at: '2026-10-09T02:00:00.000Z' });
  assert.equal(appointments.get(appointmentId).arrived_at, '2026-10-09T02:00:00.000Z');
  assert.deepEqual(await api.respondToNoShow(noShowAppointmentId, false), { success: true, outcome: 'kept' });
  assert.ok(appointments.get(noShowAppointmentId).no_show_reviewed_at);
  assert.deepEqual(await api.updateAppointmentStatus(appointmentId, 'Completed'), { success: true });
  assert.equal(appointments.get(appointmentId).status, 'Completed');
  const beforeManualCancellation = calls.length;
  const rejectedStatus = await api.updateAppointmentStatus(noShowAppointmentId, 'Cancelled', 'Service unavailable');
  const rejectedNoShow = await api.respondToNoShow(adminNoShowAppointmentId, true);
  assert.equal(rejectedStatus.success, false);
  assert.match(rejectedStatus.error, /Manual appointment cancellation is unavailable/i);
  assert.equal(rejectedNoShow.success, false);
  assert.match(rejectedNoShow.error, /cancelled automatically 24 hours/i);
  assert.equal(calls.length, beforeManualCancellation, 'manual cancellation attempts stop before any Supabase request');
  assert.equal(appointments.get(noShowAppointmentId).status, 'Confirmed');
  assert.equal(appointments.get(adminNoShowAppointmentId).status, 'Confirmed');
  assert.deepEqual(await api.rescheduleAppointment(appointmentId, '2026-10-12', '11:00'), { success: true });
  assert.equal(appointments.get(appointmentId).local_time, '11:00:00');
});

test('manual cancellation is denied before writes for Head and Admin while both retain other workflows', async () => {
  for (const role of ['admin', 'head']) {
    profiles.set(adminId, { id: adminId, role, is_active: true });
    const beforeWrites = calls.length;
    const statusResult = await api.updateAppointmentStatus(appointmentId, 'Cancelled', 'No longer needed');
    const noShowResult = await api.respondToNoShow(noShowAppointmentId, true);
    assert.equal(statusResult.success, false);
    assert.equal(noShowResult.success, false);
    assert.match(statusResult.error, /Manual appointment cancellation is unavailable/i);
    assert.match(noShowResult.error, /cancelled automatically 24 hours/i);
    assert.equal(calls.length, beforeWrites, `${role} cancellation attempts must stop before Supabase`);
  }

  profiles.set(adminId, { id: adminId, role: 'head', is_active: true });
  await assert.rejects(api.inviteStaff({ email: 'new-head@example.test', role: 'head' }), /Administrator access required/i);
  assert.deepEqual(await api.respondToNoShow(noShowAppointmentId, false), { success: true, outcome: 'kept' });
  assert.deepEqual(await api.updateAppointmentStatus(appointmentId, 'Completed'), { success: true });
  assert.equal(appointments.get(appointmentId).status, 'Completed');
});

test('registration rejects malformed phone numbers before Supabase and preserves valid formatting', async () => {
  const fields = { first_name: 'Mia', last_name: 'Santos', email: 'mia@example.test', password: 'GoodPassword9!', confirm_password: 'GoodPassword9!' };
  const before = calls.length;
  for (const phone of ['', 'letters only', '123456', '+12+3456789', '1234567890123456', 639171234567]) {
    const result = await customerApi.registerCustomer({ ...fields, phone });
    assert.equal(result.success, false);
    assert.match(result.error, /phone number with 7 to 15 digits/i);
  }
  assert.equal(calls.length, before);

  const originalSignUp = supabase.auth.signUp;
  let signupOptions;
  supabase.auth.signUp = async (options) => {
    signupOptions = options;
    return { data: { user: { id: '823e4567-e89b-42d3-a456-426614174000', email: fields.email }, session: null }, error: null };
  };
  try {
    const result = await customerApi.registerCustomer({ ...fields, phone: '  +63 (917) 000-1122  ' });
    assert.equal(result.success, true);
    assert.equal(result.needs_verification, true);
    assert.equal(signupOptions.options.data.phone, '+63 (917) 000-1122');
    assert.equal(calls.length, before);
  } finally {
    supabase.auth.signUp = originalSignUp;
  }
});

test('service image upload validates locally and only succeeds on the explicit mocked Edge response', async () => {
  const invalid = await api.uploadServiceImage('classic-manicure', new File(['x'], 'bad.gif', { type: 'image/gif' }));
  assert.equal(invalid.success, false);
  assert.equal(calls.some((call) => call.path.endsWith('/upload-service-image')), false);

  const file = new File(['fake image bytes'], 'nails.webp', { type: 'image/webp' });
  const result = await api.uploadServiceImage('classic-manicure', file);
  assert.deepEqual(result, { success: true, image_url: 'https://fixture.invalid/image.webp', image_path: 'https://fixture.invalid/image.webp', image_public_id: 'mock-image' });
  const request = calls.find((call) => call.path.endsWith('/upload-service-image'));
  assert.ok(request.body instanceof FormData);
  assert.deepEqual([...request.body.keys()], ['service_id', 'image']);
  assert.equal(request.body.get('service_id'), 'classic-manicure');

  uploadStatus = 502;
  uploadBody = { error: 'Mock image provider unavailable.' };
  await assert.rejects(api.uploadServiceImage('classic-manicure', file), /Mock image provider unavailable/);
});

test('Head cannot write Admin-only setup and content through client APIs', async () => {
  profiles.set(adminId, { id: adminId, role: 'head', is_active: true });
  const mutations = [
    () => api.saveFaq({ question: 'Synthetic question', answer: 'Synthetic answer' }),
    () => api.deleteFaq(1),
    () => api.saveService({ id: 'qa-service', name: 'Synthetic service', price: 150, duration_minutes: 30 }),
    () => api.setServiceActive('qa-service', true),
    () => api.setServiceHomepageFeatured('qa-service', true),
    () => api.updateAdminAbout({ salon_policies: 'Synthetic policy' }),
    () => api.saveAdminSchedule({ dayOfWeek: 1, openTime: '10:00', closeTime: '18:00', isClosed: false }),
    () => api.saveAdminClosure('2026-11-19', 'Synthetic closure'),
    () => api.deleteAdminClosure('2026-11-19'),
  ];
  const beforeWrites = calls.filter(({ method }) => method !== 'GET').length;
  for (const mutate of mutations) await assert.rejects(mutate(), /Administrator access required/i);
  assert.equal(calls.filter(({ method }) => method !== 'GET').length, beforeWrites,
    'denied Head actions must stop before a mutation request');
});
