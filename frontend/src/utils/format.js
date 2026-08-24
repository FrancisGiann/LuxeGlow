export const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const getInitials = (first = '', last = '') => {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return (a + b).toUpperCase() || 'A';
};

/** Combine the backend's raw_date ('YYYY-MM-DD') + raw_time ('HH:MM:SS'). */
export const toAppointmentDate = (rawDate, rawTime) =>
  new Date(`${rawDate}T${rawTime || '00:00:00'}`);

export const formatLongDate = (date) =>
  date.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export const formatTime = (date) =>
  date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
