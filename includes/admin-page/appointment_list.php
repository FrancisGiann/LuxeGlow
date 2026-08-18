<section class="admin-page admin-page--list">
  <div class="page-header">
    <div>
      <h1 class="page-title">Appointment List</h1>
      <p class="page-subtitle">Confirm, reschedule or cancel upcoming visits</p>
    </div>
    <select id="listFilter" class="select">
      <option>All Bookings</option>
      <option>Pending</option>
      <option>Confirmed</option>
      <option>Completed</option>
      <option>Cancelled</option>
    </select>
  </div>
  <div class="stack" id="appointmentList"><!-- injected --></div>
</section>

<!-- Native Dialog Modal for Reschedule -->
<dialog id="rescheduleModal" style="padding: 2rem; border-radius: 8px; border: 1px solid #ddd; max-width: 440px; width: 100%;">
  <h2 style="margin-bottom: 0.5rem; font-size: 1.25rem;">Reschedule Appointment</h2>
  <p id="rescheduleSub" style="margin-bottom: 1rem; font-size: 0.875rem; color: #666;"></p>
  <input type="hidden" id="rescheduleAppId" />
  
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
      New Date
      <input type="date" id="rescheduleDate" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
    </label>
    
    <div>
      <span style="font-size: 0.875rem; font-weight: 600;">Available Time Slot</span>
      <div id="rescheduleTimeGrid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.5rem; max-height: 180px; overflow-y: auto; padding-right: 0.25rem;">
        <p style="font-size:0.85rem; color:#888; grid-column: 1 / -1;">Select a date to view available time slots.</p>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
      <button class="btn btn--soft" id="rescheduleCancel">Cancel</button>
      <button class="btn btn--brand" id="rescheduleSave">Save Reschedule</button>
    </div>
  </div>
</dialog>