import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Optional local PostgreSQL/WASM harness; never connects to hosted Supabase.
// Set PGLITE_MODULE to an installed @electric-sql/pglite module entrypoint.
test('availability SQL enforces grants, membership normalization, atomic budgets and resets', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id serial primary key, email text, role text, confirmed boolean, active boolean);
      insert into auth.users(email, role, confirmed, active) values
      ('Person+Tag@Example.test', 'customer', true, true),
      ('pending@example.test', 'customer', false, true),
      ('staff@example.test', 'staff', true, false);`);
    const sql = await readFile(new URL('../../supabase/migrations/20261027030000_signup_email_availability.sql', import.meta.url), 'utf8');
    const mirror = await readFile(new URL('../../database/supabase/migrations/20261027030000_signup_email_availability.sql', import.meta.url), 'utf8');
    assert.equal(sql, mirror);
    await db.exec(sql);
    const check = async (email, hash) => (await db.query('select public.check_signup_email_availability($1,$2) as result', [email, hash])).rows[0].result;
    for (const [i, email] of [' person+tag@EXAMPLE.test ', 'pending@example.test', 'staff@example.test'].entries()) {
      assert.deepEqual(await check(email, String(i).repeat(64)), { allowed: true, available: false });
    }
    assert.deepEqual(await check('unused@example.test', 'a'.repeat(64)), { allowed: true, available: true });
    for (let i = 1; i < 3; i++) assert.equal((await check('unused@example.test', 'a'.repeat(64))).allowed, true);
    const denied = await check('unused@example.test', 'a'.repeat(64));
    assert.equal(denied.allowed, false); assert.equal('available' in denied, false);
    assert.ok(denied.retry_after > 0);
    await db.exec("update public.signup_email_check_limits set window_started_at=clock_timestamp()-interval '16 minutes'");
    assert.equal((await check('unused@example.test', 'a'.repeat(64))).allowed, true);
    await db.exec("update public.signup_email_check_limits set attempts=60 where scope='global'");
    assert.equal((await check('unused@example.test', 'b'.repeat(64))).allowed, false);
    await db.exec("update public.signup_email_check_limits set window_started_at=clock_timestamp()-interval '16 minutes' where scope='global'");
    assert.equal((await check('unused@example.test', 'b'.repeat(64))).allowed, true);
    for (const role of ['anon', 'authenticated']) {
      const grants = await db.query(`select has_function_privilege($1, 'public.check_signup_email_availability(text,text)', 'execute') as rpc, has_table_privilege($1,'public.signup_email_check_limits','select') as table_read`, [role]);
      assert.deepEqual(grants.rows[0], { rpc: false, table_read: false });
    }
    await db.exec('set role anon');
    await assert.rejects(() => check('staff@example.test', 'c'.repeat(64)), /permission denied/);
  } finally { await db.close(); }
});
