import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStaffPasswordEmail,
  resolveStaffPasswordEmailProvider,
} from '../../supabase/functions/_shared/staffPasswordEmail.js';

const validSmtpConfig = {
  smtpUser: 'salon@example.com',
  smtpPass: 'present',
  smtpPort: 465,
  fromAddress: 'salon@example.com',
};

test('staff reset prefers configured Resend and falls back to existing SMTP on port 465', () => {
  assert.equal(
    resolveStaffPasswordEmailProvider({ ...validSmtpConfig, resendKey: 'configured' }),
    'resend',
  );
  assert.equal(resolveStaffPasswordEmailProvider(validSmtpConfig), 'smtp');
});

test('SMTP fallback requires credentials, a valid sender, and implicit TLS port 465', () => {
  assert.equal(resolveStaffPasswordEmailProvider({ ...validSmtpConfig, smtpPass: '' }), null);
  assert.equal(resolveStaffPasswordEmailProvider({ ...validSmtpConfig, fromAddress: 'bad sender' }), null);
  assert.equal(resolveStaffPasswordEmailProvider({ ...validSmtpConfig, smtpPort: 587 }), null);
});

test('password email content preserves recovery versus invitation intent without sending mail', () => {
  const actionLink = 'https://auth.example/reset?token=one-time';
  const recovery = buildStaffPasswordEmail({ isInvite: false, firstName: 'Staff', actionLink });
  const invite = buildStaffPasswordEmail({ isInvite: true, firstName: 'Staff', actionLink });

  assert.match(recovery.subject, /password reset/i);
  assert.match(recovery.text, /requested a password reset/);
  assert.match(recovery.text, new RegExp(actionLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(invite.subject, /staff invitation/i);
  assert.match(invite.text, /confirm your email and choose a password/);
  assert.match(invite.text, new RegExp(actionLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('staff name line breaks are removed from the plain-text message', () => {
  const email = buildStaffPasswordEmail({
    isInvite: false,
    firstName: 'Staff\nInjected line',
    actionLink: 'https://auth.example/reset',
  });
  assert.match(email.text, /^Hi Staff Injected line,/);
  assert.doesNotMatch(email.text, /\r/);
});
