import { useEffect, useState } from 'react';
import { updateCustomerProfile } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

export function ProfilePage() {
  const { customer: dashCustomer, refresh: refreshDashboard } = useDashboard();
  const { customer: authCustomer, refreshSession } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* Hydrate once the aggregated payload arrives */
  useEffect(() => {
    if (!loaded && dashCustomer) {
      setForm((f) => ({
        ...f,
        firstName: dashCustomer.first_name || '',
        lastName: dashCustomer.last_name || '',
        phone: dashCustomer.phone || '',
      }));
      setLoaded(true);
    }
  }, [dashCustomer, loaded]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.phone.trim()) next.phone = 'Phone number is required.';
    if (form.password) {
      if (form.password.length < 8) next.password = 'New password must be at least 8 characters.';
      else if (form.password !== form.confirm) next.confirm = 'Passwords do not match.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await updateCustomerProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        newPassword: form.password,
      });
      if (res.success) {
        toast(res.message || 'Profile updated!');
        setForm((f) => ({ ...f, password: '', confirm: '' }));
        await Promise.all([refreshSession(), refreshDashboard()]);
      } else {
        setErrors({ form: res.error || 'Could not update your profile.' });
      }
    } catch (err) {
      setErrors({ form: err.message || 'Could not update your profile.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader
          title="My Profile & Account Settings"
          subtitle="Update your personal details and account password."
        />

        {!loaded ? (
          <div className="flex flex-col gap-4 py-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-canvas" />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="flex max-w-xl flex-col gap-5 pt-2" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input id="prof-first" label="First name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} required />
              <Input id="prof-last" label="Last name" value={form.lastName} onChange={set('lastName')} />
            </div>

            <Input
              id="prof-email"
              type="email"
              label="Email address"
              hint="Email is your login and cannot be changed."
              value={authCustomer?.email || ''}
              disabled
            />

            <Input id="prof-phone" type="tel" label="Phone number" value={form.phone} onChange={set('phone')} error={errors.phone} required />

            <div className="rounded-2xl border border-line bg-canvas p-5">
              <p className="mb-3 text-sm font-bold text-ink-900">Change password</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="prof-pass"
                  type="password"
                  label="New password"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password}
                />
                <Input
                  id="prof-confirm"
                  type="password"
                  label="Confirm new password"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  error={errors.confirm}
                />
              </div>
              <p className="mt-2 text-xs text-ink-400">Leave both blank to keep your current password.</p>
            </div>

            {errors.form && <p className="text-sm font-medium text-danger">{errors.form}</p>}

            <div>
              <Button type="submit" size="lg" loading={busy}>Save Changes</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
