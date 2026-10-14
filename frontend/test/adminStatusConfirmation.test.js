import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closeAdminStatusConfirmation,
  runAdminStatusConfirmation,
} from '../src/utils/adminStatusConfirmation.js';

function createHarness({
  appointment = { id: 'appointment-1', reference_no: 'LX-1042', status: 'Pending' },
  requestedStatus = { id: 'appointment-1', to: 'Confirmed' },
  updateStatus = async () => {},
  loadAppointments = async () => [
    { ...appointment, status: requestedStatus.to },
  ],
} = {}) {
  const state = {
    selectedAppointment: appointment,
    pendingStatus: requestedStatus,
    busy: false,
    pageError: '',
    dialogError: '',
    notice: '',
  };
  const events = [];
  const updateCalls = [];
  let loadCalls = 0;
  const busyRef = { current: false };
  const dependencies = {
    pendingStatus: requestedStatus,
    appointments: [appointment],
    busyRef,
    isTransitionAllowed: (current, nextStatus) => {
      const transitions = {
        Pending: ['Confirmed', 'Cancelled'],
        Confirmed: ['Completed', 'Cancelled'],
      };
      return transitions[current.status]?.includes(nextStatus) === true;
    },
    updateStatus: async (...args) => {
      updateCalls.push(args);
      return updateStatus(...args);
    },
    loadAppointments: async () => {
      loadCalls += 1;
      return loadAppointments();
    },
    setBusy: (value) => {
      state.busy = value;
    },
    setPageError: (value) => {
      state.pageError = value;
    },
    setDialogError: (value) => {
      state.dialogError = value;
    },
    setSelectedAppointment: (value) => {
      state.selectedAppointment =
        typeof value === 'function' ? value(state.selectedAppointment) : value;
      if (state.selectedAppointment === null) events.push('selection-cleared');
    },
    setPendingStatus: (value) => {
      state.pendingStatus = value;
      if (value === null) events.push('confirmation-closed');
    },
    setNotice: (value) => {
      state.notice = value;
    },
  };

  return {
    state,
    busyRef,
    events,
    updateCalls,
    dependencies,
    get loadCalls() {
      return loadCalls;
    },
    submit: () => runAdminStatusConfirmation(dependencies),
  };
}

test('Confirm and Cancel save once, refresh, clear selection, then close confirmation', async () => {
  for (const scenario of [
    {
      appointment: { id: 'appointment-1', reference_no: 'LX-1042', status: 'Pending' },
      requestedStatus: { id: 'appointment-1', to: 'Confirmed' },
    },
    {
      appointment: { id: 'appointment-1', reference_no: 'LX-1042', status: 'Confirmed' },
      requestedStatus: { id: 'appointment-1', to: 'Cancelled' },
    },
  ]) {
    const harness = createHarness(scenario);
    const result = await harness.submit();

    assert.equal(result, 'saved');
    assert.deepEqual(harness.updateCalls, [['appointment-1', scenario.requestedStatus.to]]);
    assert.equal(harness.loadCalls, 1);
    assert.equal(harness.state.selectedAppointment, null);
    assert.equal(harness.state.pendingStatus, null);
    assert.ok(harness.events.indexOf('selection-cleared') < harness.events.indexOf('confirmation-closed'));
    assert.equal(harness.state.notice, `Appointment LX-1042 marked ${scenario.requestedStatus.to.toLowerCase()}.`);
    assert.equal(harness.busyRef.current, false);
    assert.equal(harness.state.busy, false);
  }
});

test('same-tick repeated submits share the synchronous busy guard', async () => {
  let allowSave;
  let markStarted;
  const saveGate = new Promise((resolve) => {
    allowSave = resolve;
  });
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const harness = createHarness({
    updateStatus: () => {
      markStarted();
      return saveGate;
    },
  });

  const firstSubmit = harness.submit();
  await started;
  assert.equal(harness.busyRef.current, true);
  assert.equal(await harness.submit(), 'ignored');
  assert.equal(harness.updateCalls.length, 1);
  allowSave();

  assert.equal(await firstSubmit, 'saved');
  assert.equal(harness.updateCalls.length, 1);
});

test('a failed status save keeps the confirmation and appointment selection open with an error', async () => {
  const request = { id: 'appointment-1', to: 'Confirmed' };
  const appointment = { id: 'appointment-1', reference_no: 'LX-1042', status: 'Pending' };
  const harness = createHarness({
    appointment,
    requestedStatus: request,
    updateStatus: async () => {
      throw new Error('Status update denied');
    },
  });

  assert.equal(await harness.submit(), 'failed');
  assert.deepEqual(harness.updateCalls, [['appointment-1', 'Confirmed']]);
  assert.equal(harness.loadCalls, 0);
  assert.equal(harness.state.pendingStatus, request);
  assert.equal(harness.state.selectedAppointment, appointment);
  assert.equal(harness.state.dialogError, 'Status update denied');
  assert.equal(harness.state.pageError, 'Status update denied');
  assert.equal(harness.busyRef.current, false);
  assert.equal(harness.state.busy, false);
});

test('Mark completed keeps the existing refreshed-selection path', async () => {
  const appointment = { id: 'appointment-1', reference_no: 'LX-1042', status: 'Confirmed' };
  const refreshed = { ...appointment, status: 'Completed' };
  const harness = createHarness({
    appointment,
    requestedStatus: { id: appointment.id, to: 'Completed' },
    loadAppointments: async () => [refreshed],
  });

  assert.equal(await harness.submit(), 'saved');
  assert.deepEqual(harness.state.selectedAppointment, refreshed);
  assert.equal(harness.state.pendingStatus, null);
});

test('Back to details clears only the confirmation and does not submit while idle', () => {
  const state = {
    selectedAppointment: { id: 'appointment-1' },
    pendingStatus: { id: 'appointment-1', to: 'Confirmed' },
    dialogError: 'Previous error',
  };
  let updateCalls = 0;
  const dependencies = {
    isBusy: false,
    busyRef: { current: false },
    setDialogError: (value) => {
      state.dialogError = value;
    },
    setPendingStatus: (value) => {
      state.pendingStatus = value;
    },
    updateStatus: () => {
      updateCalls += 1;
    },
  };

  assert.equal(closeAdminStatusConfirmation(dependencies), true);
  assert.equal(state.pendingStatus, null);
  assert.equal(state.selectedAppointment.id, 'appointment-1');
  assert.equal(state.dialogError, '');
  assert.equal(updateCalls, 0);
});

test('stale transitions refresh and close safely without saving an obsolete status', async () => {
  const request = { id: 'appointment-1', to: 'Confirmed' };
  const appointment = { id: 'appointment-1', reference_no: 'LX-1042', status: 'Cancelled' };
  const harness = createHarness({
    appointment,
    requestedStatus: request,
    loadAppointments: async () => [],
  });

  assert.equal(await harness.submit(), 'stale');
  assert.equal(harness.updateCalls.length, 0);
  assert.equal(harness.loadCalls, 1);
  assert.equal(harness.state.selectedAppointment, null);
  assert.equal(harness.state.pendingStatus, null);
});
