import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAppointments, filterCompletedAppointmentsByDate } from '../src/utils/appointments.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('customer history includes completed visits of every age and excludes cancellations', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 2);
  const pendingDate = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
  const appointments = [
    { id: 'old', status: 'Completed', raw_date: '2020-01-15', raw_time: '10:00:00' },
    { id: 'recent', status: 'Completed', raw_date: '2026-10-10', raw_time: '11:00:00' },
    { id: 'cancelled', status: 'Cancelled', raw_date: '2026-10-11', raw_time: '12:00:00' },
    { id: 'pending', status: 'Pending', raw_date: pendingDate, raw_time: '13:00:00' },
  ];

  const groups = classifyAppointments(appointments);
  assert.deepEqual(groups.history.map(({ id }) => id), ['recent', 'old']);
  assert.deepEqual(groups.upcoming.map(({ id }) => id), ['pending']);
  assert.equal('recent' in groups, false);
});

test('completed visit date filtering compares stored Manila calendar dates exactly', () => {
  const visits = [
    { id: 'one', status: 'Completed', raw_date: '2026-10-11' },
    { id: 'two', status: 'Completed', raw_date: '2026-10-12' },
    { id: 'cancelled', status: 'Cancelled', raw_date: '2026-10-11' },
  ];

  assert.deepEqual(filterCompletedAppointmentsByDate(visits).map(({ id }) => id), ['one', 'two']);
  assert.deepEqual(filterCompletedAppointmentsByDate(visits, '2026-10-11').map(({ id }) => id), ['one']);
  assert.deepEqual(filterCompletedAppointmentsByDate(visits, '2026-10-13'), []);
});

test('customer appointment history renders only completed visits and imports its date filter', () => {
  const page = readFileSync(resolve(projectRoot, 'frontend/src/pages/dashboard/MyAppointmentsPage.jsx'), 'utf8');
  assert.match(page, /import \{ classifyAppointments, filterCompletedAppointmentsByDate \} from '\.\.\/\.\.\/utils\/appointments'/);
  assert.match(page, /const historyVisits = useMemo\(\(\) => filterCompletedAppointmentsByDate\(groups\.history, historyDate\)/);
  assert.match(page, /historyVisits\.length\}\{historyDate \? ` of \$\{groups\.history\.length\}` : ''\}/);
});
