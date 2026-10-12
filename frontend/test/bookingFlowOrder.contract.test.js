import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bookingPage = readFileSync(resolve(projectRoot, 'frontend/src/pages/BookingPage.jsx'), 'utf8');

test('booking task cards follow the visible date, service, team, review sequence', () => {
  const headings = [
    'title="Choose date and time"',
    'id="booking-services-heading"',
    'title="Choose a team preference"',
    'title="Next step"',
  ];
  const positions = headings.map((heading) => bookingPage.indexOf(heading));

  assert.ok(positions.every((position) => position >= 0), 'all booking task cards should be present');
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.ok(bookingPage.indexOf('<Summary') > positions.at(-1), 'the summary should remain after the task stack in source order');
  assert.match(bookingPage, /if \(reviewStep\) return <main[\s\S]*?title="Review your booking"[\s\S]*?Confirm booking/);
});
test('availability starts at 30 minutes, clears times on date changes, and rechecks service and staff changes', () => {
  assert.match(bookingPage, /loadAvailability\(selectedStaffId, date, totalMinutes \|\| 30, availabilitySelectionVersionRef\.current\)/);
  assert.match(bookingPage, /Times are offered in 30-minute increments/);
  assert.match(bookingPage, /With no services selected, we check for a 30-minute visit\./);
  assert.match(bookingPage, /Change your date, services, or team preference and we’ll recheck your time\./);
  assert.match(bookingPage, /setSlots\(null\);\s*setSlotsLoading\(true\);/);
  const selectedTimeRecheck = bookingPage.match(/useEffect\(\(\) => \{\s*if \(slotsLoading \|\| !time \|\| !slots \|\| slots\.some\(\(slot\) => slot\.time === time && slot\.available\)\) return;\s*setTime\(''\);\s*toast\("That time doesn't fit your updated choices\. Choose another available time\.", 'info'\);[\s\S]*?\}, \[slots, slotsLoading, time, toast\]\);/)?.[0];
  assert.ok(selectedTimeRecheck, 'unavailable selected times should be cleared with recovery feedback after loading');

  const handlers = [
    bookingPage.match(/const toggleService = [\s\S]*?\n  \};/)?.[0],
    bookingPage.match(/const selectDate = [^\n]+/)?.[0],
    bookingPage.match(/const selectStaff = [^\n]+/)?.[0],
  ];

  assert.ok(handlers.every(Boolean), 'service, date, and staff selection handlers should be present');
  assert.doesNotMatch(handlers[0], /setTime\(''\)/, 'service changes should revalidate the selected time');
  assert.match(handlers[1], /setDate\(value\); setTime\(''\); invalidateAvailability\(\)/, 'date changes should immediately clear the selected time');
  assert.doesNotMatch(handlers[2], /setTime\(''\)/, 'staff changes should revalidate the selected time');
});

test('booking review requires a current slot and confirmation rechecks availability before creating', () => {
  assert.match(bookingPage, /const hasAvailableSelectedTime = Boolean\(time && slots\?\.some\(\(slot\) => slot\.time === time && slot\.available\)\)/);
  assert.match(bookingPage, /if \(slotsLoading\) errors\.time/);
  assert.match(bookingPage, /const confirmBooking = async \(\) =>/);
  assert.match(bookingPage, /const latestSlots = await getAvailableSlots\(date, totalMinutes \|\| 30, selectedStaffId\)/);
  assert.match(bookingPage, /if \(!latestSlots\.some\(\(slot\) => slot\.time === time && slot\.available\)\)/);
  assert.match(bookingPage, /const result = await createAppointment\(/);
});
