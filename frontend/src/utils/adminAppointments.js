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

const APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

export function createInitialAppointmentFilters(status = 'Pending') {
  return { date: '', status: APPOINTMENT_STATUSES.includes(status) ? status : 'Pending', search: '' };
}

function firstRelatedRecord(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export function getAppointmentStaffName(appointment) {
  const normalizedName = appointment?.staff_name;
  if (typeof normalizedName === 'string' && normalizedName.trim()) return normalizedName.trim();
  const rosterMember = firstRelatedRecord(appointment?.staff_member);
  if (typeof rosterMember?.full_name === 'string' && rosterMember.full_name.trim()) {
    return rosterMember.full_name.trim();
  }
  const profile = firstRelatedRecord(appointment?.staff);
  if (profile) {
    const profileName = [profile.first_name, profile.last_name]
      .filter((part) => typeof part === 'string')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
    if (profileName) return profileName;
  }
  return appointment?.staff_member_id || appointment?.staff_id
    ? 'Assigned team member'
    : 'Unassigned';
}

function localTimeSeconds(value) {
  const time = stringValue(value);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null;
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function scheduleSortKey(appointment) {
  if (!isValidLocalDate(appointment?.local_date)) return null;
  const seconds = localTimeSeconds(appointment?.local_time);
  if (seconds === null) return null;
  return `${appointment.local_date}T${String(seconds).padStart(5, '0')}`;
}

function deterministicAppointmentId(appointment) {
  return stringValue(appointment?.id || appointment?.reference_no).trim();
}

export function appointmentFilterPreset(kind, today = manilaDateKey(), appointment = null) {
  if (kind === 'history') return createInitialAppointmentFilters('Completed');
  if (kind === 'today') return { date: isValidLocalDate(today) ? today : manilaDateKey(), status: 'Pending', search: '' };
  if (kind === 'appointment') return createInitialAppointmentFilters(APPOINTMENT_STATUSES.includes(appointment?.status) ? appointment.status : 'Pending');
  if (kind === 'conflict') {
    const status = ['Pending', 'Confirmed'].includes(appointment?.status) ? appointment.status : 'Pending';
    return {
      date: isValidLocalDate(appointment?.local_date) ? appointment.local_date : '',
      status,
      search: stringValue(appointment?.reference_no).trim(),
    };
  }
  if (kind === 'pending' || kind === 'appointments') return createInitialAppointmentFilters('Pending');
  return createInitialAppointmentFilters();
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

export function sortAppointmentsByLocalSchedule(appointments) {
  if (!Array.isArray(appointments)) return [];
  return appointments
    .map((appointment, index) => ({ appointment, index, key: scheduleSortKey(appointment) }))
    .sort((left, right) => {
      if (left.key !== null && right.key === null) return -1;
      if (right.key !== null && left.key === null) return 1;
      if (left.key !== null && right.key !== null && left.key !== right.key) {
        return left.key.localeCompare(right.key);
      }
      const idOrder = deterministicAppointmentId(left.appointment)
        .localeCompare(deterministicAppointmentId(right.appointment));
      return idOrder || left.index - right.index;
    })
    .map(({ appointment }) => appointment);
}

export function getAdminAppointmentQueue(appointments, filters = {}, section = 'appointments') {
  const source = Array.isArray(appointments) ? appointments : [];
  const activeFilters = filters && typeof filters === 'object' ? filters : {};
  const historyView = section === 'history';
  const date = stringValue(activeFilters.date).trim();
  const status = APPOINTMENT_STATUSES.includes(activeFilters.status) ? activeFilters.status : 'Completed';
  const term = stringValue(activeFilters.search).trim().toLowerCase();
  const matching = source.filter((appointment) => {
    if (!appointment || typeof appointment !== 'object') return false;
    if (date && appointment.local_date !== date) return false;
    if (historyView) {
      if (appointment.status !== status) return false;
    } else if (!['Pending', 'Confirmed'].includes(appointment.status)) {
      return false;
    }
    return !term || searchableAppointmentText(appointment).includes(term);
  });
  if (historyView) return date ? sortAppointmentsByLocalTime(matching) : matching;
  return sortAppointmentsByLocalSchedule(matching);
}

export function appointmentQueueEmptyMessage(totalAppointments, filters = {}, section = 'appointments') {
  const activeFilters = filters && typeof filters === 'object' ? filters : {};
  const historyView = section === 'history';
  const hasFilters = Boolean(
    stringValue(activeFilters.date).trim()
    || (historyView && activeFilters.status && activeFilters.status !== 'Completed')
    || stringValue(activeFilters.search).trim(),
  );
  if (!totalAppointments && !hasFilters) return historyView ? 'No appointment history yet.' : 'No appointments yet.';
  if (!historyView && !hasFilters) return 'No active appointments.';
  if (!stringValue(activeFilters.date).trim() && !stringValue(activeFilters.search).trim()) {
    if (historyView && activeFilters.status === 'Completed') return 'No completed appointments yet.';
    if (historyView && activeFilters.status === 'Cancelled') return 'No cancelled appointments yet.';
    if (historyView && activeFilters.status === 'Pending') return 'No pending appointments.';
    if (historyView && activeFilters.status === 'Confirmed') return 'No confirmed appointments.';
  }
  return 'No appointments match these filters.';
}

export function adminNavGroupForTab(tab) {
  if (['appointments', 'history', 'customers'].includes(tab)) return 'daily-work';
  if (['catalog', 'schedule'].includes(tab)) return 'salon-setup';
  if (['faqs', 'about', 'reviews'].includes(tab)) return 'website-content';
  return tab === 'staff' ? 'people-access' : null;
}
