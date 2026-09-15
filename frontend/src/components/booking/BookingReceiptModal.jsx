import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Button } from '../ui/Button';
import { IconPrinter, IconX } from '../icons';
import { formatLongDate, formatPeso, formatTime, toAppointmentDate } from '../../utils/format';
import { Document, Page, Text, View, StyleSheet, PDFViewer } from '@react-pdf/renderer';

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

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { borderBottom: '2px solid #5a1846', paddingBottom: 10, marginBottom: 20 },
  salonName: { fontSize: 24, color: '#5a1846', fontWeight: 'bold' },
  subtitle: { fontSize: 10, color: '#999', marginTop: 4, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  sectionTitle: { fontSize: 10, color: '#999', textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingVertical: 8 },
  rowLabel: { fontSize: 12, color: '#666' },
  rowValue: { fontSize: 12, fontWeight: 'bold', color: '#111', width: '60%', textAlign: 'right' },
  rowValueEmphasized: { fontSize: 16, fontWeight: 'bold', color: '#5a1846', width: '60%', textAlign: 'right' },
  servicesBox: { border: '1px solid #eee', borderRadius: 4, padding: 10, marginTop: 10 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  serviceName: { fontSize: 12, color: '#111' },
  servicePrice: { fontSize: 12, color: '#333' },
  note: { marginTop: 20, padding: 10, backgroundColor: '#fcf8e3', border: '1px solid #faebcc', borderRadius: 4, textAlign: 'center', fontSize: 10, color: '#8a6d3b' },
  footer: { marginTop: 20, borderTop: '1px solid #eee', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, color: '#666' },
});

const ReceiptDocument = ({ normalized, appointmentDate, appointmentTime, generatedAt, hidePrint }) => (
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: '48%' }}>
          <Text style={styles.sectionTitle}>Booking details</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>Booking reference</Text><Text style={styles.rowValue}>{normalized.reference || '—'}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Appointment date</Text><Text style={styles.rowValue}>{appointmentDate}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Appointment time</Text><Text style={styles.rowValue}>{appointmentTime}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Team member</Text><Text style={styles.rowValue}>{normalized.staffName}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Booking status</Text><Text style={styles.rowValue}>{normalized.status || '—'}</Text></View>
        </View>
        <View style={{ width: '48%' }}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>Name</Text><Text style={styles.rowValue}>{normalized.customerName}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Email</Text><Text style={styles.rowValue}>{normalized.email || '—'}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Phone</Text><Text style={styles.rowValue}>{normalized.phone || '—'}</Text></View>
        </View>
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
  const [generatedAt] = useState(() => new Date());
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
        
        <div className="flex-1 overflow-hidden p-0">
          <PDFViewer width="100%" height="100%" className="border-0">
            <ReceiptDocument
              normalized={normalized}
              appointmentDate={appointmentDate}
              appointmentTime={appointmentTime}
              generatedAt={generatedAt}
              hidePrint={hidePrint}
            />
          </PDFViewer>
        </div>
      </div>
    </div>
  );
}
