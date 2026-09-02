import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const invite = readFileSync(resolve(projectRoot, 'supabase/functions/invite-staff/index.ts'), 'utf8');
const resetStaff = readFileSync(resolve(projectRoot, 'supabase/functions/reset-staff-password/index.ts'), 'utf8');
const endpoints = readFileSync(resolve(projectRoot, 'frontend/src/api/endpoints.js'), 'utf8');
const authContext = readFileSync(resolve(projectRoot, 'frontend/src/context/AuthContext.jsx'), 'utf8');
const authModal = readFileSync(resolve(projectRoot, 'frontend/src/components/auth/AuthModal.jsx'), 'utf8');
const supabaseClient = readFileSync(resolve(projectRoot, 'frontend/src/lib/supabase.js'), 'utf8');
const adminPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/AdminPage.jsx'), 'utf8');
const functionsReadme = readFileSync(resolve(projectRoot, 'supabase/functions/README.md'), 'utf8');

test('invite and staff recovery links target the configured password setup route', () => {
  assert.match(invite, /const routerBase = .*APP_ROUTER_BASE/);
  assert.match(invite, /const passwordSetupRedirect = .*reset-password/);
  assert.match(invite, /inviteUserByEmail\(email, \{ data: \{[\s\S]*redirectTo: passwordSetupRedirect \}\)/);
  assert.match(resetStaff, /const routerBase = .*APP_ROUTER_BASE/);
  assert.match(resetStaff, /auth\.admin\.getUserById\(userId\)/);
  assert.match(resetStaff, /authTarget\.user\.email_confirmed_at \|\| authTarget\.user\.confirmed_at \? 'recovery' : 'invite'/);
  assert.match(resetStaff, /generateLink\(\{ type: linkType,[\s\S]*options: \{ redirectTo \} \}\)/);
  assert.match(resetStaff, /const isInvite = linkType === 'invite'/);
  assert.match(resetStaff, /isInvite \? 'Complete your Astrid Nails staff invitation' : 'Your Astrid Nails staff password reset'/);
  assert.match(resetStaff, /confirm your email and choose a password/);
  assert.doesNotMatch(invite, /password\s*:/i);
  assert.match(invite, /accepts_appointments: false/);
  assert.match(adminPage, /can be enabled for appointments by an admin after they accept the invitation/);
});

test('auth callback handling opens password setup for invite and recovery sessions', () => {
  assert.match(supabaseClient, /authRedirect = inspectAuthRedirect\(\)/);
  assert.match(supabaseClient, /detectSessionInUrl: true/);
  assert.match(authContext, /event === 'PASSWORD_RECOVERY'/);
  assert.match(authContext, /event === 'SIGNED_IN' && hasCallbackLocation && authRedirect\.isPasswordSetup/);
  assert.match(authContext, /event === 'INITIAL_SESSION'/);
  assert.match(authContext, /authRedirect\.isResetPath && authRedirect\.hasCallbackCredentials/);
  assert.match(authContext, /passwordRecoveryObservedRef\.current/);
  assert.match(authContext, /setTimeout\(\(\) =>/);
  assert.match(authContext, /session\?\.user\?\.id/);
  assert.match(authContext, /\|\| authCallbackHandledRef\.current\) return false/);
  assert.match(authContext, /ready: true, callbackObserved: true/);
  assert.match(authContext, /ready: false,[\s\S]*callbackObserved: false/);
  assert.match(authContext, /setModalView\('forgot-reset'\)/);
  assert.match(authContext, /useState\(initialSetup \? 'forgot-reset' : null\)/);
  assert.match(authModal, /passwordSetup\?\.type === 'invite' \? 'Set password' : 'Reset password'/);
  assert.match(authModal, /passwordSetup\?\.type !== 'invite'/);
});

test('password updates require a verified callback session and revoke all sessions after success', () => {
  assert.match(endpoints, /verifyOtp\(\{ email: normalizeEmail\(email\), token: String\(code\), type: 'recovery' \}\)/);
  assert.match(endpoints, /String\(flowType \|\| ''\) !== 'recovery'/);
  assert.match(endpoints, /!verification\?\.session/);
  assert.match(endpoints, /!\['invite', 'recovery'\]\.includes\(String\(flowType \|\| ''\)\)/);
  assert.match(endpoints, /\|\| !expectedUserId/);
  assert.match(endpoints, /auth\.updateUser\(\{ password: passwordValue \}\)/);
  assert.match(endpoints, /await client\.auth\.signOut\(\{ scope: 'global' \}\)\.catch/);
  assert.doesNotMatch(endpoints, /auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(authContext, /expectedUserId: passwordSetup\?\.userId/);
  assert.match(authModal, /!passwordSetup\?\.ready && !codeCanEstablishRecoverySession/);
  assert.match(authModal, /passwordSetupBlocked/);
});

test('auth email templates preserve token links and exact redirect allowlisting', () => {
  assert.match(functionsReadme, /Invite User and Reset\s+Password templates/);
  assert.match(functionsReadme, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(functionsReadme, /\.RedirectTo/);
  assert.match(functionsReadme, /http:\/\/localhost:5173\/reset-password/);
  assert.match(functionsReadme, /your-site\.example\/luxeglow\/reset-password/);
});
