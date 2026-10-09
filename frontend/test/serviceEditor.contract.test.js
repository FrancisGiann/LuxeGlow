import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const serviceCatalog = read('frontend/src/components/services/ServiceCatalog.jsx');
const serviceDialog = adminPage.slice(adminPage.indexOf('open={serviceDialogOpen}'), adminPage.indexOf('open={!!selectedCustomer}'));

test('service editor keeps generated IDs internal and retains the same draft ID for retries', () => {
  assert.match(adminPage, /const createServiceDraft = \(\) => \(\{\s*id: globalThis\.crypto\.randomUUID\(\)/);
  assert.match(serviceDialog, /Service name/);
  assert.match(serviceDialog, /Price \(₱\)/);
  assert.match(serviceDialog, /Duration \(minutes\)/);
  assert.doesNotMatch(serviceDialog, /Service ID|service ID|Check service ID/i);
  assert.match(adminPage, /serviceForm,\s*editingServiceId \? \{ existingId: editingServiceId \} : undefined/);
  assert.match(adminPage, /closeDisabled=\{serviceBusy\}/);
  assert.match(adminPage, /if \(serviceSaveBusyRef\.current\) return;[\s\S]*?serviceSaveBusyRef\.current = true/);
  assert.match(adminPage, /finally \{\s*serviceSaveBusyRef\.current = false;\s*setServiceBusy\(false\)/);
});

test('public service booking rows stack information on mobile and preserve desktop columns', () => {
  assert.match(serviceCatalog, /grid-cols-\[auto_minmax\(0,1fr\)\] sm:grid-cols-\[auto_minmax\(0,1fr\)_auto_auto_auto\]/);
  assert.match(serviceCatalog, /col-span-2 flex w-full items-center justify-between gap-3 sm:col-span-1/);
  assert.match(serviceCatalog, /grid-cols-\[auto_auto_minmax\(0,1fr\)\] items-center[\s\S]*?sm:grid-cols-\[auto_auto_minmax\(0,1fr\)_auto_auto\]/);
  assert.match(serviceCatalog, /col-span-3 flex w-full items-center justify-between gap-3 sm:col-span-1/);
});
