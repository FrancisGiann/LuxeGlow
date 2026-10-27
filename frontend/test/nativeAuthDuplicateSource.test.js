import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Audits the pinned official source, not a reimplementation of the Auth API.
// Hosted version/configuration still requires separate metadata verification.
test('native Auth source normalizes before duplicate lookup and never inserts an existing account', { skip: !process.env.AUTH_SOURCE_ROOT }, async () => {
  const source = await readFile(resolve(process.env.AUTH_SOURCE_ROOT, 'internal/api/signup.go'), 'utf8');
  const mail = await readFile(resolve(process.env.AUTH_SOURCE_ROOT, 'internal/api/mail.go'), 'utf8');
  assert.match(mail, /return strings\.ToLower\(email\), nil/);
  assert.ok(source.indexOf('params.Email, err = a.validateEmail(params.Email)') < source.indexOf('models.IsDuplicatedEmail(db, params.Email'));
  assert.match(source, /if user != nil \{[\s\S]*?return UserExistsError[\s\S]*?\} else \{\s*user, terr = a.signupNewUser/);
  assert.match(source, /sanitizeUser\(user, params\)/);
  assert.match(source, /u\.ID = uuid\.Must\(uuid\.NewV4\(\)\)/);
});

test('native email index rejects a second normalized insert after both callers observed available', { skip: !process.env.AUTH_SOURCE_ROOT || !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec('create schema auth; create table auth.users(id serial primary key, email text);');
    const migration = await readFile(resolve(process.env.AUTH_SOURCE_ROOT, 'migrations/20221215195500_modify_users_email_unique_index.up.sql'), 'utf8');
    await db.exec(migration.replaceAll('{{ index .Options "Namespace" }}', 'auth'));
    const before = await Promise.all([db.query("select not exists(select 1 from auth.users where email='same@example.test') as available"), db.query("select not exists(select 1 from auth.users where email='same@example.test') as available")]);
    assert.ok(before.every((result) => result.rows[0].available));
    const attempts = await Promise.allSettled(['Same@EXAMPLE.test', 'same@example.test'].map((email) => db.query('insert into auth.users(email) values(lower($1))', [email])));
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(attempts.find((r) => r.status === 'rejected').reason.code, '23505');
    assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count, 1);
  } finally { await db.close(); }
});
