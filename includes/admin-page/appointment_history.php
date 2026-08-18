<section class="admin-page admin-page--history">
  <div class="page-header">
    <div>
      <h1 class="page-title">Appointment History</h1>
      <p class="page-subtitle">Customer master list and lifetime value</p>
    </div>
  </div>
  <div class="search-wrap">
    <input type="text" id="historySearch" placeholder="search customers by name, email, or phone..." />
  </div>
  <div class="table-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>Customers</th><th>Contacts</th><th>Visits</th><th>Total Spent</th><th>Last Visit</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="historyBody"><!-- injected --></tbody>
    </table>
  </div>
</section>

<!-- Dialog Modal for Viewing Customer Appointment History -->
<dialog id="customerDetailModal" style="padding: 2rem; border-radius: 8px; border: 1px solid #ddd; max-width: 600px; width: 100%;">
  <h2 id="custDetailTitle" style="margin-bottom: 0.25rem; font-size: 1.25rem;">Customer History</h2>
  <p id="custDetailMeta" style="margin-bottom: 1rem; font-size: 0.875rem; color: #666;"></p>
  
  <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem;">
    <table class="data-table" style="width: 100%; font-size: 0.85rem;">
      <thead>
        <tr>
          <th>ID</th><th>Date & Time</th><th>Services</th><th>Price</th><th>Status</th>
        </tr>
      </thead>
      <tbody id="custDetailBody"><!-- injected --></tbody>
    </table>
  </div>

  <div style="display: flex; justify-content: flex-end;">
    <button class="btn btn--soft" id="custDetailClose">Close</button>
  </div>
</dialog>

<!-- Dialog Modal for Editing Customer Contact Info -->
<dialog id="customerEditModal" style="padding: 2rem; border-radius: 8px; border: 1px solid #ddd; max-width: 440px; width: 100%;">
  <h2 style="margin-bottom: 0.5rem; font-size: 1.25rem;">Edit Customer Info</h2>
  <p style="margin-bottom: 1rem; font-size: 0.875rem; color: #666;">Update contact details for this customer.</p>
  
  <form id="customerEditForm" style="display: flex; flex-direction: column; gap: 0.75rem;">
    <input type="hidden" id="editCustId" name="customer_id" />
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; font-weight: 600;">
        First Name
        <input type="text" id="editCustFirstName" name="first_name" required style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; font-weight: 600;">
        Last Name
        <input type="text" id="editCustLastName" name="last_name" required style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
      </label>
    </div>

    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; font-weight: 600;">
      Email Address
      <input type="email" id="editCustEmail" name="email" required style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
    </label>

    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; font-weight: 600;">
      Phone Number
      <input type="text" id="editCustPhone" name="phone" required style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
    </label>

    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
      <button type="button" class="btn btn--soft" id="editCustCancel">Cancel</button>
      <button type="submit" class="btn btn--brand">Save Changes</button>
    </div>
  </form>
</dialog>