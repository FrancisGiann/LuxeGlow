import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedBody } from '../../supabase/functions/_shared/readBoundedBody.js';

test('accepts a body at the byte limit and rejects one byte above it', async () => {
  const exact = new Request('https://example.test/hook', { method: 'POST', body: 'abcd' });
  const oversized = new Request('https://example.test/hook', { method: 'POST', body: 'abcde' });
  assert.equal(await readBoundedBody(exact, 4), 'abcd');
  assert.equal(await readBoundedBody(oversized, 4), null);
});

test('counts UTF-8 bytes and rejects invalid encoding', async () => {
  const unicode = new Request('https://example.test/hook', { method: 'POST', body: 'é' });
  const invalid = new Request('https://example.test/hook', {
    method: 'POST', body: new Uint8Array([0xff]),
  });
  assert.equal(await readBoundedBody(unicode, 1), null);
  assert.equal(await readBoundedBody(invalid, 1), null);
});
