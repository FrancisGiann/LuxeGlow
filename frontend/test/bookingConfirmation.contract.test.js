import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bookingPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/BookingPage.jsx'), 'utf8');
const appointmentsPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/dashboard/MyAppointmentsPage.jsx'), 'utf8');
const confirmationModal = readFileSync(resolve(projectRoot, 'frontend/src/components/booking/BookingReceiptModal.jsx'), 'utf8');

test('customer-facing booking record labels use booking confirmation terminology', () => {
  assert.match(bookingPage, /View \/ print booking confirmation/);
  assert.match(appointmentsPage, /View \/ print booking confirmation/);
  assert.match(confirmationModal, /Booking confirmation preview/);
  assert.match(confirmationModal, />Booking Confirmation</);
  assert.match(confirmationModal, /Appointment record only — not proof of payment\./);

  for (const source of [bookingPage, appointmentsPage, confirmationModal]) {
    assert.doesNotMatch(source, /View \/ print receipt|Receipt preview|Booking Receipt|Close receipt preview/);
  }
});

test('completed appointment confirmation action uses the shared responsive button cell', () => {
  assert.match(appointmentsPage, /import \{ Button \} from ['"]\.\.\/\.\.\/components\/ui\/Button['"]/);
  assert.match(appointmentsPage, /lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,1fr\)_auto_minmax\(0,auto\)\]/);
  assert.match(appointmentsPage, /flex w-full justify-start lg:justify-end/);
  assert.match(appointmentsPage, /<Button type="button" variant="soft" size="sm"[^>]*whitespace-nowrap w-full lg:w-auto/);
  assert.doesNotMatch(appointmentsPage, /inline-flex min-h-10[^>]*View \/ print receipt/);
});
