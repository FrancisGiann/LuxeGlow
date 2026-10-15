import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminAppointmentActions } from '../src/utils/adminAppointmentActions.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const adminPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/AdminPage.jsx'), 'utf8');
const adminDialog = readFileSync(resolve(projectRoot, 'frontend/src/components/admin/AdminDialog.jsx'), 'utf8');

test('appointment details offer Confirm, completion, and reason-backed cancellation for active records', () => {
  assert.deepEqual(getAdminAppointmentActions('Pending'), [
    { status: 'Confirmed', label: 'Confirm', variant: 'primary' },
    { status: 'Cancelled', label: 'Cancel appointment', variant: 'secondary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Confirmed'), [
    { status: 'Completed', label: 'Mark completed', variant: 'primary' },
    { status: 'Cancelled', label: 'Cancel appointment', variant: 'secondary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Cancelled'), []);
  assert.deepEqual(getAdminAppointmentActions('Completed'), []);
  assert.match(adminPage, /customer_cancellation_reason/);
  assert.match(adminPage, /Cancellation reason/);
  assert.match(adminPage, /statusConfirm\?\.to === "Cancelled"/);
  assert.match(adminPage, /Enter a cancellation reason between 1 and 500 characters/);
  assert.match(adminPage, /respondToNoShow\(/);
  assert.match(adminPage, /appointment\.arrived_at && \(/);
  assert.match(adminPage, /!appointment\.arrived_at &&\s*onMarkArrived/);
});

test('both appointment detail entry points disable status and reschedule while arrival is saving', () => {
  const details = adminPage.slice(
    adminPage.indexOf('function AppointmentDetailsActions'),
    adminPage.indexOf('function AppointmentDetails('),
  );
  assert.match(details, /disabled=\{arrivalBusy\}[\s\S]*?onClick=\{\(\) => onRequestStatus\(appointment, action\.status\)\}/);
  assert.match(details, /disabled=\{arrivalBusy\}[\s\S]*?onClick=\{\(\) => onReschedule\(appointment\)\}/);
  assert.match(details, /loading=\{arrivalBusy\}[\s\S]*?disabled=\{arrivalBusy \|\| !arrivalAvailable\}/);
  assert.match(adminPage, /function NotificationAppointmentDialog/);
  assert.match(adminPage, /<AppointmentDetails[\s\S]*?arrivalBusy=\{arrivalBusy\}/);
  assert.match(adminPage, /<AppointmentDetails[\s\S]*?arrivalBusy=\{arrivalBusyId === String\(selectedVisibleAppointment\.id\)\}/);
});

test('appointment actions stay in a persistent footer while details scroll and fit side by side on mobile', () => {
  const details = adminPage.slice(
    adminPage.indexOf('function AppointmentDetails('),
    adminPage.indexOf('function AppointmentQueue('),
  );
  assert.match(adminDialog, /footer \? 'flex-1' : ''/);
  assert.match(adminDialog, /footer && <div className="shrink-0 border-t border-line bg-surface/);
  assert.match(adminPage, /footer=\{appointment && \(!isTerminalAppointment\(appointment\) \|\| onViewInAppointments\)/);
  assert.match(adminPage, /footer=\{selectedVisibleAppointment && !isTerminalAppointment\(selectedVisibleAppointment\)/);
  assert.match(adminPage, /grid-cols-2/);
  assert.match(adminPage, /min-h-11 w-full sm:w-auto/);
  assert.doesNotMatch(details, /Appointment details/);
});
