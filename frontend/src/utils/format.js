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

export const getCurrentTimestamp = () => Date.now();

/** Parse the salon's Asia/Manila wall-clock date/time as an instant. */
export const toAppointmentDate = (rawDate, rawTime) =>
  new Date(`${rawDate}T${rawTime || '00:00:00'}+08:00`);

export const formatLongDate = (date) =>
  date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export const formatTime = (date) =>
  date.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
