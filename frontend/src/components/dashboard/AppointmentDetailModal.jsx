import { useEffect } from 'react';
import { StatusPill } from '../ui/StatusPill';
import { Button } from '../ui/Button';
import { IconCalendar, IconClock, IconSparkle, IconX } from '../icons';
import { formatLongDate, formatPeso, formatTime, toAppointmentDate } from '../../utils/format';

function DetailRow({ icon: Icon, label, children, emphasized = false }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0 ${emphasized ? 'font-bold' : ''}`}>
      <dt className="flex shrink-0 items-center gap-1.5 text-sm text-ink-500">
        {Icon && <Icon size={15} className="text-ink-400" aria-hidden="true" />}
        <span>{label}</span>
      </dt>
      <dd className={`min-w-0 text-right text-sm ${emphasized ? 'font-display text-lg text-brand-800' : 'font-semibold text-ink-900'}`}>
        {children}
      </dd>
    </div>
  );
}

export function AppointmentDetailModal({ appointment, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!appointment) return null;

  const appointmentDate = appointment.raw_date
    ? toAppointmentDate(appointment.raw_date, appointment.raw_time)
    : null;
  const isDateValid = appointmentDate && !Number.isNaN(appointmentDate.getTime());
  const formattedDate = isDateValid ? formatLongDate(appointmentDate) : (appointment.date || '—');
  const formattedTime = isDateValid ? formatTime(appointmentDate) : (appointment.time || '—');

  const createdDate = appointment.created_at ? new Date(appointment.created_at) : null;
  const isCreatedValid = createdDate && !Number.isNaN(createdDate.getTime());
  const formattedCreatedAt = isCreatedValid
    ? `${formatLongDate(createdDate)} · ${formatTime(createdDate)}`
    : (appointment.created_at || '—');

  const referenceNo = appointment.reference_no || appointment.id || '—';

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink-900/75 px-4 py-6 backdrop-blur-md sm:items-center sm:px-6 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-detail-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative my-6 w-full max-w-md sm:my-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-500 shadow-card transition-colors hover:text-ink-900 sm:-right-2"
        >
          <IconX size={16} />
        </button>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-float sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-blush-50 text-brand-300">
              {appointment.service_image ? (
                <img src={appointment.service_image} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <IconSparkle size={22} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="appointment-detail-title" className="break-words font-display text-xl font-bold text-ink-900">
                {appointment.service || 'Appointment Details'}
              </h2>
              <p className="mt-1 break-words text-xs text-ink-500">
                {appointment.staff_name || 'Unassigned'} · Ref #{referenceNo}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center">
            <StatusPill status={appointment.status} />
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.15em] text-ink-400">
              Appointment Details
            </h3>
            <dl className="mt-2">
              <DetailRow icon={IconCalendar} label="Date">{formattedDate}</DetailRow>
              <DetailRow icon={IconClock} label="Time">{formattedTime}</DetailRow>
              <DetailRow label="Service">{appointment.service || '—'}</DetailRow>
              <DetailRow label="Staff">{appointment.staff_name || 'Unassigned'}</DetailRow>
              <DetailRow label="Price" emphasized>{formatPeso(appointment.price ?? appointment.total_price)}</DetailRow>
              <DetailRow label="Reference">{referenceNo}</DetailRow>
              <DetailRow label="Booked on">{formattedCreatedAt}</DetailRow>
            </dl>
          </div>

          <div className="mt-6 pt-2">
            <Button type="button" variant="soft" block onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
