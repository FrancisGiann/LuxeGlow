import { useEffect, useState } from 'react';
import { requestRecoveryEmailVerification } from '../../api/recoveryEmailVerification';
import { requireSupabase } from '../../lib/supabase';
import { Button } from '../ui/Button';

// Optional account-settings action; never part of the signup sequence.
export function RecoveryEmailCard({ email = '' }) {
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    requireSupabase().auth.getUser().then(({ data }) => {
      if (!current) return;
      setVerified(Boolean(data?.user?.email_confirmed_at && data.user.email?.toLowerCase() === email.toLowerCase()));
      setChecking(false);
    }).catch(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, [email]);
  const send = async () => {
    setBusy(true); setMessage(''); setError('');
    const result = await requestRecoveryEmailVerification();
    setBusy(false);
    if (result.success) { setMessage(result.message); if (result.already_verified) setVerified(true); }
    else setError(result.error);
  };
  return <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="recovery-email-title">
    <h3 id="recovery-email-title" className="font-display text-xl font-bold text-ink-900">Recovery email</h3>
    <p className="mt-2 text-sm leading-relaxed text-ink-500">Your verified phone can reset your password. Verify your email too if you want a second recovery option.</p>
    <p className="mt-3 text-sm font-semibold text-ink-900">{checking ? 'Checking email status…' : verified ? 'Email verified' : 'Email not verified for recovery'}</p>
    {!checking && !verified && <Button type="button" variant="soft" className="mt-4" loading={busy} onClick={send}>Verify recovery email</Button>}
    {message && <p role="status" className="mt-3 text-sm text-brand-800">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </section>;
}
