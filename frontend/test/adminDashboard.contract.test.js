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
  assert.match(adminUtilities, /return role === 'head' \|\| role === 'admin' \? 'appointments' : 'overview';/);
  assert.match(adminPage, /useState\(\(\) => initialAdminTab\(customer\?\.role\)\)/);
});

test('staff navigation is a collapsible single-open grouped accordion with an admin-only access group', () => {
  assert.match(adminPage, /id: "daily-work",\s*label: "Daily work"/);
  assert.match(adminPage, /id: "salon-setup",\s*label: "Salon setup"/);
  assert.match(adminPage, /id: "website-content",\s*label: "Website content"/);
  assert.match(adminPage, /id: "people-access",\s*label: "Accounts management"[\s\S]*?adminOnly: true/);
  assert.match(adminNav, /NAV_GROUPS\.filter\(\(group\) => !group\.adminOnly \|\| isAdmin\)/);
  assert.match(adminNav, /aria-expanded=\{expanded\}[\s\S]*?aria-controls=\{panelId\}/);
  assert.match(adminNav, /setOpenGroup\(\(current\) =>[\s\S]*?current === group\.id \? null : group\.id/);
  assert.match(adminNav, /setTab\(key\);[\s\S]*?setOpenGroup\(adminNavGroupForTab\(key\)\);[\s\S]*?onNavigate\?\.\(\);/);
  assert.match(adminNav, /aria-current=\{tab === key \? "page" : undefined\}/);
  assert.match(adminNav, /min-h-11 items-center gap-3 rounded-lg/);
  assert.match(adminNav, /const \[openGroup, setOpenGroup\] = useState\([\s\S]*?adminNavGroupForTab\(tab\)/);
  assert.match(adminNav, /useEffect\(\(\) => \{\s*setOpenGroup\(adminNavGroupForTab\(tab\)\);\s*\}, \[tab\]\)/);
  const adminNavUses = adminPage.match(/<AdminNav\b[^>]*\/>/g) || [];
  assert.equal(adminNavUses.length, 2);
  assert.ok(adminNavUses.every((use) => !/\bkey\s*=/.test(use)));
});

test('staff-facing workspace and role labels stay clear on shared and admin headers', () => {
  assert.match(publicLayout, /isStaff \? 'Staff workspace' : 'My dashboard'/);
  assert.doesNotMatch(publicLayout, /Admin dashboard/);
  assert.match(adminPage, /customer\?\.first_name \|\| "Account"[\s\S]*?customer\?\.role === "admin" \? "Administrator" : "Staff"/);
  assert.match(adminPage, /join\(" "\) \|\| "Account"[\s\S]*?customer\?\.role === "admin" \? "Administrator" : "Staff"/);
  assert.match(adminPage, /title="Accounts management"/);
  assert.match(adminPage, /Activation controls sign-in; “Accepts appointments”\s+separately controls eligibility for new customer bookings/);
});

test('overview stays optional and history has a dedicated navigation filter', () => {
  const overview = adminPage.slice(adminPage.indexOf('function AdminOverview'), adminPage.indexOf('export function AdminPage'));
  assert.match(overview, /title="Upcoming booking queue"/);
  assert.match(overview, /\["Pending", "Confirmed"\]\.includes\(appointment\.status\)/);
  assert.match(overview, /onOpenAppointment\(appointment\)/);
  assert.match(overview, /onOpenAppointments\("history"\)/);
  assert.match(adminPage, /\["history", "History", IconGrid\]/);
  assert.match(adminPage, /appointmentFilterPreset\("history"\)/);
  assert.match(adminPage, /tab === "appointments" \|\| tab === "history"/);
  assert.match(adminUtilities, /if \(kind === 'history'\) return \{ date: '', status: 'history', search: '' \}/);
  assert.match(adminUtilities, /status === 'history' && appointment\.status !== 'Completed'/);
  assert.match(adminPage, /const displayedTotal = completedView \? totalCompletedAppointments : totalAppointments/);
  assert.match(adminPage, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/.test\(nextDate\)/);
  assert.match(adminPage, /<StaffNotificationBell[\s\S]*?onOpenAppointments=\{\(\) => openAppointments\("all"\)\}/);
  assert.match(adminPage, /<ScheduleSettings[\s\S]*?onOpenAppointments=\{\(\) => openAppointments\("all"\)\}/);
});

test('appointment queue keeps its search and summary visible while secondary filters collapse', () => {
  const queue = adminPage.slice(adminPage.indexOf('function AppointmentQueue'), adminPage.indexOf('function NotificationAppointmentDialog'));
  const row = adminPage.slice(adminPage.indexOf('function AppointmentRow'), adminPage.indexOf('function AppointmentDetails'));
  assert.match(queue, /type="search"/);
  assert.match(queue, /aria-expanded=\{filtersExpanded\}[\s\S]*?aria-controls="appointment-filter-fields"/);
  assert.match(queue, /id="appointment-filter-fields"[\s\S]*?hidden=\{!filtersExpanded\}/);
  assert.match(queue, /Active bookings/);
  assert.match(queue, /\{filterSummary\}[\s\S]*?\{appointments\.length\} of \{displayedTotal\}/);
  assert.match(queue, /Date &amp; time[\s\S]*?Customer[\s\S]*?Services[\s\S]*?Status/);
  assert.match(row, /appointment\.local_time[\s\S]*?appointment\.local_date[\s\S]*?customer\.first_name[\s\S]*?serviceNames\(appointment\)[\s\S]*?appointment\.status/);
  assert.doesNotMatch(row, /customer\.email|appointmentStaffName\(appointment\)|reference_no/);
  assert.doesNotMatch(adminPage, /AppointmentInspector/);
  const appointmentWorkspace = adminPage.slice(adminPage.indexOf(': tab === "appointments"'), adminPage.indexOf(': tab === "catalog"'));
  assert.match(appointmentWorkspace, /<AppointmentQueue[\s\S]*?onSelectAppointment=/);
  assert.doesNotMatch(appointmentWorkspace, /grid-cols-\[minmax\(0,1\.45fr\)|Inspector/);
  assert.match(adminPage, /else if \(nextTab === "appointments"\)\s*\{\s*setAppointmentFilters\(appointmentFilterPreset\("active"\)\)/);
  assert.match(adminUtilities, /if \(kind === 'today'\) return \{ date: isValidLocalDate\(today\) \? today : manilaDateKey\(\), status: 'active', search: '' \}/);
});

test('appointment dialogs coordinate focus, confirmation, notification close, and deferred no-show prompts', () => {
  assert.match(adminPage, /const appointmentDetailsOpen = Boolean\([\s\S]*?!statusConfirm[\s\S]*?!reschedule[\s\S]*?!notificationAppointmentModal[\s\S]*?!noShowConfirm/);
  assert.match(adminPage, /open=\{appointmentDetailsOpen\}[\s\S]*?returnFocusRef=\{appointmentReturnFocusRef\}[\s\S]*?fallbackFocusRef=\{appointmentQueueHeadingRef\}/);
  assert.match(adminPage, /if \(preserveSelection !== true\) setSelectedAppointment\(null\)/);
  assert.match(adminPage, /openAppointments\("appointment", notificationModalAppointment\);\s*closeNotificationAppointment\(true\)/);
  assert.match(adminPage, /const requestNotificationStatus = \(appointment, nextStatus\) => \{\s*closeNotificationAppointment\(true\)/);
  assert.match(adminPage, /const rescheduleNotificationAppointment = \(appointment\) => \{\s*closeNotificationAppointment\(true\)/);
  const noShowEffect = adminPage.slice(adminPage.indexOf('const checkForDueNoShows'), adminPage.indexOf('const closeNoShowPrompt'));
  assert.match(noShowEffect, /notificationAppointmentModal \|\|\s*selectedVisibleAppointment/);
  const dialog = read('frontend/src/components/admin/AdminDialog.jsx');
  assert.match(dialog, /document\.addEventListener\('keydown', handleKeyDown\)/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /event\.key !== 'Tab'/);
  assert.match(dialog, /fallbackFocusTarget\.focus\(\)/);
});

test('schedule guidance remains visible while loading and preserves conflict follow-up', () => {
  assert.match(scheduleSettings, /Edits affect future availability only\. Existing appointments never move; conflicts remain here for staff follow-up\./);
  assert.match(scheduleSettings, /if \(loading\) return <div className="space-y-4"><p className="text-sm leading-relaxed text-ink-600">\{SCHEDULE_GUIDANCE\}<\/p>/);
});
