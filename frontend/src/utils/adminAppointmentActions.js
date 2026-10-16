const STAFF_APPOINTMENT_ACTIONS = {
  Pending: [{ status: "Confirmed", label: "Confirm", variant: "primary" }],
  Confirmed: [{ status: "Completed", label: "Mark completed", variant: "primary" }],
};

export function getAdminAppointmentActions(status, role) {
  if (role !== "admin" && role !== "head") return [];
  return STAFF_APPOINTMENT_ACTIONS[status] || [];
}
