import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Button } from '../ui/Button';
import { IconPrinter, IconX } from '../icons';
import { formatLongDate, formatPeso, formatTime, toAppointmentDate } from '../../utils/format';

const DEFAULT_SALON_NAME = 'Astrid Nails & Beauty Bar';

const textValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeTime = (value) => {
  const timeText = textValue(value);
  const match = timeText.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return timeText;

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hours === 12) hours = 0;
    if (meridiem === 'PM') hours += 12;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
};

const parseDate = (dateValue, timeValue) => {
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const dateText = textValue(dateValue);
  if (!dateText) return null;

  const timeText = normalizeTime(timeValue) || '00:00:00';
  const date = dateText.includes('T') || dateText.includes(' ')
    ? new Date(dateText)
    : toAppointmentDate(dateText, timeText);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAppointmentDate = (dateValue, timeValue, fallback = '') => {
  const date = parseDate(dateValue, timeValue);
  if (date) return formatLongDate(date);
  return textValue(fallback) || '—';
};

const formatAppointmentTime = (dateValue, timeValue, fallback = '') => {
  const date = parseDate(dateValue, timeValue);
  if (date) return formatTime(date);
  return textValue(fallback) || '—';
};

const formatTimestamp = (value) => {
  const valueText = textValue(value);
  if (!valueText) return '—';

  const date = value instanceof Date ? value : new Date(valueText);
  if (Number.isNaN(date.getTime())) return valueText;
  return `${formatLongDate(date)} · ${formatTime(date)}`;
};

const normalizeServices = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((service) => {
        if (typeof service === 'string') return { name: textValue(service), price: null };
        if (!service || typeof service !== 'object') return null;
        return {
          name: textValue(service.name || service.service || service.title),
          price: finiteNumber(service.price ?? service.amount),
        };
      })
      .filter((service) => service?.name);
  }

  const name = textValue(value);
  return name ? [{ name, price: null }] : [];
};

const normalizeCustomerName = (customer = {}) => {
  const source = customer && typeof customer === 'object' ? customer : {};
  const fullName = textValue(source.full_name || source.name);
  if (fullName) return fullName;
  return [source.first_name, source.last_name].map(textValue).filter(Boolean).join(' ') || '—';
};

const normalizeReceipt = (receipt = {}) => {
  const source = receipt && typeof receipt === 'object' ? receipt : {};
  const services = normalizeServices(source.services ?? source.service);
  const explicitTotal = finiteNumber(source.serviceTotal ?? source.total ?? source.price);
  const servicesTotal = services.reduce((sum, service) => sum + (service.price ?? 0), 0);

  return {
    salonName: textValue(source.salonName) || DEFAULT_SALON_NAME,
    reference: textValue(source.reference || source.id),
    customerName: normalizeCustomerName(source.customer),
    email: textValue(source.customer?.email),
    phone: textValue(source.customer?.phone),
    services,
    appointmentDate: source.appointmentDate ?? source.raw_date ?? source.date,
    appointmentTime: source.appointmentTime ?? source.raw_time ?? source.time,
    staffName: textValue(source.staffName || source.staff_name) || (source.staff_id ? 'Assigned team member' : 'Unassigned'),
    dateLabel: source.dateLabel,
    serviceTotal: explicitTotal ?? (services.length && services.some((service) => service.price !== null) ? servicesTotal : null),
    status: textValue(source.status || source.bookingStatus),
    createdAt: source.createdAt ?? source.bookingCreatedAt ?? source.issuedAt,
  };
};

function ReceiptRow({ label, children, emphasized = false }) {
  return (
    <div className={`flex items-start justify-between gap-6 border-b border-line py-3 last:border-b-0 ${emphasized ? 'font-bold' : ''}`}>
      <dt className="shrink-0 text-sm text-ink-500">{label}</dt>
      <dd className={`min-w-0 text-right text-sm ${emphasized ? 'font-display text-lg text-brand-800' : 'font-semibold text-ink-900'}`}>
        {children}
      </dd>
    </div>
  );
}

/**
 * Shared booking confirmation preview used after booking and from completed visits.
 * The confirmation data is display-only: it intentionally contains no payment state.
 */
