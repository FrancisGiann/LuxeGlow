<section class="admin-page admin-page--list">
  <div class="page-header">
    <div>
      <h1 class="page-title">Appointment List</h1>
      <p class="page-subtitle">Confirm, reschedule or cancel upcoming visits</p>
    </div>
    <div style="display: flex; gap: 0.75rem; align-items: center; width: 100%; max-width: 500px;">
      <input type="text" id="appointmentSearch" placeholder="🔍 Search booking ID, customer, email, phone..." style="padding: 0.5rem 0.75rem; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 0.875rem; font-family: inherit; flex: 1;" />
      <select id="listFilter" class="select">
        <option>All Bookings</option>
        <option>Pending</option>
        <option>Confirmed</option>
        <option>Completed</option>
        <option>Cancelled</option>
      </select>
    </div>
  </div>
  <div class="stack" id="appointmentList"><!-- injected --></div>
</section>

<!-- Native Dialog Modal for Appointment Details -->
<dialog id="appointmentDetailModal" style="padding: 2rem; border-radius: 12px; border: 1px solid var(--border, #ddd); max-width: 500px; width: 100%;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border, #eee); padding-bottom: 0.75rem;">
    <h2 style="font-size: 1.25rem; font-weight: 700;">Appointment Details</h2>
    <span id="detailStatusPill" class="status-pill">Pending</span>
  </div>
  
  <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.9rem;">
    <div style="background: var(--background, #f9f9fb); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border, #eee);">
      <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted-foreground, #777); font-weight: 600;">Reference ID</p>
      <p id="detailAppId" style="font-size: 1.1rem; font-weight: 700; color: var(--brand-purple, #6b21a8);"></p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <div>
        <p style="font-size: 0.75rem; color: #777; font-weight: 600;">Customer</p>
        <p id="detailCustomerName" style="font-weight: 600;"></p>
      </div>
      <div>
        <p style="font-size: 0.75rem; color: #777; font-weight: 600;">Contact Number</p>
        <p id="detailCustomerContact"></p>
      </div>
      <div style="grid-column: 1 / -1;">
        <p style="font-size: 0.75rem; color: #777; font-weight: 600;">Email Address</p>
        <p id="detailCustomerEmail"></p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; border-top: 1px solid #eee; padding-top: 0.75rem;">
      <div>
        <p style="font-size: 0.75rem; color: #777; font-weight: 600;">Date</p>
        <p id="detailDate" style="font-weight: 600;"></p>
      </div>
      <div>
        <p style="font-size: 0.75rem; color: #777; font-weight: 600;">Time & Duration</p>
        <p id="detailTimeDuration" style="font-weight: 600;"></p>
      </div>
    </div>

    <div style="border-top: 1px solid #eee; padding-top: 0.75rem;">
      <p style="font-size: 0.75rem; color: #777; font-weight: 600; margin-bottom: 0.5rem;">Booked Services</p>
      <div id="detailServicesList" style="display: flex; flex-direction: column; gap: 0.4rem;"><!-- injected --></div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px dashed #eee; padding-top: 0.75rem; margin-top: 0.25rem;">
      <span style="font-size: 1rem; font-weight: 700;">Total Price</span>
      <span id="detailTotalPrice" style="font-size: 1.2rem; font-weight: 800; color: var(--brand-purple, #6b21a8);"></span>
    </div>
  </div>

  <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
    <button class="btn btn--soft" id="closeDetailModalBtn">Close</button>
  </div>
</dialog>

<!-- Native Dialog Modal for Reschedule -->
<dialog id="rescheduleModal" style="padding: 2rem; border-radius: 12px; border: 1px solid var(--border, #ddd); max-width: 440px; width: 100%;">
  <h2 style="margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 700;">Reschedule Appointment</h2>
  <p id="rescheduleSub" style="margin-bottom: 1rem; font-size: 0.875rem; color: #666;"></p>
  <input type="hidden" id="rescheduleAppId" />
  
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <label style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.875rem; font-weight: 600;">
      New Date
      <input type="text" id="rescheduleDate" class="flatpickr-input" placeholder="Select date..." style="padding: 0.6rem; border: 1px solid #ccc; border-radius: 6px; font-family: inherit;" />
    </label>
    
    <div>
      <span style="font-size: 0.875rem; font-weight: 600;">Available Time Slot</span>
      <div id="rescheduleTimeGrid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 0.25rem;">
        <p style="font-size:0.85rem; color:#888; grid-column: 1 / -1;">Select a date to view available time slots.</p>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
      <button class="btn btn--soft" id="rescheduleCancel">Cancel</button>
      <button class="btn btn--brand" id="rescheduleSave">Save Reschedule</button>
    </div>
  </div>
</dialog>