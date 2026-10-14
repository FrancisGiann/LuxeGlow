const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function activateStaffAccountImmediately({
  target,
  isAdmin,
  busyRef,
  setBusyId,
  setFeedback,
  updateAccount,
  onSaved,
}) {
  if (!isAdmin || busyRef.current || target?.is_active !== false) return "ignored";

  const requestTarget = {
    id: String(target.id || ""),
    name: String(target.name || "Staff member").trim() || "Staff member",
  };
  if (!UUID_PATTERN.test(requestTarget.id)) return "ignored";

  busyRef.current = true;
  setBusyId(requestTarget.id);
  setFeedback({
    id: requestTarget.id,
    kind: "busy",
    message: `Activating ${requestTarget.name}…`,
  });

  try {
    const result = await updateAccount(requestTarget.id, { is_active: true });
    if (!result?.success) {
      throw new Error(result?.error || "Could not activate this account.");
    }
    onSaved(requestTarget.id);
    setFeedback({
      id: requestTarget.id,
      kind: "success",
      message: `${requestTarget.name} activated.`,
    });
    return "saved";
  } catch (activationError) {
    const message =
      activationError?.message || "Could not activate this account.";
    setFeedback({ id: requestTarget.id, kind: "error", message });
    return "failed";
  } finally {
    busyRef.current = false;
    setBusyId(null);
  }
}
