export function pendingReschedule(appointment) {
  return (appointment?.reschedule_requests || []).find((request) => request.status === 'pending') || null;
}

export function latestReschedule(appointment) {
  return [...(appointment?.reschedule_requests || [])].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || String(b.id).localeCompare(String(a.id)))[0] || null;
}

export function requestedTimeLabel(request) {
  if (!request) return '';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(`${request.requested_date}T${request.requested_time}+08:00`));
}

export function rescheduleOutcome(request) {
  if (request?.status === 'approved') return { success: true, message: 'Reschedule approved. The appointment time has changed.' };
  if (request?.status === 'rejected') return { success: true, message: 'Request declined. The original appointment is unchanged.' };
  return { success: false, message: request?.resolution_reason || 'This request is no longer pending. Refresh the appointment before continuing.' };
}
