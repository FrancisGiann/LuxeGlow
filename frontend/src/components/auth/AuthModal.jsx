import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';

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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-blush-600 font-display text-xl font-bold text-white shadow-card">
        AN
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
    verify,
    resend,
    requestPasswordReset,
    completePasswordReset,
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef([]);
  const resetCodeRefs = useRef([]);

  useEffect(() => {
    setError('');
    if (modalView === 'verify') {
      setOtp(['', '', '', '', '', '']);
      setResendIn(300);
    }
    if (modalView === 'forgot-reset') setResetCode(['', '', '', '', '', '']);
    if (!modalView) {
      setResetEmail('');
      setResetCode(['', '', '', '', '', '']);
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
        // Legacy staff area stays on PHP for now (out of React scope)
        const legacy = import.meta.env.VITE_LEGACY_APP_URL || '/luxeglow';
        window.location.href = `${legacy.replace(/\/+$/, '')}/admin_dashboard.php`;
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
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await register(f);
      if (!res.ok) setError(res.error);
    } catch {
      setError('Something went wrong during registration.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await verify(code);
      if (res.ok) {
        toast('Account verified. Welcome!');
        finishAndGoDashboard();
      } else setError(res.error);
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    const res = await resend();
    if (res.ok) {
      toast('A new OTP has been sent.', 'info');
      setResendIn(300);
    } else toast(res.error || 'Could not resend the code right now.', 'error');
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
    const code = resetCode.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
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
        email: resetEmail,
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

  const setOtpDigit = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    setOtp((prev) => prev.map((d, idx) => (idx === i ? digit : d)));
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const onOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'Enter') handleVerify();
  };

  const setResetCodeDigit = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    setResetCode((prev) => prev.map((d, idx) => (idx === i ? digit : d)));
    if (digit && i < 5) resetCodeRefs.current[i + 1]?.focus();
  };

  const onResetCodeKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !resetCode[i] && i > 0) resetCodeRefs.current[i - 1]?.focus();
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
          ✕
        </button>

        <div className="rounded-3xl border border-line bg-surface p-8 shadow-float">
          <BrandMark />
          <h2 className="mt-4 text-center font-display text-2xl font-bold">{VIEWS[modalView]}</h2>
          <p className="mt-1 text-center text-sm text-ink-500">
            {modalView === 'login' && 'Sign in to book and manage your appointments.'}
            {modalView === 'admin' && 'Restricted access for salon staff.'}
            {modalView === 'register' && 'Join Astrid Nails & Beauty Bar in under a minute.'}
            {modalView === 'verify' && 'Enter the 6-digit code we emailed you.'}
            {modalView === 'forgot-request' && 'We will email a reset code if that address is registered.'}
            {modalView === 'forgot-reset' && 'Enter the code from your email and choose a new password.'}
          </p>

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
                <button type="button" onClick={() => openAuth('admin')} className="font-semibold text-brand-800 hover:text-brand-900">🔐 Staff / Admin sign-in</button>
              </div>
            </form>
          )}

          {/* ── PASSWORD RESET REQUEST ── */}
          {modalView === 'forgot-request' && (
            <form onSubmit={handleRequestReset} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="reset-request-email" name="email" type="email" label="Registered email address" placeholder="you@example.com" autoComplete="email" required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Send reset code</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Remembered your password?{' '}
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">← Back to login</button>
              </p>
            </form>
          )}

          {/* ── PASSWORD RESET COMPLETION ── */}
          {modalView === 'forgot-reset' && (
            <form onSubmit={handleCompleteReset} className="mt-6 flex flex-col gap-4" noValidate>
              <div className="w-full rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Code sent to</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-brand-800">{resetEmail}</p>
              </div>
              <div className="flex justify-center gap-2">
                {resetCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { resetCodeRefs.current[i] = el; }}
                    value={digit}
                    onChange={(e) => setResetCodeDigit(i, e.target.value)}
                    onKeyDown={(e) => onResetCodeKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Reset code digit ${i + 1}`}
                    className="h-12 w-11 rounded-xl border border-line bg-white text-center font-display text-xl font-bold text-ink-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                ))}
              </div>
              <Input id="reset-password" name="password" type="password" label="New password" placeholder="Minimum 8 characters" autoComplete="new-password" minLength={8} required />
              <Input id="reset-confirm-password" name="confirm_password" type="password" label="Confirm new password" placeholder="Repeat password" autoComplete="new-password" minLength={8} required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Reset password</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Need another code?{' '}
                <button type="button" onClick={() => openAuth('forgot-request')} className="font-semibold text-brand-800 hover:text-brand-900">Start again</button>
                <span className="mx-1">·</span>
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">Back to login</button>
              </p>
            </form>
          )}

          {/* ── STAFF ── */}
          {modalView === 'admin' && (
            <form onSubmit={handleStaffLogin} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="staff-username" name="username" label="Username" placeholder="e.g. astrid.admin" autoComplete="username" required />
              <Input id="staff-password" name="password" type="password" label="Password" placeholder="••••••••" autoComplete="current-password" required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy}>Log in as Staff</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Not staff?{' '}
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">← Customer login</button>
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
              <Input id="reg-pass" name="password" type="password" label="Password" placeholder="Minimum 8 characters" autoComplete="new-password" minLength={8} required />
              <Input id="reg-confirm" name="confirm_password" type="password" label="Confirm password" placeholder="Repeat password" autoComplete="new-password" minLength={8} required />
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
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Code sent to</p>
                <p className="mt-0.5 text-sm font-semibold text-brand-800">{verifyEmail}</p>
              </div>
              <div className="flex gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    value={digit}
                    onChange={(e) => setOtpDigit(i, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                    className="h-12 w-11 rounded-xl border border-line bg-white text-center font-display text-xl font-bold text-ink-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                ))}
              </div>
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button block size="lg" loading={busy} onClick={handleVerify}>Verify code</Button>
              <div className="text-center text-sm text-ink-500">
                Didn't get it?{' '}
                <button type="button" onClick={handleResend} disabled={resendIn > 0} className="font-semibold text-brand-800 disabled:opacity-50 hover:enabled:text-brand-900">
                  {resendIn > 0 ? `Resend in ${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}` : 'Resend email'}
                </button>
              </div>
              <p className="text-center text-xs text-ink-400">
                This helps us prevent fraudulent bookings and protect your slot. Never share your code with anyone.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
