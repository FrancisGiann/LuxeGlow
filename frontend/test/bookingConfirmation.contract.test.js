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
  assert.match(confirmationModal, /hidePrint \? 'Booking Details' : 'Booking Confirmation'/);
  assert.match(confirmationModal, /Appointment record only — not proof of payment\./);

  for (const source of [bookingPage, appointmentsPage, confirmationModal]) {
    assert.doesNotMatch(source, /View \/ print receipt|Receipt preview|Booking Receipt|Close receipt preview/);
  }
});

test('appointment actions keep distinct customer-facing labels', () => {
  for (const label of [
    'View booking details',
    'Change date or time',
    'Cancel booking',
    'View / print booking confirmation',
  ]) {
    assert.ok(appointmentsPage.includes(label), `Missing appointment action label: ${label}`);
  }
});
