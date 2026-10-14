export function closeAdminStatusConfirmation({
  isBusy,
  busyRef,
  setDialogError,
  setPendingStatus,
}) {
  if (isBusy || busyRef.current) return false;
  setPendingStatus(null);
  setDialogError('');
  return true;
}

export async function runAdminStatusConfirmation({
  pendingStatus,
  appointments,
  busyRef,
  isTransitionAllowed,
  updateStatus,
  loadAppointments,
  setBusy,
  setPageError,
  setDialogError,
  setSelectedAppointment,
  setPendingStatus,
  setNotice,
}) {
  if (!pendingStatus || busyRef.current) return 'ignored';

  const requestedStatus = pendingStatus;
  busyRef.current = true;
  setBusy(true);
  setPageError('');
  setDialogError('');

  try {
    const current = appointments.find((item) => item.id === requestedStatus.id);
    if (!current || !isTransitionAllowed(current, requestedStatus.to)) {
      const refreshed = await loadAppointments();
      if (
        !refreshed.some(
          (item) => String(item.id) === String(requestedStatus.id),
        )
      )
        setSelectedAppointment(null);
      setPendingStatus(null);
      setDialogError('');
      return 'stale';
    }

    await updateStatus(current.id, requestedStatus.to);
    const refreshed = await loadAppointments();
    if (['Confirmed', 'Cancelled'].includes(requestedStatus.to)) {
      setSelectedAppointment(null);
    } else {
      setSelectedAppointment((selected) =>
        selected?.id === current.id
          ? refreshed.find((item) => item.id === current.id) || null
          : selected,
      );
    }
    setNotice(
      `Appointment ${current.reference_no} marked ${requestedStatus.to.toLowerCase()}.`,
    );
    setDialogError('');
    setPendingStatus(null);
    return 'saved';
  } catch (statusError) {
    const message =
      statusError?.message || 'Could not update appointment status.';
    setPageError(message);
    setDialogError(message);
    return 'failed';
  } finally {
    busyRef.current = false;
    setBusy(false);
  }
}
