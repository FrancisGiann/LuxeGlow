import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { IconX } from '../icons';
import { getPasswordPolicyError, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy';

const VIEWS = {
  login: 'Customer Login',
  admin: 'Admin / Staff Login',
  register: 'Create an Account',
  verify: 'Verify Your Email',
  'forgot-request': 'Reset Your Password',
  'forgot-reset': 'Choose a New Password',
};

function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-500 font-display text-xl font-semibold text-brand-800">
        A
      </div>
    </div>
  );
}

export function AuthModal() {
  const {
    modalView,
    closeAuth,
    verifyEmail,
    openAuth,
    login,
    loginStaff,
    register,
    resend,
    requestPasswordReset,
    completePasswordReset,
    sessionNotice,
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [resendForEmail, setResendForEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    setError('');
    setResetCode('');
    if (!modalView) {
      setResetEmail('');
    }
  }, [modalView]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (!modalView) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeAuth();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modalView, closeAuth]);

  if (!modalView) return null;

  const resendKey = String(verifyEmail || '').trim().toLowerCase();
  const resendRemaining = resendForEmail === resendKey ? resendIn : 0;

  const finishAndGoDashboard = () => {
    closeAuth();
    navigate('/dashboard/overview', { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await login(f.get('email'), f.get('password'));
      if (res.ok) finishAndGoDashboard();
      else if (!res.needsVerification) setError(res.error);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await loginStaff(f.get('username'), f.get('password'));
      if (res.ok) {
        toast('Welcome back, staff!', 'success');
        navigate(res.redirect || '/admin', { replace: true });
      } else setError(res.error);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const passwordError = getPasswordPolicyError(f.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (f.password !== f.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await register(f);
      if (!res.ok) setError(res.error);
    } catch {
      setError('Something went wrong during registration.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendRemaining > 0 || resendBusy) return;
    setResendBusy(true);
    try {
      const res = await resend();
      if (res.retryAfter > 0) {
        setResendForEmail(resendKey);
        setResendIn(res.retryAfter);
      }
      if (res.ok) toast('A new verification email has been sent.', 'info');
      else toast(res.error || 'Could not resend the verification email right now.', 'error');
    } catch {
      toast('Could not resend the verification email right now. Please try again.', 'error');
    } finally {
      setResendBusy(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const email = String(new FormData(e.currentTarget).get('email') || '').trim();
    try {
      const res = await requestPasswordReset(email);
      if (res.ok) {
        setResetEmail(email);
        openAuth('forgot-reset');
        toast(res.message || 'Check your email for a secure password-reset link.', 'info');
      } else setError(res.error || 'Could not process that request right now.');
    } catch {
      setError('Could not process that request right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteReset = async (e) => {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const code = resetCode.trim();
    const email = resetEmail.trim();
    if (code && !/^\d{6}$/.test(code)) {
      setError('Enter all 6 digits, or use the secure reset link from your email.');
      return;
    }
    if (code && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter the email address that received the recovery code.');
      return;
    }
    const passwordError = getPasswordPolicyError(fields.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (fields.password !== fields.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await completePasswordReset({
        email,
        code,
        password: fields.password,
        confirmPassword: fields.confirm_password,
      });
      if (res.ok) {
        openAuth('login');
        toast('Password reset successful. You can now log in.', 'success');
      } else setError(res.error || 'That code is invalid or expired.');
    } catch {
      setError('Could not reset your password right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-ink-900/55 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={closeAuth} aria-hidden="true" />
      <div className="relative my-auto w-full max-w-md">
        <button
          onClick={closeAuth}
          aria-label="Close"
          className="absolute -top-2 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-500 shadow-card transition-colors hover:text-ink-900 sm:-right-2"
        >
          <IconX size={17} />
        </button>

        <div className="rounded-3xl border border-line bg-surface p-8 shadow-float">
          <BrandMark />
          <h2 className="mt-4 text-center font-display text-2xl font-bold">{VIEWS[modalView]}</h2>
          <p className="mt-1 text-center text-sm text-ink-500">
            {modalView === 'login' && 'Sign in to book and manage your appointments.'}
            {modalView === 'admin' && 'Restricted access for salon staff.'}
            {modalView === 'register' && 'Join Astrid Nails & Beauty Bar in under a minute.'}
            {modalView === 'verify' && 'Check your inbox for a verification email.'}
            {modalView === 'forgot-request' && 'We will email a secure reset link if that address is registered.'}
            {modalView === 'forgot-reset' && 'Use the link, or enter the code if your email provides one.'}
          </p>
          {sessionNotice && <p className="mt-4 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-center text-sm font-semibold text-brand-800" role="status">{sessionNotice}</p>}

          {/* ── LOGIN ── */}
          {modalView === 'login' && (
            <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="login-email" name="email" type="email" label="Email address" placeholder="you@example.com" autoComplete="username" required />
              <Input id="login-password" name="password" type="password" label="Password" placeholder="••••••••" autoComplete="current-password" required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Log in</Button>
              <div className="flex flex-col items-center gap-2 pt-2 text-sm text-ink-500">
                <button type="button" onClick={() => openAuth('forgot-request')} className="font-semibold text-brand-800 hover:text-brand-900">Forgot password?</button>
                <span>
                  New here?{' '}
                  <button type="button" onClick={() => openAuth('register')} className="font-semibold text-brand-800 hover:text-brand-900">Create an account</button>
                </span>
                <button type="button" onClick={() => openAuth('admin')} className="font-semibold text-brand-800 hover:text-brand-900">Staff / Admin sign-in</button>
              </div>
            </form>
          )}

          {/* ── PASSWORD RESET REQUEST ── */}
          {modalView === 'forgot-request' && (
            <form onSubmit={handleRequestReset} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="reset-request-email" name="email" type="email" label="Registered email address" placeholder="you@example.com" autoComplete="email" required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Email reset link</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Remembered your password?{' '}
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">Back to login</button>
              </p>
            </form>
          )}

          {/* ── PASSWORD RESET COMPLETION ── */}
          {modalView === 'forgot-reset' && (
            <form onSubmit={handleCompleteReset} className="mt-6 flex flex-col gap-4" noValidate>
              {resetEmail ? <div className="w-full rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Link sent to</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-brand-800">{resetEmail}</p>
              </div> : <Input
                id="reset-email"
                type="email"
                label="Email address for a recovery code"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                autoComplete="email"
                required={Boolean(resetCode.trim())}
                hint="Leave this blank when you opened the secure reset link."
              />}
              <div className="py-2 text-center">
                <p className="text-sm font-semibold text-brand-800">Choose a new password.</p>
                <p className="text-sm text-ink-500">Use the secure link, or enter the code if your email provides one.</p>
              </div>
              <Input
                id="reset-code"
                label="Optional 6-digit recovery code"
                value={resetCode}
                onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                hint="Leave this blank when you opened the secure reset link."
              />
              <Input id="reset-password" name="password" type="password" label="New password" placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} hint={PASSWORD_POLICY_HINT} required />
              <Input id="reset-confirm-password" name="confirm_password" type="password" label="Confirm new password" placeholder="Repeat password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Reset password</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Need another reset email?{' '}
                <button type="button" onClick={() => openAuth('forgot-request')} className="font-semibold text-brand-800 hover:text-brand-900">Start again</button>
                <span className="mx-1">·</span>
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">Back to login</button>
              </p>
            </form>
          )}

          {/* ── STAFF ── */}
          {modalView === 'admin' && (
            <form onSubmit={handleStaffLogin} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="staff-username" name="username" type="email" label="Staff email address" placeholder="staff@example.com" autoComplete="username" required />
              <Input id="staff-password" name="password" type="password" label="Password" placeholder="••••••••" autoComplete="current-password" required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Log in as Staff</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Not staff?{' '}
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">Customer login</button>
              </p>
            </form>
          )}

          {/* ── REGISTER ── */}
          {modalView === 'register' && (
            <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <Input id="reg-first" name="first_name" label="First name" placeholder="Juan" autoComplete="given-name" required />
                <Input id="reg-last" name="last_name" label="Last name" placeholder="Dela Cruz" autoComplete="family-name" required />
              </div>
              <Input id="reg-email" name="email" type="email" label="Email address" placeholder="you@example.com" autoComplete="username" required />
              <Input id="reg-phone" name="phone" type="tel" label="Phone number" placeholder="0917 000 1122" autoComplete="tel" required />
              <Input id="reg-pass" name="password" type="password" label="Password" placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} hint={PASSWORD_POLICY_HINT} required />
              <Input id="reg-confirm" name="confirm_password" type="password" label="Confirm password" placeholder="Repeat password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Create account</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Already have an account?{' '}
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">Log in instead</button>
              </p>
            </form>
          )}

          {/* ── VERIFY ── */}
          {modalView === 'verify' && (
            <div className="mt-6 flex flex-col items-center gap-5">
              <div className="w-full rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Link sent to</p>
                <p className="mt-0.5 text-sm font-semibold text-brand-800">{verifyEmail}</p>
              </div>

              <div className="py-4 text-center">
                <h3 className="mb-2 text-lg font-bold text-ink-900">Click the link to continue.</h3>
                <p className="text-sm text-ink-500">It verifies your address and signs you in.</p>
              </div>

              <div className="text-center text-sm text-ink-500">
                Didn't get it?{' '}
                <button type="button" onClick={handleResend} disabled={resendRemaining > 0 || resendBusy} className="font-semibold text-brand-800 disabled:opacity-50 hover:enabled:text-brand-900">
                  {resendBusy ? 'Sending…' : resendRemaining > 0 ? `Resend in ${Math.floor(resendRemaining / 60)}:${String(resendRemaining % 60).padStart(2, '0')}` : 'Resend email'}
                </button>
              </div>
              <p className="text-center text-xs text-ink-400">
                You can safely close this window once you click the link in your email.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
