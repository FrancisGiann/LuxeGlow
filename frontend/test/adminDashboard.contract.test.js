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
  assert.match(adminUtilities, /return role === 'head' \? 'appointments' : 'overview';/);
  assert.match(adminPage, /useState\(\(\) => initialAdminTab\(customer\?\.role\)\)/);
});

test('staff navigation is a collapsible single-open grouped accordion with an admin-only access group', () => {
  assert.match(adminPage, /id: "daily-work",\s*label: "Daily work"/);
  assert.match(adminPage, /id: "salon-setup",\s*label: "Salon setup"/);
  assert.match(adminPage, /id: "website-content",\s*label: "Website content"/);
  assert.match(adminPage, /id: "people-access",\s*label: "People & access"[\s\S]*?adminOnly: true/);
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
  assert.match(adminPage, /Staff accounts/);
  assert.match(adminPage, /Activation controls sign-in; “Accepts appointments”\s+separately controls eligibility for new customer bookings/);
});

test('overview shows the upcoming operational queue and history has a dedicated navigation filter', () => {
  const overview = adminPage.slice(adminPage.indexOf('function AdminOverview'), adminPage.indexOf('export function AdminPage'));
  assert.match(overview, /title="Upcoming booking queue"/);
  assert.match(overview, /\["Pending", "Confirmed"\]\.includes\(appointment\.status\)/);
  assert.match(overview, /onOpenAppointment\(appointment\)/);
  assert.match(overview, /onOpenAppointments\("history"\)/);
  assert.match(adminPage, /\["history", "History", IconGrid\]/);
  assert.match(adminPage, /appointmentFilterPreset\("history"\)/);
  assert.match(adminPage, /tab === "appointments" \|\| tab === "history"/);
  assert.match(adminUtilities, /if \(kind === 'history'\) return \{ date: '', status: 'history', search: '' \}/);
  assert.match(adminUtilities, /status === 'history' && !\['Completed', 'Cancelled'\]\.includes\(appointment\.status\)/);
  assert.match(adminPage, /<StaffNotificationBell[\s\S]*?onOpenAppointments=\{\(\) => openAppointments\("all"\)\}/);
  assert.match(adminPage, /<ScheduleSettings[\s\S]*?onOpenAppointments=\{\(\) => openAppointments\("all"\)\}/);
});
test('schedule guidance remains visible while loading and preserves conflict follow-up', () => {
  assert.match(scheduleSettings, /Edits affect future availability only\. Existing appointments never move; conflicts remain here for staff follow-up\./);
  assert.match(scheduleSettings, /if \(loading\) return <div className="space-y-4"><p className="text-sm leading-relaxed text-ink-600">\{SCHEDULE_GUIDANCE\}<\/p>/);
});
