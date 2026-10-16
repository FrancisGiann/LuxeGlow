import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261016020000_restrict_appointment_maintenance_execution.sql');
const mirror = read('database/supabase/migrations/20261016020000_restrict_appointment_maintenance_execution.sql');

test('worker-only SECURITY DEFINER RPCs explicitly revoke every API role and remain mirrored', () => {
  assert.equal(mirror, migration);

  for (const signature of [
    'public.run_appointment_maintenance(timestamptz)',
    'public.claim_notification_outbox(integer)',
  ]) {
    const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      migration,
      new RegExp(`revoke all on function ${escapedSignature}\\s+from public, anon, authenticated, service_role;\\s*grant execute on function ${escapedSignature} to service_role`, 'i'),
      `${signature} should be executable only by the trusted worker role`,
    );
  }

  assert.doesNotMatch(migration, /alter default privileges/i, 'the hardening must stay limited to the two worker RPCs');
});
