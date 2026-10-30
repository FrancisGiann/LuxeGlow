import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { recoveryTestFixture, RECOVERY_STAGING_URL } from '../../supabase/functions/_shared/recoveryTestFixture.js';

const base = { projectUrl: RECOVERY_STAGING_URL, enabled: true };

test('staging fixture accepts only an exact configured SMS destination and eight-digit secret', () => {
  const fixture = { ...base, channel: 'sms', destination: '+639171234567', phone: '09171234567', smsCode: '87654321' };
  assert.equal(recoveryTestFixture(fixture), '87654321');
  assert.equal(recoveryTestFixture({ ...fixture, destination: '+639181234567' }), null);
  assert.equal(recoveryTestFixture({ ...fixture, smsCode: '123456' }), null);
  assert.equal(recoveryTestFixture({ ...fixture, enabled: false }), null);
});

test('staging email token is exact and is never accepted as an SMS code', () => {
  const fixture = { ...base, channel: 'email', destination: 'stage@example.test', email: ' STAGE@example.test ', emailToken: 'a'.repeat(64) };
  assert.equal(recoveryTestFixture(fixture), 'a'.repeat(64));
  assert.equal(recoveryTestFixture({ ...fixture, destination: 'other@example.test' }), null);
  assert.equal(recoveryTestFixture({ ...fixture, emailToken: '12345678' }), null);
});

test('test mode fails closed outside the one disposable project', () => {
  assert.throws(() => recoveryTestFixture({ ...base, projectUrl: 'https://fehljwfjvxubcdplnjuk.supabase.co', channel: 'sms', destination: '+639171234567', phone: '+639171234567', smsCode: '87654321' }));
});

test('test mode returns before either provider call in the recovery handler', () => {
  const source = readFileSync(fileURLToPath(new URL('../../supabase/functions/password-recovery/index.ts', import.meta.url)), 'utf8');
  const requestBranch = source.slice(source.indexOf("if (input.action === 'request')"), source.indexOf("if (input.action === 'verify')"));
  assert.match(requestBranch, /if \(testMode && !fixtureSecret\) return genericResponse\(generic\)/);
  assert.match(requestBranch, /if \(testMode\) return genericResponse\(generic\);\s*if \(channel === 'sms'\) await sendSms/);
  assert.match(source, /if \(testMode && url !== RECOVERY_STAGING_URL\) return reply/);
  assert.match(requestBranch, /if \(reserved !== true\) return testMode\s*\? reply\(\{ error: 'Staging recovery send limit reached\. No test code was created\.' \}, 429\)\s*: genericResponse\(generic\)/);
});
