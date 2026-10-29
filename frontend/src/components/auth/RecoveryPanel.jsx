import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy';
import { finishRecovery, requestRecovery, verifyRecovery } from '../../api/passwordRecovery';

// Mount inside the existing AuthModal shell. `link` is parsed from the
// recovery_id/recovery_token URL fragment before this panel is opened.
export function RecoveryPanel({ initialEmail = '', link = null, onBack }) {
  const [stage, setStage] = useState(link ? 'verifying' : 'request');
  const [email, setEmail] = useState(initialEmail);
  const [channel, setChannel] = useState('sms');
  const [challengeId, setChallengeId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checkedLink = useRef(false);

  useEffect(() => {
    if (!link || checkedLink.current) return;
    checkedLink.current = true;
    const next = new URL(window.location.href);
    next.hash = '';
    window.history.replaceState(window.history.state, '', `${next.pathname}${next.search}`);
    verifyRecovery({ challengeId: link.id, token: link.token }).then((result) => {
      if (result.success) { setResetToken(result.reset_token); setStage('reset'); }
      else { setError(result.error || 'That link is invalid or expired.'); setStage('request'); }
    });
  }, [link]);

  const request = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    const result = await requestRecovery({ email, channel });
    setBusy(false);
    if (!result.success) { setError(result.error || 'Recovery is unavailable right now.'); return; }
    setChallengeId(result.challenge_id);
    setStage(channel === 'sms' ? 'code' : 'sent');
  };
  const verify = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    const code = String(new FormData(event.currentTarget).get('code') || '').trim();
    const result = await verifyRecovery({ challengeId, code });
    setBusy(false);
    if (!result.success) { setError(result.error || 'That code is invalid or expired.'); return; }
    setResetToken(result.reset_token); setStage('reset');
  };
  const reset = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const result = await finishRecovery({ resetToken, password: fields.password, confirmPassword: fields.confirm_password });
    setBusy(false);
    if (!result.success) { setError(result.error || 'Could not change password.'); return; }
    setResetToken(''); setStage('done');
  };

  return <div className="mt-6 flex flex-col gap-4">
    {stage === 'request' && <form onSubmit={request} className="flex flex-col gap-4" noValidate>
      <Input id="recovery-email" name="email" type="email" label="Account email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <fieldset className="rounded-xl border border-line bg-brand-50 p-3">
        <legend className="px-1 text-sm font-semibold text-ink-900">Send recovery instructions by</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-900"><input type="radio" name="channel" checked={channel === 'sms'} onChange={() => setChannel('sms')} className="accent-brand-800" /> SMS to verified phone</label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-900"><input type="radio" name="channel" checked={channel === 'email'} onChange={() => setChannel('email')} className="accent-brand-800" /> Verified recovery email</label>
        </div>
      </fieldset>
      <p className="text-sm text-ink-500">Email recovery becomes available after you verify it in account settings. SMS uses your already verified phone.</p>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" block size="lg" loading={busy}>Send recovery instructions</Button>
    </form>}
    {stage === 'code' && <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
      <p role="status" className="text-sm text-ink-500">If this account has a verified phone, a LuxeGlow password reset code has been sent. It expires in 5 minutes.</p>
      <Input id="recovery-code" name="code" label="8-digit reset code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required />
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" block size="lg" loading={busy}>Verify code</Button>
    </form>}
    {stage === 'sent' && <p role="status" className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm text-ink-900">If this account has a verified recovery email, a LuxeGlow link has been sent. The link expires in 15 minutes.</p>}
    {stage === 'verifying' && <p role="status" className="text-sm text-ink-500">Checking your reset link…</p>}
    {stage === 'reset' && <form onSubmit={reset} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-ink-500">Choose a new password. You will sign in again afterward.</p>
      <Input id="recovery-password" name="password" type="password" label="New password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} hint={PASSWORD_POLICY_HINT} required />
      <Input id="recovery-password-confirm" name="confirm_password" type="password" label="Confirm new password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" block size="lg" loading={busy}>Reset password</Button>
    </form>}
    {stage === 'done' && <div role="status" className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm text-ink-900">Password changed. Sign in with your new password.</div>}
    {stage !== 'verifying' && <button type="button" onClick={stage === 'request' || stage === 'done' ? onBack : () => { setError(''); setStage('request'); }} className="min-h-11 self-center text-sm font-semibold text-brand-800 hover:text-brand-900">{stage === 'request' || stage === 'done' ? 'Back to login' : 'Request another code or link'}</button>}
  </div>;
}