export function BookingReceiptModal({ receipt, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef(null);
  const [generatedAt] = useState(() => new Date());
  const [printMessage, setPrintMessage] = useState('');
  const normalized = useMemo(() => normalizeReceipt(receipt), [receipt]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('receipt-printing');
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      document.body.classList.remove('receipt-printing');
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const handlePrint = () => {
    if (typeof window === 'undefined' || typeof window.print !== 'function') {
      setPrintMessage('Printing is not available in this browser.');
      return;
    }

    try {
      window.print();
    } catch {
      setPrintMessage('Printing is not available in this browser.');
    }
  };

  const appointmentDate = formatAppointmentDate(
    normalized.appointmentDate,
    normalized.appointmentTime,
    normalized.dateLabel
  );
  const appointmentTime = formatAppointmentTime(
    normalized.appointmentDate,
    normalized.appointmentTime,
    normalized.appointmentTime
  );

  return (
    <div className="receipt-print-overlay fixed inset-0 z-[1150] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink-900/75 px-4 py-6 backdrop-blur-md sm:items-center sm:px-6 sm:py-8" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="receipt-print-backdrop absolute inset-0 h-full w-full cursor-default border-0 bg-transparent"
        onClick={() => onCloseRef.current?.()}
        aria-label="Close booking confirmation preview"
      />

      <div className="receipt-print-content relative my-6 w-full max-w-2xl sm:my-8">
        <div className="receipt-print-actions mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Booking confirmation preview</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="on-dark" size="sm" onClick={handlePrint}>
              <IconPrinter size={16} />
              Print
            </Button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => onCloseRef.current?.()}
              aria-label="Close booking confirmation preview"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <IconX size={17} />
            </button>
          </div>
        </div>

        <article className="receipt-print-document rounded-3xl border border-line bg-surface p-6 shadow-float sm:p-10">
          <header className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-brand-800 pb-6">
            <div>
              <p className="font-display text-2xl font-extrabold text-brand-800">{normalized.salonName}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-ink-400">LuxeGlow Experience</p>
            </div>
            <div className="text-left sm:text-right">
              <h2 id={titleId} className="font-display text-2xl font-bold text-ink-900">Booking Confirmation</h2>
              <p className="mt-1 text-sm font-semibold text-ink-500">Appointment record</p>
            </div>
          </header>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <section aria-labelledby={`${titleId}-booking`}>
              <h3 id={`${titleId}-booking`} className="font-sans text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Booking details</h3>
              <dl className="mt-2">
                <ReceiptRow label="Booking reference">{normalized.reference || '—'}</ReceiptRow>
                <ReceiptRow label="Appointment date">{appointmentDate}</ReceiptRow>
                <ReceiptRow label="Appointment time">{appointmentTime}</ReceiptRow>
                <ReceiptRow label="Team member">{normalized.staffName}</ReceiptRow>
                <ReceiptRow label="Booking status">{normalized.status || '—'}</ReceiptRow>
              </dl>
            </section>

            <section aria-labelledby={`${titleId}-customer`}>
              <h3 id={`${titleId}-customer`} className="font-sans text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Customer</h3>
              <dl className="mt-2">
                <ReceiptRow label="Name">{normalized.customerName}</ReceiptRow>
                <ReceiptRow label="Email">{normalized.email || '—'}</ReceiptRow>
                <ReceiptRow label="Phone">{normalized.phone || '—'}</ReceiptRow>
              </dl>
            </section>
          </div>

          <section className="mt-7" aria-labelledby={`${titleId}-services`}>
            <h3 id={`${titleId}-services`} className="font-sans text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Services</h3>
            <div className="mt-2 rounded-2xl border border-line">
              {normalized.services.length > 0 ? (
                <ul>
                  {normalized.services.map((service, index) => (
                    <li key={`${service.name}-${index}`} className="flex items-start justify-between gap-5 border-b border-line px-4 py-3 text-sm last:border-b-0">
                      <span className="font-semibold text-ink-900">{service.name}</span>
                      {service.price !== null && <span className="shrink-0 font-semibold text-ink-700">{formatPeso(service.price)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-ink-500">—</p>
              )}
            </div>
          </section>

          <dl className="mt-5 border-t-2 border-brand-800">
            <ReceiptRow label="Service total" emphasized>
              {normalized.serviceTotal === null ? '—' : formatPeso(normalized.serviceTotal)}
            </ReceiptRow>
          </dl>

          <p className="receipt-payment-note mt-6 rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-center text-sm font-bold text-ink-900">
            Appointment record only — not proof of payment.
          </p>

          <footer className="mt-6 grid gap-1 border-t border-line pt-4 text-xs text-ink-500 sm:grid-cols-2">
            <p>Booking created / issued: <span className="font-semibold text-ink-700">{formatTimestamp(normalized.createdAt)}</span></p>
            <p className="sm:text-right">Generated / printed: <span className="font-semibold text-ink-700">{formatTimestamp(generatedAt)}</span></p>
          </footer>

          {printMessage && <p className="receipt-print-actions mt-4 text-center text-xs font-medium text-danger" role="status">{printMessage}</p>}
        </article>
      </div>
    </div>
  );
}
