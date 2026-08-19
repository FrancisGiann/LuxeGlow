<?php
$isSuperAdmin = ($_SESSION['admin_role'] ?? '') === 'Super Admin';
?>
<section class="admin-page admin-page--home">
  <div class="page-header">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Today at Astrid Nails &amp; Beauty Bar</p>
    </div>
  </div>

  <div class="stat-grid">
    <div class="card"><p class="stat-value" id="statTodaysBookings">0</p><p class="stat-label">Today's bookings</p></div>
    <div class="card"><p class="stat-value" id="statPendingApprovals">0</p><p class="stat-label">Pending approvals</p></div>
    <?php if ($isSuperAdmin): ?>
      <div class="card"><p class="stat-value" id="statRevenueToday">₱0.00</p><p class="stat-label">Revenue today</p></div>
    <?php endif; ?>
    <div class="card"><p class="stat-value" id="statAvgRating">0.0</p><p class="stat-label">Average rating</p></div>
  </div>

  <div class="dashboard-grid">
    <div class="dashboard-grid__main">
      <h2 class="section-h2">Recent Bookings</h2>
      <div class="stack" id="recentBookings"><!-- injected --></div>
    </div>
    <div>
      <h2 class="section-h2">Popular Services</h2>
      <div class="stack" id="popularServices"><!-- injected --></div>
    </div>
  </div>
</section>