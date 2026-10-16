import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminAppointmentActions } from '../src/utils/adminAppointmentActions.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const adminPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/AdminPage.jsx'), 'utf8');
const adminDialog = readFileSync(resolve(projectRoot, 'frontend/src/components/admin/AdminDialog.jsx'), 'utf8');

test('Admins and Heads share workflow actions, while manual cancellation stays unavailable', () => {
  assert.deepEqual(getAdminAppointmentActions('Pending', 'admin'), [
    { status: 'Confirmed', label: 'Confirm', variant: 'primary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Confirmed', 'admin'), [
    { status: 'Completed', label: 'Mark completed', variant: 'primary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Pending', 'head'), [
    { status: 'Confirmed', label: 'Confirm', variant: 'primary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Confirmed', 'head'), [
    { status: 'Completed', label: 'Mark completed', variant: 'primary' },
  ]);
  assert.deepEqual(getAdminAppointmentActions('Pending'), []);
  assert.deepEqual(getAdminAppointmentActions('Pending', 'unknown'), []);
  assert.deepEqual(getAdminAppointmentActions('Cancelled', 'admin'), []);
  assert.deepEqual(getAdminAppointmentActions('Completed', 'head'), []);
  assert.match(adminPage, /customer_cancellation_reason/);
  assert.match(adminPage, /Cancellation reason/);
  assert.match(adminPage, /Acknowledge this notice to record your review/);
  assert.match(adminPage, /will still be cancelled automatically 24 hours after its scheduled start/);
  assert.doesNotMatch(adminPage, /Keep appointment|Cancel appointment/);
  assert.match(adminPage, /respondToNoShow\(/);
  assert.match(adminPage, /appointment\.arrived_at && \(/);
  assert.match(adminPage, /!appointment\.arrived_at &&\s*onMarkArrived/);
  assert.match(adminPage, /getAdminAppointmentActions\(current\.status, customer\?\.role\)/);
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
