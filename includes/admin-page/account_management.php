<section class="admin-page admin-page--accounts">
  <div class="page-header">
    <div>
      <h1 class="page-title">Account Management</h1>
      <p class="page-subtitle">Super admin only — staff and admin accounts</p>
    </div>
    <button class="btn btn--brand" id="addAccountBtn">+ Add Account</button>
  </div>
  <div class="table-card">
    <table class="data-table data-table--wide">
      <thead>
        <tr>
          <th>Name</th><th>Position</th><th>Contact Number</th><th>Email</th>
          <th>Address</th><th>Username</th><th>Password</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="accountsBody"><!-- injected --></tbody>
    </table>
  </div>
</section>