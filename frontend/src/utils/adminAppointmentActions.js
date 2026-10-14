const APPOINTMENT_ACTIONS = {
  Pending: [{ status: "Confirmed", label: "Confirm", variant: "primary" }],
  Confirmed: [{ status: "Completed", label: "Mark completed", variant: "primary" }],
};

export function getAdminAppointmentActions(status) {
  return APPOINTMENT_ACTIONS[status] || [];
}
