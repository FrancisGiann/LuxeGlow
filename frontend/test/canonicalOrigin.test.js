import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { canonicalProductionUrl } from '../src/utils/canonicalOrigin.js';

test('www visits move to the existing allowed HTTPS origin', () => {
  assert.equal(canonicalProductionUrl(new URL('https://www.astridnails.online/')), 'https://astridnails.online/');
  assert.equal(canonicalProductionUrl(new URL('http://www.astridnails.online/')), 'https://astridnails.online/');
});
test('deep links, tracking parameters and Auth callback fragments survive unchanged', () => {
  const path='/reset-password?code=synthetic-code&next=%2Fadmin#access_token=synthetic-token&type=recovery';
  assert.equal(canonicalProductionUrl(new URL('https://www.astridnails.online'+path)), 'https://astridnails.online'+path);
  assert.equal(canonicalProductionUrl(new URL('https://www.astridnails.online/book?service=nails&fbclid=synthetic')), 'https://astridnails.online/book?service=nails&fbclid=synthetic');
});
test('the canonical origin never redirects itself or enters a loop', () => {
  assert.equal(canonicalProductionUrl(new URL('https://astridnails.online/admin')), null);
  const redirected=canonicalProductionUrl(new URL('https://www.astridnails.online/admin'));
  assert.equal(canonicalProductionUrl(new URL(redirected)), null);
});
test('localhost, Vercel and unrelated/lookalike hosts retain their original behavior', () => {
  for(const url of ['http://localhost:5173/','https://luxe-glow-astrid.vercel.app/','https://preview.example/','https://www.astridnails.online.attacker.invalid/']) {
    assert.equal(canonicalProductionUrl(new URL(url)),null);
  }
});
test('caller-controlled paths and next parameters cannot change the target origin', () => {
  const redirected=canonicalProductionUrl({hostname:'www.astridnails.online',pathname:'//attacker.invalid/login',search:'?next=https://attacker.invalid',hash:'#synthetic'});
  assert.equal(new URL(redirected).origin,'https://astridnails.online');
});
test('bootstrap defers Auth-bearing App import until after its canonical-origin guard', () => {
  const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/import\s+App\s+from/);
  assert.match(source,/if \(canonicalUrl\)\s*\{\s*window\.location\.replace\(canonicalUrl\);\s*\} else \{/);
  assert.ok(source.indexOf("import('./App')")>source.indexOf('} else {'));
});
