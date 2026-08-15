<?php
$currentPage = $_GET['page'] ?? 'home_overview';

$adminPages = [
  'home_overview' => __DIR__ . '/includes/admin-page/home_overview.php',
  'services_gallery' => __DIR__ . '/includes/admin-page/services_gallery.php',
  'appointment_history' => __DIR__ . '/includes/admin-page/appointment_history.php',
  'appointment_list' => __DIR__ . '/includes/admin-page/appointment_list.php',
  'faq_management' => __DIR__ . '/includes/admin-page/faq_management.php',
  'about_editor' => __DIR__ . '/includes/admin-page/about_editor.php',
  'account_management' => __DIR__ . '/includes/admin-page/account_management.php',
];

if (!array_key_exists($currentPage, $adminPages)) {
  $currentPage = 'home_overview';
}

$pageFile = $adminPages[$currentPage];
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Dashboard — Astrid Nails &amp; Beauty Bar</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/admin-page/admin-style.css" />
</head>
<body>
  <div class="admin-layout">
    <?php include 'includes/partials/admin_sidebar.php'; ?>

    <main class="admin-main">
      <?php include $pageFile; ?>
    </main>
  </div>

  <dialog id="globalConfirmModal" style="padding: 2rem; border-radius: 8px; border: 1px solid #ddd; max-width: 400px; width: 100%;">
    <h2 id="confirmModalTitle" style="margin-bottom: 1rem;">Confirm Action</h2>
    <p id="confirmModalMessage" style="margin-bottom: 1.5rem; font-size: 0.95rem; color: #555;"></p>
    <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
      <button class="btn btn--soft" id="confirmModalCancel">Cancel</button>
      <button class="btn btn--brand" id="confirmModalOk" style="background: var(--brand-pink);">Confirm</button>
    </div>
  </dialog>

  <div class="toast" id="toast"></div>

  <script>
    window.ADMIN_CURRENT_PAGE = <?php echo json_encode($currentPage); ?>;
  </script>
  <script src="assets/js/admin-page/admin.js?v=<?php echo time(); ?>"></script>
</body>
</html>