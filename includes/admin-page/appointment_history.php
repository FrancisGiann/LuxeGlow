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