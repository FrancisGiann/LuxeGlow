<section class="admin-page admin-page--accounts">
  <div class="page-header">
    <div>
      <h1 class="page-title">Account Management</h1>
      <p class="page-subtitle">Super Admin only — staff and admin accounts</p>
    </div>
    <button class="btn btn--brand" id="addAccountBtn">+ Add Staff Account</button>
  </div>
  <div class="table-card">
    <table class="data-table data-table--wide">
      <thead>
        <tr>
          <th>Name</th>
          <th>Position</th>
          <th>Role</th>
          <th>Contact Number</th>
          <th>Email</th>
          <th>Username</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="accountsBody"><!-- injected --></tbody>
    </table>
  </div>
</section>

<!-- Add / Edit Staff Account Modal -->
<dialog id="staffModal" style="padding: 2rem; border-radius: 12px; border: 1px solid var(--border, #ddd); max-width: 500px; width: 100%;">
  <form id="staffForm" style="display: flex; flex-direction: column; gap: 1rem;">
    <h2 id="staffModalTitle" style="font-size: 1.25rem; font-weight: 700;">Add Staff Account</h2>
    <input type="hidden" id="staffAccountId" name="account_id" />

    <label class="field">
      <span class="field__label">Full Name *</span>
      <input type="text" id="staffName" name="name" required style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
    </label>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <label class="field">
        <span class="field__label">Position *</span>
        <input type="text" id="staffPosition" name="position" required placeholder="e.g. Nail Tech" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
      </label>

      <label class="field">
        <span class="field__label">Role *</span>
        <select id="staffRole" name="role" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;">
          <option value="Staff">Staff</option>
          <option value="Super Admin">Super Admin</option>
        </select>
      </label>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <label class="field">
        <span class="field__label">Email *</span>
        <input type="email" id="staffEmail" name="email" required style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
      </label>

      <label class="field">
        <span class="field__label">Contact Number</span>
        <input type="text" id="staffContact" name="contact_number" placeholder="0917 000 0000" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
      </label>
    </div>

    <label class="field">
      <span class="field__label">Address</span>
      <input type="text" id="staffAddress" name="address" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
    </label>

    <div id="staffCreateOnlyFields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <label class="field">
        <span class="field__label">Username *</span>
        <input type="text" id="staffUsername" name="username" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
      </label>

      <label class="field">
        <span class="field__label">Password *</span>
        <input type="password" id="staffPassword" name="password" minlength="8" placeholder="Min 8 chars" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
      </label>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
      <button type="button" class="btn btn--soft" id="cancelStaffModal">Cancel</button>
      <button type="submit" class="btn btn--brand" id="saveStaffBtn">Save Account</button>
    </div>
  </form>
</dialog>

<!-- Reset Password Modal -->
<dialog id="resetPasswordModal" style="padding: 2rem; border-radius: 12px; border: 1px solid var(--border, #ddd); max-width: 400px; width: 100%;">
  <form id="resetPasswordForm" style="display: flex; flex-direction: column; gap: 1rem;">
    <h2 style="font-size: 1.25rem; font-weight: 700;">Reset Password</h2>
    <input type="hidden" id="resetAccountId" name="account_id" />
    <p id="resetStaffNameText" style="font-size: 0.9rem; color: var(--muted-foreground, #666); margin-bottom: 0.5rem;"></p>

    <label class="field">
      <span class="field__label">New Password *</span>
      <input type="password" id="newPasswordInput" name="new_password" required minlength="8" placeholder="At least 8 characters" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;" />
    </label>

    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
      <button type="button" class="btn btn--soft" id="cancelResetModal">Cancel</button>
      <button type="submit" class="btn btn--brand">Update Password</button>
    </div>
  </form>
</dialog>