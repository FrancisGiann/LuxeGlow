import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStaffRole, isSupportedProfileRole } from '../src/utils/roles.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const endpoints = read('frontend/src/api/endpoints.js');
const authContext = read('frontend/src/context/AuthContext.jsx');
const sessionRefresh = read('frontend/src/utils/sessionRefresh.js');
const authModal = read('frontend/src/components/auth/AuthModal.jsx');
const app = read('frontend/src/App.jsx');
const publicLayout = read('frontend/src/components/layout/PublicLayout.jsx');
const adminApi = read('frontend/src/api/admin.js');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const staffNotifications = read('frontend/src/hooks/useStaffNotifications.js');
const imageUpload = read('supabase/functions/upload-service-image/index.ts');
const staffPasswordReset = read('supabase/functions/reset-staff-password/index.ts');

test('simplified roles preserve customers and accept head/admin while retiring legacy staff', () => {
  assert.equal(isSupportedProfileRole('customer'), true);
  assert.equal(isSupportedProfileRole('head'), true);
  assert.equal(isSupportedProfileRole('admin'), true);
  assert.equal(isSupportedProfileRole('staff'), false);
  assert.equal(isStaffRole('head'), true);
  assert.equal(isStaffRole('admin'), true);
  assert.equal(isStaffRole('customer'), false);
  assert.equal(isStaffRole('staff'), false);
});

test('the shared head and administrator workspace initializes to Appointments', () => {
  assert.match(adminPage, /const \[tab, setTabState\] = useState\("appointments"\)/);
  assert.doesNotMatch(adminPage, /initialAdminTab|function AdminOverview/);
});

test('login, restored sessions, and route redirects recognize active head profiles', () => {
  const checkSession = endpoints.slice(endpoints.indexOf('export async function checkSession'), endpoints.indexOf('export async function loginUnified'));
  const loginUnified = endpoints.slice(endpoints.indexOf('export async function loginUnified'), endpoints.indexOf('export const loginCustomer'));
  const refreshSession = authContext.slice(authContext.indexOf('const refreshSession ='), authContext.indexOf('useEffect(() => {\n    void refreshSession'));
  assert.match(checkSession, /isSupportedProfileRole\(profile\.role\)/);
  assert.match(checkSession, /profile\.is_active !== true/);
  assert.match(loginUnified, /isSupportedProfileRole\(profile\.role\)/);
  assert.match(loginUnified, /profile\.is_active !== true/);
  assert.match(refreshSession, /sessionRefreshCoordinator\.refresh\(options\)/);
  assert.match(sessionRefresh, /result\?\.loggedIn === true/);
  assert.match(authContext, /onAuthenticated: \(data\) => \{\s*setCustomer\(data\.customer\);\s*setAuthStatus\('authenticated'\);/);
  assert.match(authModal, /if \(isStaffRole\(res\.role\)\)[\s\S]*?navigate\('\/admin'/);
  assert.match(app, /if \(!isStaffRole\(customer\?\.role\) \|\| customer\?\.is_active === false\)/);
  assert.match(publicLayout, /const isStaff = isStaffRole\(customer\?\.role\)/);
});

test('head has operational admin-page access without widening administrator-only actions', () => {
  assert.match(adminApi, /if \(!profile\.is_active \|\| !isStaffRole\(profile\.role\)\)/);
  assert.match(staffNotifications, /&& isStaffRole\(customer\?\.role\)/);
  assert.match(adminApi, /async function assertAdmin\(\)[\s\S]*?profile\.role !== 'admin'/);
  assert.match(adminApi, /export async function updateAdminProfile[\s\S]*?const client = await assertAdmin\(\)/);
  assert.match(adminPage, /if \(!selectedStaff \|\| customer\?\.role !== "admin" \|\| staffActionBusy\) return/);
  assert.match(adminPage, /canManage=\{customer\?\.role === "admin"\}/);
  assert.match(adminPage, /<option value="head">Head<\/option>/);
  assert.match(adminApi, /if \(!isSupportedProfileRole\(fields\.role\)\)/);
  assert.match(imageUpload, /\['head', 'admin'\]\.includes\(callerProfile\.role\)/);
  assert.match(staffPasswordReset, /\['head', 'admin'\]\.includes\(target\.role\)/);
  assert.match(staffPasswordReset, /callerProfile\?\.role !== 'admin'/);
});
