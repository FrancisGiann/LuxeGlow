import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { BrandLogo } from '../branding/BrandLogo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { IconCheckCircle, IconX } from '../icons';
import { getPasswordPolicyError, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy';
import { isStaffRole } from '../../utils/roles';
import { verificationCooldownSeconds } from '../../utils/verificationFeedback';
import {
  changeLoginFailureEmail,
  emptyLoginFailureState,
  isCurrentLoginFailure,
  normalizeLoginEmail,
  recordLoginFailure,
  shouldSuggestPasswordReset,
} from '../../utils/loginRecoveryHint';

const VIEWS = {
  login: 'Log in',
  admin: 'Log in',
  register: 'Create an Account',
  verify: 'Verify Your Email',
  'forgot-request': 'Reset Your Password',
  'forgot-reset': 'Choose a New Password',
  'password-success': 'Password update complete',
};

function BrandMark() {
  return (
    <div className="flex justify-center">
      <BrandLogo className="h-24 w-24" />
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
    register,
    resend,
    requestPasswordReset,
    completePasswordReset,
    passwordSetup,
    passwordCompletion,
    sessionNotice,
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginFailureState, setLoginFailureState] = useState(emptyLoginFailureState);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [resendForEmail, setResendForEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const resendLockRef = useRef(false);
  const loginLockRef = useRef(false);
  const loginEmailIdentityRef = useRef('');
  const loginIdentityGenerationRef = useRef(0);
  const currentModalViewRef = useRef(modalView);
  const previousModalViewRef = useRef(modalView);

  const updateLoginEmail = (email) => {
    const normalizedEmail = normalizeLoginEmail(email);
    if (loginEmailIdentityRef.current !== normalizedEmail) {
      loginEmailIdentityRef.current = normalizedEmail;
      loginIdentityGenerationRef.current += 1;
    }
    setLoginEmail(email);
    setLoginFailureState((current) => changeLoginFailureEmail(current, email));
  };

  useLayoutEffect(() => {
    if (currentModalViewRef.current !== modalView) {
      currentModalViewRef.current = modalView;
      loginIdentityGenerationRef.current += 1;
    }
  }, [modalView]);

  useEffect(() => {
    setError(passwordSetup?.error || '');
    setResetCode('');
    if (!modalView || (modalView === 'login' && previousModalViewRef.current !== 'login')) {
      setLoginFailureState(emptyLoginFailureState());
    }
    previousModalViewRef.current = modalView;
    if (!modalView) {
      setResetEmail('');
      setLoginEmail('');
      loginEmailIdentityRef.current = '';
      loginIdentityGenerationRef.current += 1;
    }
  }, [modalView, passwordSetup?.error, passwordSetup?.type, passwordSetup?.userId]);

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
  const passwordResetSuggested = shouldSuggestPasswordReset(loginFailureState, loginEmail);

  const openPasswordReset = (email = loginEmail) => {
    setError('');
    setResetEmail(String(email || '').trim());
    openAuth('forgot-request');
  };

  const finishAndGoDashboard = () => {
    let returnPath = '';
    try {
      returnPath = window.sessionStorage.getItem('luxeglow-auth-return') || '';
      window.sessionStorage.removeItem('luxeglow-auth-return');
    } catch {
      // Storage may be blocked; use the normal dashboard destination.
    }
    closeAuth();
    navigate(returnPath === '/book' || window.location.pathname === '/book' ? '/book' : '/dashboard/overview', { replace: true });
  };

  const handleVerificationSignIn = () => {
    updateLoginEmail(verifyEmail);
    openAuth('login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loginLockRef.current) return;
    loginLockRef.current = true;
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const submittedEmail = String(f.get('email') || '');
    const submittedIdentityGeneration = loginIdentityGenerationRef.current;
    const isCurrentAttempt = () => isCurrentLoginFailure(
      { email: submittedEmail, generation: submittedIdentityGeneration },
      { email: loginEmailIdentityRef.current, generation: loginIdentityGenerationRef.current },
    );
    try {
      const res = await login(submittedEmail, f.get('password'));
      if (res.ok) {
        if (isCurrentAttempt()) {
          setLoginFailureState(emptyLoginFailureState());
        }
        if (isStaffRole(res.role)) {
          toast('Signed in successfully.', 'success');
          navigate('/admin', { replace: true });
        } else {
          finishAndGoDashboard();
        }
      } else if (res.needsVerification) {
        if (isCurrentAttempt()) {
          setLoginFailureState(emptyLoginFailureState());
        }
      } else {
        if (isCurrentAttempt()) {
          setError(res.error);
          setLoginFailureState((current) => recordLoginFailure(current, submittedEmail, res));
        }
      }
    } catch {
      if (isCurrentAttempt()) {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      loginLockRef.current = false;
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
    if (resendRemaining > 0 || resendLockRef.current) return;
    resendLockRef.current = true;
    setResendBusy(true);
    try {
      const res = await resend();
      setResendForEmail(resendKey);
      setResendIn(verificationCooldownSeconds(res));
      if (res.ok) toast('Verification email requested. Check your inbox and spam folder.', 'info');
      else toast(res.error || 'Could not resend the verification email right now.', 'error');
    } catch {
      setResendForEmail(resendKey);
      setResendIn(60);
      toast('Could not resend the verification email right now. Please try again.', 'error');
    } finally {
      resendLockRef.current = false;
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
    const email = (resetEmail || passwordSetup?.email || '').trim();
    const codeCanEstablishRecoverySession = passwordSetup?.type === 'recovery' && Boolean(code);
    if (passwordSetup?.error || (!passwordSetup?.ready && !codeCanEstablishRecoverySession)) return;
    if (code && passwordSetup?.type !== 'recovery') {
      setError('Recovery codes are only valid for password-reset emails. Open the invitation link to set a staff password.');
      return;
    }
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
      if (!res.ok) setError(res.error || 'That code is invalid or expired.');
    } catch {
      setError('Could not reset your password right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const codeCanEstablishRecoverySession = passwordSetup?.type === 'recovery' && Boolean(resetCode.trim());
  const passwordSetupBlocked = Boolean(passwordSetup?.error) || !(passwordSetup?.ready || codeCanEstablishRecoverySession);
  const inviteCompletion = passwordCompletion?.type === 'invite';

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-ink-900/55 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
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
          <h2 id="auth-modal-title" className="mt-4 text-center font-display text-2xl font-bold">{VIEWS[modalView]}</h2>
          <p className="mt-1 text-center text-sm text-ink-500">
            {modalView === 'login' && 'Sign in to your account.'}
            {modalView === 'register' && 'Join Astrid Nails & Beauty Bar in under a minute.'}
            {modalView === 'verify' && 'Verify this email address to continue.'}
            {modalView === 'forgot-request' && 'We will email a secure reset link if that address is registered.'}
            {modalView === 'forgot-reset' && (passwordSetup?.ready ? 'Use the secure link, or enter the code if your email provides one.' : passwordSetup?.type === 'recovery' ? 'Open the reset link, or enter the recovery code from that email.' : 'Open the invitation or reset link from your email before choosing a password.')}
            {modalView === 'password-success' && (inviteCompletion ? 'Your staff account is ready for secure sign-in.' : 'Choose where to sign in next.')}
          </p>
          {sessionNotice && <p className="mt-4 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-center text-sm font-semibold text-brand-800" role="status">{sessionNotice}</p>}

          {/* ── LOGIN ── */}
          {modalView === 'login' && (
            <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="login-email" name="email" type="email" label="Email address" placeholder="you@example.com" autoComplete="username" value={loginEmail} onChange={(event) => updateLoginEmail(event.target.value)} required />
              <Input id="login-password" name="password" type="password" label="Password" placeholder="••••••••" autoComplete="current-password" required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              {passwordResetSuggested && <div className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-center" role="status">
                <p className="text-sm font-semibold text-brand-900">Having trouble signing in?</p>
                <button type="button" onClick={() => openPasswordReset(loginEmail)} className="mt-1 text-sm font-bold text-brand-800 underline underline-offset-2 hover:text-brand-900">Reset your password</button>
              </div>}
              <Button type="submit" block size="lg" loading={busy}>Log in</Button>
              <div className="flex flex-col items-center gap-2 pt-2 text-sm text-ink-500">
                <button type="button" onClick={() => openPasswordReset(loginEmail)} className="font-semibold text-brand-800 hover:text-brand-900">Forgot password?</button>
                <span>
                  New here?{' '}
                  <button type="button" onClick={() => openAuth('register')} className="font-semibold text-brand-800 hover:text-brand-900">Create an account</button>
                </span>
              </div>
            </form>
          )}

          {/* ── PASSWORD RESET REQUEST ── */}
          {modalView === 'forgot-request' && (
            <form onSubmit={handleRequestReset} className="mt-6 flex flex-col gap-4" noValidate>
              <Input id="reset-request-email" name="email" type="email" label="Registered email address" placeholder="you@example.com" autoComplete="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} required />
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
              {(resetEmail || passwordSetup?.email) ? <div className="w-full rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Account</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-brand-800">{resetEmail || passwordSetup?.email}</p>
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
                <p className="text-sm text-ink-500">{passwordSetup?.type === 'invite' ? 'Use the invitation link to confirm your email and set your password.' : 'Use the secure link, or enter the recovery code if your email provides one.'}</p>
              </div>
              {passwordSetup?.type !== 'invite' && <Input
                  id="reset-code"
                  label="Optional 6-digit recovery code"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  hint="Leave this blank when you opened the secure reset link."
                />}
              <Input id="reset-password" name="password" type="password" label="New password" placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} hint={PASSWORD_POLICY_HINT} required />
              <Input id="reset-confirm-password" name="confirm_password" type="password" label="Confirm new password" placeholder="Repeat password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" block size="lg" loading={busy} disabled={passwordSetupBlocked}>{passwordSetup?.type === 'invite' ? 'Set password' : 'Reset password'}</Button>
              <p className="pt-1 text-center text-sm text-ink-500">
                Need another reset email?{' '}
                <button type="button" onClick={() => openPasswordReset(resetEmail)} className="font-semibold text-brand-800 hover:text-brand-900">Start again</button>
                <span className="mx-1">·</span>
                <button type="button" onClick={() => openAuth('login')} className="font-semibold text-brand-800 hover:text-brand-900">Back to login</button>
              </p>
            </form>
          )}

          {/* ── PASSWORD UPDATE SUCCESS ── */}
          {modalView === 'password-success' && (
            <div className="mt-6 flex flex-col items-center gap-5 text-center" role="status" aria-live="polite">
              <IconCheckCircle size={42} className="text-success" />
              {inviteCompletion ? (
                <>
                  <div>
                    <h3 className="font-display text-xl font-medium text-ink-900">Staff account verified</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">Your account email is verified and your password was created successfully.</p>
                  </div>
                  <Button type="button" block size="lg" onClick={() => openAuth('login')}>Log in</Button>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-display text-xl font-medium text-ink-900">Password changed successfully</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">Your password was changed successfully.</p>
                  </div>
                  <Button type="button" block size="lg" onClick={() => openAuth('login')}>Log in</Button>
                </>
              )}
            </div>
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
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Email address</p>
                <p className="mt-0.5 text-sm font-semibold text-brand-800">{verifyEmail}</p>
              </div>

              <div className="py-4 text-center">
                <h3 className="mb-2 text-lg font-bold text-ink-900">Check your inbox and spam folder.</h3>
                <p className="text-sm text-ink-500">Open the email link to confirm this address. If you confirm on another device, return here and sign in to continue.</p>
              </div>

              <div className="text-center text-sm text-ink-500">
                Need a link?{' '}
                <button type="button" onClick={handleResend} disabled={resendRemaining > 0 || resendBusy} className="font-semibold text-brand-800 disabled:opacity-50 hover:enabled:text-brand-900">
                  {resendBusy ? 'Sending…' : resendRemaining > 0 ? `Resend in ${Math.floor(resendRemaining / 60)}:${String(resendRemaining % 60).padStart(2, '0')}` : 'Resend email'}
                </button>
              </div>
              <Button type="button" variant="soft" onClick={handleVerificationSignIn}>Sign in</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
