import { useEffect, useState } from 'react';
import { createReview, getRatableAppointments } from '../../api/endpoints';
import { useDashboard } from '../../context/DashboardContext';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Select, Textarea } from '../ui/Field';
import { IconStar, IconX } from '../icons';
import { formatPeso } from '../../utils/format';

export function StarPicker({ value, onChange, size = 28 }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className={`transition-transform hover:scale-110 ${star <= active ? 'text-gold-400' : 'text-line-strong'}`}
        >
          <IconStar size={size} filled={star <= active} />
        </button>
      ))}
    </div>
  );
}

export function RateVisitModal({ onClose, presetAppointmentId }) {
  const { refresh } = useDashboard();
  const toast = useToast();
  const [ratable, setRatable] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [appointmentId, setAppointmentId] = useState(presetAppointmentId || '');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getRatableAppointments()
      .then((data) => {
        if (!alive) return;
        if (data.success) {
          setRatable(data.appointments);
          if (!presetAppointmentId && data.appointments.length) {
            setAppointmentId(String(data.appointments[0].appointment_id));
          }
        } else setLoadError(data.error || 'Could not load your visits.');
      })
      .catch((e) => alive && setLoadError(e.message || 'Could not load your visits.'));
    return () => {
      alive = false;
    };
  }, [presetAppointmentId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!appointmentId) {
      setError('Please choose a visit to rate.');
      return;
    }
    setBusy(true);
    try {
      const res = await createReview(appointmentId, rating, text.trim());
      if (res.success) {
        toast(res.message || 'Thank you for your feedback!');
        refresh();
        onClose();
      } else {
        setError(res.error || 'Could not submit your review.');
      }
    } catch (err) {
      setError(err.message || 'Could not submit your review.');
    } finally {
      setBusy(false);
    }
  };

  const selected = ratable?.find((a) => String(a.appointment_id) === appointmentId);

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink-900/75 px-4 py-6 backdrop-blur-md sm:items-center sm:px-6 sm:py-8" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative my-6 w-full max-w-md sm:my-8">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-500 shadow-card transition-colors hover:text-ink-900 sm:-right-2"
        >
          <IconX size={16} />
        </button>

        <form onSubmit={submit} className="rounded-3xl border border-line bg-surface p-5 shadow-float sm:p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-100 text-gold-600">
              <IconStar filled />
            </span>
            <h2 className="font-display text-2xl font-bold">Rate Your Visit</h2>
            <p className="text-sm text-ink-500">Your feedback helps us serve you better.</p>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {ratable === null && !loadError && (
              <div className="h-11 animate-pulse rounded-xl bg-canvas" />
            )}
            {loadError && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{loadError}</p>}
            {ratable?.length === 0 && (
              <p className="rounded-xl bg-brand-50 px-4 py-3 text-center text-sm font-medium text-ink-700">
                Every completed visit already has a review. Book your next appointment when you are ready.
              </p>
            )}

            {ratable?.length > 0 && (
              <>
                <Select
                  id="rate-visit"
                  label="Select visit"
                  value={appointmentId}
                  onChange={(e) => setAppointmentId(e.target.value)}
                  required
                >
                  {ratable.map((a) => (
                    <option key={a.appointment_id} value={a.appointment_id}>
                      #{a.appointment_id} — {a.service_names} ({a.appointment_date}, {a.appointment_time})
                    </option>
                  ))}
                </Select>

                {selected && (
                  <p className="-mt-1 text-xs font-semibold text-brand-800">
                    {formatPeso(selected.total_price)} · {selected.service_names}
                  </p>
                )}

                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">Your rating</span>
                  <StarPicker value={rating} onChange={setRating} />
                </div>

                <Textarea
                  id="rate-text"
                  label="Review (optional)"
                  placeholder="Tell us what you loved or how we can improve…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={500}
                />

                {error && <p className="text-sm font-medium text-danger">{error}</p>}
                <Button type="submit" block size="lg" loading={busy}>
                  Submit Rating
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
