import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const authContext = readFileSync(resolve(projectRoot, 'frontend/src/context/AuthContext.jsx'), 'utf8');
const authModal = readFileSync(resolve(projectRoot, 'frontend/src/components/auth/AuthModal.jsx'), 'utf8');
const adminPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/AdminPage.jsx'), 'utf8');

test('password completion keeps invite and recovery success states distinct', () => {
  assert.match(authContext, /const flowType = passwordSetup\?\.type \|\| ''/);
  assert.match(authContext, /setPasswordCompletion\(\{ type: flowType \}\)/);
  assert.match(authContext, /setModalView\('password-success'\)/);
  assert.match(authModal, /modalView === 'password-success'/);
  assert.match(authModal, /Your account email is verified and your password was created successfully\./);
  assert.match(authModal, /Staff Login/);
  assert.match(authModal, /Password changed successfully/);
  assert.match(authModal, /Customer Login/);
  assert.match(authModal, /Staff \/ Admin Login/);
  assert.doesNotMatch(authModal, /Password reset successful\. You can now log in\./);
});

test('admin mobile navigation is a drawer contract, not a section select', () => {
  assert.match(adminPage, /const ADMIN_MOBILE_MENU_ID = 'admin-mobile-menu'/);
  assert.match(adminPage, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(adminPage, /aria-controls=\{ADMIN_MOBILE_MENU_ID\}/);
  assert.match(adminPage, /role="dialog" aria-modal="true" aria-labelledby="admin-mobile-menu-title"/);
  assert.match(adminPage, /Current section:/);
  assert.match(adminPage, /event\.key === 'Escape'/);
  assert.match(adminPage, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(adminPage, /onNavigate=\{onClose\}/);
  assert.match(adminPage, /w-\[320px\] max-w-\[calc\(100vw-1rem\)\]/);
  assert.doesNotMatch(adminPage, /function MobileSectionNav/);
  assert.doesNotMatch(adminPage, /<MobileSectionNav/);
});
