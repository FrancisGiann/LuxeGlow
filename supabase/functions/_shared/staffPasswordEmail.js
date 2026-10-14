const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;

export function resolveStaffPasswordEmailProvider({
  resendKey,
  smtpUser,
  smtpPass,
  smtpPort,
  fromAddress,
}) {
  if (typeof resendKey === 'string' && resendKey.trim()) return 'resend';

  const normalizedUser = typeof smtpUser === 'string' ? smtpUser.trim() : '';
  const normalizedFrom = typeof fromAddress === 'string' ? fromAddress.trim() : '';
  const normalizedPort = smtpPort == null || smtpPort === '' ? 465 : Number(smtpPort);
  if (
    normalizedUser &&
    typeof smtpPass === 'string' &&
    smtpPass.length > 0 &&
    normalizedPort === 465 &&
    EMAIL_ADDRESS_PATTERN.test(normalizedFrom)
  ) return 'smtp';

  return null;
}

export function buildStaffPasswordEmail({ isInvite, firstName, actionLink }) {
  const safeFirstName = String(firstName || 'there').replace(/[\r\n\0]+/gu, ' ').trim().slice(0, 100) || 'there';
  const link = String(actionLink || '').trim();
  const invite = isInvite === true;
  return {
    subject: invite
      ? 'Complete your Astrid Nails staff invitation'
      : 'Your Astrid Nails staff password reset',
    text: invite
      ? `Hi ${safeFirstName},\n\nAn administrator invited you to join the Astrid Nails staff. Use this one-time link to confirm your email and choose a password:\n\n${link}\n\nIf you did not expect this, contact the salon administrator.`
      : `Hi ${safeFirstName},\n\nAn administrator requested a password reset for your staff account. Use this one-time link to choose a new password:\n\n${link}\n\nIf you did not expect this, contact the salon administrator.`,
  };
}
