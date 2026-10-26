// Only consumes the public slot RPC: never fetch appointment/customer records.
export function staffAvailabilityKey(date, time, duration, serviceIds) {
  return JSON.stringify([date, time, duration, [...serviceIds].sort()]);
}

export async function loadStaffAvailability(staff, date, time, duration, getSlots) {
  const entries = await Promise.all(staff.map(async (member) => {
    try {
      const slots = await getSlots(date, duration, member.id);
      return [member.id, slots.some((slot) => slot.time === time && slot.available === true)];
    } catch (error) {
      // A roster member can stop accepting bookings after the list was loaded.
      // Only this explicit server validation means unavailable; outages still fail.
      if (/^Choose an available team member$/i.test(error.message || '')) return [member.id, false];
      throw error;
    }
  }));
  return Object.fromEntries(entries);
}

export function staffChoiceState(id, snapshot, hasTime) {
  if (!hasTime) return { disabled: false, label: '' };
  if (snapshot.status === 'error') return { disabled: true, label: 'Availability could not be checked' };
  if (snapshot.status !== 'ready') return { disabled: true, label: 'Checking availability…' };
  return snapshot.available?.[id] === true
    ? { disabled: false, label: 'Available at this time' }
    : { disabled: true, label: 'Not available at this time' };
}
