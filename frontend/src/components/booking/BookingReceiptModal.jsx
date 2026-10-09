import { useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { IconX } from '../icons';
import { formatLongDate, formatPeso, formatTime, toAppointmentDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';
import notoSansRegular from '../../assets/fonts/NotoSans-Regular.ttf';
import notoSansBold from '../../assets/fonts/NotoSans-Bold.ttf';

const DEFAULT_SALON_NAME = 'Astrid Nails & Beauty Bar';
const RECEIPT_FONT = 'ReceiptSans';

Font.register({
  family: RECEIPT_FONT,
  fonts: [
    { src: notoSansRegular, fontWeight: 400 },
    { src: notoSansBold, fontWeight: 700 },
  ],
});

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

const emailFontSize = (email) => {
  if (!email) return 12;

  const estimatedWidthInEm = Array.from(email).reduce((width, character) => {
    if (/[ilI.,:;!'|]/.test(character)) return width + 0.3;
    if (/[MW@%&]/.test(character)) return width + 0.9;
    if (/[A-Z]/.test(character)) return width + 0.7;
    return width + 0.55;
  }, 0);

  return Math.max(6, Math.min(12, 390 / estimatedWidthInEm));
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

export const normalizeReceipt = (receipt = {}) => {
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

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: RECEIPT_FONT },
  header: { borderBottom: '2px solid #5a1846', paddingBottom: 10, marginBottom: 20 },
  salonName: { fontSize: 24, color: '#5a1846', fontWeight: 'bold' },
  subtitle: { fontSize: 10, color: '#737373', marginTop: 4, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  sectionTitle: { fontSize: 10, color: '#737373', textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #eee', paddingVertical: 8 },
  rowLabel: { fontSize: 12, color: '#666', width: '22%' },
  rowValue: { fontSize: 12, fontWeight: 'bold', color: '#111', width: '76%', flexShrink: 1, textAlign: 'right' },
  rowValueEmphasized: { fontSize: 16, fontWeight: 'bold', color: '#5a1846', width: '76%', textAlign: 'right' },
  servicesBox: { border: '1px solid #eee', borderRadius: 4, padding: 10, marginTop: 10 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  serviceName: { fontSize: 12, color: '#111', flexGrow: 1, flexShrink: 1, paddingRight: 12 },
  servicePrice: { fontSize: 12, color: '#333', textAlign: 'right', flexShrink: 0 },
  note: { marginTop: 20, padding: 10, backgroundColor: '#fcf8e3', border: '1px solid #faebcc', borderRadius: 4, textAlign: 'center', fontSize: 10, color: '#8a6d3b' },
  footer: { marginTop: 20, borderTop: '1px solid #eee', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, color: '#666' },
});

export const ReceiptDocument = ({ normalized, appointmentDate, appointmentTime, generatedAt, hidePrint }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={styles.salonName}>{normalized.salonName}</Text>
            <Text style={styles.subtitle}>LuxeGlow Experience</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>{hidePrint ? 'Booking Details' : 'Booking Confirmation'}</Text>
            <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Appointment record</Text>
          </View>
        </View>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Booking details</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Booking reference</Text><Text style={styles.rowValue}>{normalized.reference || '—'}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Appointment date</Text><Text style={styles.rowValue}>{appointmentDate}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Appointment time</Text><Text style={styles.rowValue}>{appointmentTime}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Team member</Text><Text style={styles.rowValue}>{normalized.staffName}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Booking status</Text><Text style={styles.rowValue}>{normalized.status || '—'}</Text></View>

        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Name</Text><Text style={styles.rowValue}>{normalized.customerName}</Text></View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={{ ...styles.rowValue, fontSize: emailFontSize(normalized.email) }}>{normalized.email || '—'}</Text>
        </View>
        <View style={styles.row}><Text style={styles.rowLabel}>Phone</Text><Text style={styles.rowValue}>{normalized.phone || '—'}</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Services</Text>
      <View style={styles.servicesBox}>
        {normalized.services.length > 0 ? (
          normalized.services.map((service, index) => (
            <View key={index} style={styles.serviceRow}>
              <Text style={styles.serviceName}>{service.name}</Text>
              {service.price !== null && <Text style={styles.servicePrice}>{formatPeso(service.price)}</Text>}
            </View>
          ))
        ) : (
          <Text style={styles.serviceName}>—</Text>
        )}
      </View>

      <View style={{ ...styles.row, marginTop: 10, borderBottom: 'none' }}>
        <Text style={styles.rowLabel}>Service total</Text>
        <Text style={styles.rowValueEmphasized}>{normalized.serviceTotal === null ? '—' : formatPeso(normalized.serviceTotal)}</Text>
      </View>

      <Text style={styles.note}>Appointment record only — not proof of payment.</Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Booking created: {formatTimestamp(normalized.createdAt)}</Text>
        {!hidePrint && <Text style={styles.footerText}>Generated: {formatTimestamp(generatedAt)}</Text>}
      </View>
    </Page>
  </Document>
);

export function BookingReceiptModal({ receipt, onClose, hidePrint = false }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef(null);
  const mountedRef = useRef(false);
  const downloadSequenceRef = useRef(0);
  const activeDownloadRef = useRef(null);
  const downloadUrlRef = useRef(null);
  const revokeTimerRef = useRef(null);
  const [generatedAt] = useState(() => new Date());
  const [downloadState, setDownloadState] = useState({ identity: null, busy: false, error: '' });
  const normalized = useMemo(() => normalizeReceipt(receipt), [receipt]);
  const receiptIdentity = useMemo(() => JSON.stringify({ normalized, hidePrint }), [normalized, hidePrint]);
  const latestReceiptIdentityRef = useRef(receiptIdentity);
  const downloadBusy = downloadState.identity === receiptIdentity && downloadState.busy;
  const downloadError = downloadState.identity === receiptIdentity ? downloadState.error : '';

  useLayoutEffect(() => {
    latestReceiptIdentityRef.current = receiptIdentity;
  }, [receiptIdentity]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    previousFocusRef.current = document.activeElement;
    mountedRef.current = true;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('receipt-printing');
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      mountedRef.current = false;
      downloadSequenceRef.current += 1;
      activeDownloadRef.current = null;
      if (revokeTimerRef.current) window.clearTimeout(revokeTimerRef.current);
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      revokeTimerRef.current = null;
      downloadUrlRef.current = null;
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      document.body.classList.remove('receipt-printing');
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const downloadPdf = async () => {
    if (activeDownloadRef.current?.identity === receiptIdentity) return;
    const request = ++downloadSequenceRef.current;
    activeDownloadRef.current = { request, identity: receiptIdentity };
    setDownloadState({ identity: receiptIdentity, busy: true, error: '' });
    try {
      const blob = await pdf(
        <ReceiptDocument
          normalized={normalized}
          appointmentDate={formatAppointmentDate(normalized.appointmentDate, normalized.appointmentTime, normalized.dateLabel)}
          appointmentTime={formatAppointmentTime(normalized.appointmentDate, normalized.appointmentTime, normalized.appointmentTime)}
          generatedAt={generatedAt}
          hidePrint={hidePrint}
        />,
      ).toBlob();
      if (!mountedRef.current || activeDownloadRef.current?.request !== request || latestReceiptIdentityRef.current !== receiptIdentity) return;
      if (revokeTimerRef.current) window.clearTimeout(revokeTimerRef.current);
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      const url = URL.createObjectURL(blob);
      downloadUrlRef.current = url;
      const filenameReference = normalized.reference
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'booking';
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filenameReference}-booking-confirmation.pdf`;
      link.style.display = 'none';
      document.body.append(link);
      link.click();
      link.remove();
      revokeTimerRef.current = window.setTimeout(() => {
        if (downloadUrlRef.current === url) downloadUrlRef.current = null;
        URL.revokeObjectURL(url);
        revokeTimerRef.current = null;
      }, 30_000);
      setDownloadState({ identity: receiptIdentity, busy: false, error: '' });
    } catch {
      if (mountedRef.current && activeDownloadRef.current?.request === request && latestReceiptIdentityRef.current === receiptIdentity) {
        setDownloadState({ identity: receiptIdentity, busy: false, error: 'We couldn’t prepare the PDF. Please try again.' });
      }
    } finally {
      if (activeDownloadRef.current?.request === request) activeDownloadRef.current = null;
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
    <div className="receipt-print-overlay fixed inset-0 z-[1150] flex items-start justify-center bg-ink-900/75 p-4 sm:p-8 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="receipt-print-backdrop absolute inset-0 h-full w-full cursor-default border-0 bg-transparent"
        onClick={() => onCloseRef.current?.()}
        aria-label="Close booking confirmation preview"
      />

      <div className="receipt-print-content relative flex h-full w-full max-w-4xl flex-col rounded-2xl bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
          <p className="font-semibold text-ink-900" id={titleId}>{hidePrint ? 'Booking details' : 'Booking confirmation preview'}</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-500 hover:bg-canvas hover:text-ink-900"
            aria-label="Close"
          >
            <IconX size={17} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <article className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-5 sm:p-8">
            <header className="border-b-2 border-brand-800 pb-4">
              <h2 className="font-display text-2xl font-semibold text-brand-800">{normalized.salonName}</h2>
              <p className="mt-1 text-xs uppercase tracking-wider text-ink-500">LuxeGlow Experience</p>
              <p className="mt-4 font-display text-xl font-semibold text-ink-900">{hidePrint ? 'Booking details' : 'Booking confirmation'}</p>
              <p className="mt-1 text-sm text-ink-500">Appointment record · Not proof of payment</p>
            </header>
            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Booking details</h3>
              <dl className="mt-2 divide-y divide-line text-sm">
                {[
                  ['Booking reference', normalized.reference || '—'],
                  ['Appointment date', appointmentDate],
                  ['Appointment time', appointmentTime],
                  ['Team member', normalized.staffName],
                  ['Booking status', normalized.status || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="min-w-0 max-w-[65%] break-words text-right font-semibold text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Customer</h3>
              <dl className="mt-2 divide-y divide-line text-sm">
                {[
                  ['Name', normalized.customerName],
                  ['Email', normalized.email || '—'],
                  ['Phone', normalized.phone || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="break-all text-right font-semibold text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Services</h3>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line px-3 text-sm">
                {normalized.services.length ? normalized.services.map((service, index) => (
                  <li key={`${service.name}-${index}`} className="flex flex-wrap justify-between gap-3 py-3">
                    <span className="min-w-0 break-words font-semibold text-ink-900">{service.name}</span>
                    {service.price !== null && <span className="shrink-0 text-ink-700">{formatPeso(service.price)}</span>}
                  </li>
                )) : <li className="py-3 text-ink-500">—</li>}
              </ul>
              <div className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-semibold">
                <span>Service total</span>
                <span className="font-display text-lg text-brand-800">{normalized.serviceTotal === null ? '—' : formatPeso(normalized.serviceTotal)}</span>
              </div>
            </section>
            <footer className="mt-5 border-t border-line pt-3 text-xs text-ink-500">
              Booking created: {formatTimestamp(normalized.createdAt)}
              {!hidePrint && <span className="block">Generated: {formatTimestamp(generatedAt)}</span>}
            </footer>
          </article>
          {downloadError && <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{downloadError}</p>}
          <div className="mx-auto mt-4 flex max-w-2xl justify-end gap-3">
            <Button type="button" variant="soft" onClick={() => onCloseRef.current?.()}>Close</Button>
            <Button type="button" onClick={downloadPdf} loading={downloadBusy}>
              {downloadBusy ? 'Preparing PDF…' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
