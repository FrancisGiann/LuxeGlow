import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSelectBookingService,
  normalizeBookingServiceIds,
  selectedPackageForBooking,
} from '../src/utils/bookingSelection.js';

const catalog = [
  { id: 'package-a', item_type: 'package' },
  { id: 'package-b', item_type: 'package' },
  { id: 'service-a', item_type: 'service' },
  { id: 'addon-a', item_type: 'add_on' },
];

test('bookings can combine any number of regular services and add-ons without a package', () => {
  const selected = ['service-a', 'addon-a'];

  assert.equal(selectedPackageForBooking(selected, catalog), null);
  assert.equal(canSelectBookingService('service-a', selected, catalog), true);
  assert.deepEqual(normalizeBookingServiceIds([...selected, 'addon-a'], catalog), selected);
});

test('one package can be combined with services and add-ons, but a second package is blocked', () => {
  const selected = ['package-a', 'service-a', 'addon-a'];

  assert.equal(selectedPackageForBooking(selected, catalog).id, 'package-a');
  assert.equal(canSelectBookingService('package-a', selected, catalog), true);
  assert.equal(canSelectBookingService('package-b', selected, catalog), false);
  assert.equal(canSelectBookingService('service-a', ['package-a'], catalog), true);
  assert.equal(canSelectBookingService('addon-a', ['package-a'], catalog), true);
});

test('restored selections discard unknown and duplicate IDs and keep only the first selected package', () => {
  const restored = ['package-a', 'service-a', 'package-b', 'addon-a', 'service-a', 'deleted-service'];

  assert.deepEqual(normalizeBookingServiceIds(restored, catalog), ['package-a', 'service-a', 'addon-a']);
  assert.deepEqual(normalizeBookingServiceIds(['package-b', 'service-a', 'package-a'], catalog), ['package-b', 'service-a']);
});

test('removing the selected package allows a different package to be selected', () => {
  const afterDeselection = ['service-a', 'addon-a'];

  assert.equal(canSelectBookingService('package-b', afterDeselection, catalog), true);
  assert.deepEqual(normalizeBookingServiceIds([...afterDeselection, 'package-b'], catalog), [
    'service-a',
    'addon-a',
    'package-b',
  ]);
});
