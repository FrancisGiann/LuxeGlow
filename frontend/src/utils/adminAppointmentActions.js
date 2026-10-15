const APPOINTMENT_ACTIONS = {
  Pending: [
    { status: "Confirmed", label: "Confirm", variant: "primary" },
    { status: "Cancelled", label: "Cancel appointment", variant: "secondary" },
  ],
  Confirmed: [
    { status: "Completed", label: "Mark completed", variant: "primary" },
    { status: "Cancelled", label: "Cancel appointment", variant: "secondary" },
  ],
};

export function getAdminAppointmentActions(status) {
  return APPOINTMENT_ACTIONS[status] || [];
}
