<?php 
$currentPage = $currentPage ?? 'home_overview'; 
$adminRole = $_SESSION['admin_role'] ?? 'Staff';
$adminName = $_SESSION['admin_name'] ?? 'Admin';
?>
<aside class="sidebar">
  <div class="sidebar__brand">
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <div class="sidebar__logo">AN</div>
      <div>
        <p class="sidebar__brand-title">Astrid Nails</p>
        <p class="sidebar__brand-sub"><?php echo htmlspecialchars($adminName); ?> (<?php echo htmlspecialchars($adminRole); ?>)</p>
      </div>
    </div>
    <button class="sidebar__toggle" id="sidebarToggle" aria-label="Toggle Navigation">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>

  <nav class="sidebar__nav">
    <a href="admin_dashboard.php?page=home_overview" class="sidebar__item<?php echo $currentPage === 'home_overview' ? ' is-active' : ''; ?>">🏠 Home</a>
    <a href="admin_dashboard.php?page=services_gallery" class="sidebar__item<?php echo $currentPage === 'services_gallery' ? ' is-active' : ''; ?>">🖼️ Services Gallery</a>
    <a href="admin_dashboard.php?page=appointment_history" class="sidebar__item<?php echo $currentPage === 'appointment_history' ? ' is-active' : ''; ?>">🕓 Appointment History</a>
    <a href="admin_dashboard.php?page=appointment_list" class="sidebar__item<?php echo $currentPage === 'appointment_list' ? ' is-active' : ''; ?>">✅ Appointment List</a>
    <a href="admin_dashboard.php?page=faq_management" class="sidebar__item<?php echo $currentPage === 'faq_management' ? ' is-active' : ''; ?>">❓ FAQ</a>
    <a href="admin_dashboard.php?page=about_editor" class="sidebar__item<?php echo $currentPage === 'about_editor' ? ' is-active' : ''; ?>">ℹ️ About</a>
    <?php if ($adminRole === 'Super Admin'): ?>
    <a href="admin_dashboard.php?page=account_management" class="sidebar__item<?php echo $currentPage === 'account_management' ? ' is-active' : ''; ?>">👥 Account Management</a>
    <?php endif; ?>
    <a href="includes/admin-auth/logout.php" class="sidebar__item sidebar__item--logout">🚪 Logout</a>
  </nav>
</aside>