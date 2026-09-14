import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const adminNav = adminPage.slice(adminPage.indexOf('function AdminNav'), adminPage.indexOf('function AdminWorkspaceFooter'));
const adminUtilities = read('frontend/src/utils/adminAppointments.js');
const publicLayout = read('frontend/src/components/layout/PublicLayout.jsx');
const scheduleSettings = read('frontend/src/components/admin/ScheduleSettings.jsx');

test('staff and administrators land in their role-appropriate dashboard section', () => {
  assert.match(adminUtilities, /export function initialAdminTab\(role\)/);
  assert.match(adminUtilities, /return role === 'staff' \? 'appointments' : 'overview';/);
  assert.match(adminPage, /useState\(\(\) => initialAdminTab\(customer\?\.role\)\)/);
});

test('staff navigation is a collapsible single-open grouped accordion with an admin-only access group', () => {
  assert.match(adminPage, /id: 'daily-work', label: 'Daily work'/);
  assert.match(adminPage, /id: 'salon-setup', label: 'Salon setup'/);
  assert.match(adminPage, /id: 'website-content', label: 'Website content'/);
  assert.match(adminPage, /id: 'people-access', label: 'People & access'[\s\S]*?adminOnly: true/);
  assert.match(adminNav, /NAV_GROUPS\.filter\(\(group\) => !group\.adminOnly \|\| isAdmin\)/);
  assert.match(adminNav, /aria-expanded=\{expanded\} aria-controls=\{panelId\}/);
  assert.match(adminNav, /onClick=\{\(\) => setOpenGroup\(\(current\) => current === group\.id \? null : group\.id\)\}/);
  assert.match(adminNav, /onClick=\{\(\) => \{ setTab\(key\); setOpenGroup\(adminNavGroupForTab\(key\)\); onNavigate\?\.\(\); \}\}/);
  assert.match(adminNav, /aria-current=\{tab === key \? 'page' : undefined\}/);
  assert.match(adminNav, /min-h-11 items-center gap-3 rounded-lg/);
  assert.match(adminNav, /const \[openGroup, setOpenGroup\] = useState\(\(\) => adminNavGroupForTab\(tab\)/);
  assert.match(adminNav, /useEffect\(\(\) => \{\s*setOpenGroup\(adminNavGroupForTab\(tab\)\);\s*\}, \[tab\]\)/);
  const adminNavUses = adminPage.match(/<AdminNav\b[^>]*\/>/g) || [];
  assert.equal(adminNavUses.length, 2);
  assert.ok(adminNavUses.every((use) => !/\bkey\s*=/.test(use)));
});

test('staff-facing workspace and role labels stay clear on shared and admin headers', () => {
  assert.match(publicLayout, /isStaff \? 'Staff workspace' : 'My dashboard'/);
  assert.doesNotMatch(publicLayout, /Admin dashboard/);
  assert.match(adminPage, /sm:hidden">\{customer\?\.first_name \|\| 'Account'\} · \{customer\?\.role === 'admin' \? 'Administrator' : 'Staff'\}/);
  assert.match(adminPage, /join\(' '\) \|\| 'Account'\} · \{customer\?\.role === 'admin' \? 'Administrator' : 'Staff'\}/);
  assert.match(adminPage, /Staff accounts/);
  assert.match(adminPage, /Activation controls sign-in; “Accepts appointments” separately controls eligibility for new customer bookings/);
});

test('overview and secondary entry points apply appointment visibility presets', () => {
  assert.match(adminPage, /onOpenAppointments\('today'\)/);
  assert.match(adminPage, /onOpenAppointments\('pending'\)/);
  assert.match(adminPage, /onOpenAppointment\(appointment\)/);
  assert.match(adminPage, /onOpenAppointment=\{\(appointment\) => openAppointments\('appointment', appointment\)\}/);
  assert.match(adminPage, /StaffNotificationBell onOpenAppointments=\{\(\) => openAppointments\('all'\)\}/);
  assert.match(adminPage, /ScheduleSettings onOpenAppointments=\{\(\) => openAppointments\('all'\)\}/);
  assert.match(adminPage, /openAppointments\('appointment', refreshedAppointment\)/);
  assert.match(adminPage, /openAppointments\('appointment', notificationModalAppointment\)/);
  assert.equal((adminPage.match(/<AdminOverview appointments=\{appointments\} onOpenAppointments=\{openAppointments\} onOpenAppointment=\{\(appointment\) => openAppointments\('appointment', appointment\)\} \/>/g) || []).length, 2);
  assert.doesNotMatch(adminPage, /onSelectAppointment=\{\(appointment\) => \{ setSelectedAppointment\(appointment\); setTab\('appointments'\); \}\}/);
  assert.match(adminPage, /Bookings this month/);
  assert.match(adminPage, /Weekend bookings this month/);
  assert.match(adminPage, /Recent bookings/);
  assert.match(adminPage, /Popular services this month/);
});

test('monthly overview metrics use compact responsive semantic containers', () => {
  const metricsStart = adminPage.indexOf('<dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">');
  assert.notEqual(metricsStart, -1);
  const metricsEnd = adminPage.indexOf('</dl>', metricsStart);
  assert.notEqual(metricsEnd, -1);
  const metrics = adminPage.slice(metricsStart, metricsEnd + '</dl>'.length);

  assert.equal((metrics.match(/rounded-xl border border-line bg-surface p-3/g) || []).length, 2);
  assert.equal((metrics.match(/<dt\b/g) || []).length, 2);
  assert.equal((metrics.match(/<dd\b/g) || []).length, 2);
  assert.match(metrics, /<dt className="break-words text-ink-500">Bookings this month<\/dt>/);
  assert.match(metrics, /<dd className="mt-1 break-words font-bold tabular-nums text-ink-800">\{monthBookings\.length\}<\/dd>/);
  assert.match(metrics, /<dt className="break-words text-ink-500">Weekend bookings this month<\/dt>/);
  assert.match(metrics, /<dd className="mt-1 break-words font-bold tabular-nums text-ink-800">\{weekendBookings\.length\}<\/dd>/);
  assert.doesNotMatch(metrics, /<button\b/);
});

test('schedule guidance remains visible while loading and preserves conflict follow-up', () => {
  assert.match(scheduleSettings, /Edits affect future availability only\. Existing appointments never move; conflicts remain here for staff follow-up\./);
  assert.match(scheduleSettings, /if \(loading\) return <div className="space-y-4"><p className="text-sm leading-relaxed text-ink-600">\{SCHEDULE_GUIDANCE\}<\/p>/);
});
