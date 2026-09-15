function stringValue(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function isValidLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function searchableAppointmentText(appointment) {
  const customer = appointment?.customer && typeof appointment.customer === 'object' ? appointment.customer : {};
  const staffRecords = [appointment?.staff, appointment?.assigned_staff, appointment?.staff_profile]
    .filter((staff) => staff && typeof staff === 'object');
  const services = Array.isArray(appointment?.services) ? appointment.services : [];
  const values = [
    appointment?.reference_no,
    appointment?.reference,
    customer.first_name,
    customer.last_name,
    customer.email,
    customer.phone,
    appointment?.staff_name,
    appointment?.assigned_staff_name,
    ...staffRecords.flatMap((staff) => [staff.first_name, staff.last_name, staff.email, staff.name]),
    ...services.flatMap((service) => service && typeof service === 'object' ? [service.service_name, service.name] : []),
  ];
  return values.map(stringValue).filter(Boolean).join(' ').toLowerCase();
}

export function manilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createInitialAppointmentFilters(now = new Date()) {
  return { date: manilaDateKey(now), status: 'all', search: '' };
}

function localTimeSeconds(value) {
  const time = stringValue(value);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null;
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

export function initialAdminTab(role) {
  return role === 'staff' ? 'appointments' : 'overview';
}

export function appointmentFilterPreset(kind, today = manilaDateKey(), appointment = null) {
  if (kind === 'pending') return { date: '', status: 'Pending', search: '' };
  if (kind === 'all') return { date: '', status: 'all', search: '' };
  if (kind === 'appointment') {
    return { date: '', status: 'all', search: '' };
  }
  return { date: isValidLocalDate(today) ? today : manilaDateKey(), status: 'all', search: '' };
}

export function sortAppointmentsByLocalTime(appointments) {
  if (!Array.isArray(appointments)) return [];
  return appointments
    .map((appointment, index) => ({ appointment, index }))
    .sort((left, right) => {
      const leftTime = localTimeSeconds(left.appointment?.local_time);
      const rightTime = localTimeSeconds(right.appointment?.local_time);
      if (leftTime === null && rightTime !== null) return 1;
      if (rightTime === null && leftTime !== null) return -1;
      if (leftTime === null) return left.index - right.index;
      return leftTime - rightTime || left.index - right.index;
    })
    .map(({ appointment }) => appointment);
}

export function getAdminAppointmentQueue(appointments, filters = {}) {
  const source = Array.isArray(appointments) ? appointments : [];
  const activeFilters = filters && typeof filters === 'object' ? filters : {};
  const date = stringValue(activeFilters.date).trim();
  const status = activeFilters.status || 'all';
  const term = stringValue(activeFilters.search).trim().toLowerCase();
  const matching = source.filter((appointment) => {
    if (!appointment || typeof appointment !== 'object') return false;
    if (date && appointment.local_date !== date) return false;
    if (status !== 'all' && appointment.status !== status) return false;
    return !term || searchableAppointmentText(appointment).includes(term);
  });
  return date ? sortAppointmentsByLocalTime(matching) : matching;
}

export function appointmentQueueEmptyMessage(totalAppointments, filters = {}) {
  const activeFilters = filters && typeof filters === 'object' ? filters : {};
  const hasFilters = Boolean(
    stringValue(activeFilters.date).trim()
    || (activeFilters.status && activeFilters.status !== 'all')
    || stringValue(activeFilters.search).trim(),
  );
  return totalAppointments || hasFilters ? 'No appointments match these filters.' : 'No appointments yet.';
}

export function adminNavGroupForTab(tab) {
  if (['overview', 'appointments', 'customers'].includes(tab)) return 'daily-work';
  if (['catalog', 'schedule'].includes(tab)) return 'salon-setup';
  if (['faqs', 'about'].includes(tab)) return 'website-content';
  return tab === 'staff' ? 'people-access' : null;
}
