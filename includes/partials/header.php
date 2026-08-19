<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Astrid Nails &amp; Beauty Bar — Book Nails, Lashes &amp; Spa</title>
  <meta name="description" content="Astrid Nails & Beauty Bar: premium nail care, gel polish, extensions, lashes and spa treatments. Book your appointment online in three steps." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
  <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
  <link rel="stylesheet" href="assets/css/style.css?v=<?php echo time(); ?>" />
</head>
<body>

  <!-- ===== Navbar ===== -->
  <header class="navbar" id="navbar">
    <nav class="navbar__inner">
      <a href="index.php#home" class="navbar__brand">
        <span class="navbar__logo">AN</span>
        <span class="navbar__brand-text">
          <span class="navbar__brand-title">Astrid Nails</span>
          <span class="navbar__brand-sub">&amp; Beauty Bar</span>
        </span>
      </a>

      <div class="navbar__links" id="navLinks">
        <a href="index.php#home" class="navbar__link">Home</a>
        <a href="index.php#services" class="navbar__link">Services</a>
        <a href="index.php#reviews" class="navbar__link">Reviews</a>
        <a href="index.php#about" class="navbar__link">About</a>
        <a href="index.php#faqs" class="navbar__link">FAQs</a>
      </div>

      <div class="navbar__actions">
        <!-- Notification Bell Icon (Outside) -->
        <div class="notif-dropdown-wrap" id="notifWrap" style="position: relative; display: none;">
          <button class="btn btn--soft" id="notifBellBtn" aria-label="Notifications" style="padding: 0.6rem 0.85rem; position: relative;">
            🔔 <span id="headerNotifBadge" style="display:none; position: absolute; top: -4px; right: -4px; background: var(--brand-pink, #ec4899); color: #fff; border-radius: 10px; padding: 2px 6px; font-size: 0.65rem; font-weight: 800; border: 2px solid #fff;">0</span>
          </button>

          <!-- Dropdown Popover -->
          <div class="notif-dropdown-pop" id="notifDropdownPop" hidden style="position: absolute; top: calc(100% + 0.5rem); right: 0; width: 320px; background: var(--card, #fff); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid var(--border, #eee); z-index: 100; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border, #eee); padding-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.9rem; color: var(--foreground);">Notifications</span>
              <button class="link-btn" id="headerMarkAllNotifsRead" style="font-size: 0.75rem;">Mark All Read</button>
            </div>
            <div id="headerNotifList" style="max-height: 280px; overflow-y: auto;">
              <!-- injected via index.js -->
            </div>
          </div>
        </div>

        <!-- Single User Profile Button (Opens Dashboard) -->
        <button class="btn btn--soft" id="userDashboardBtn" style="display:none;">👤 Hi, Customer</button>
        <button class="btn btn--soft" id="loginBtn">Login / Register</button>
        <button class="btn btn--brand" id="bookNavBtn">Book Now</button>
      </div>

      <button class="navbar__toggle" id="navToggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </nav>

    <div class="navbar__mobile" id="navMobile">
      <a href="index.php#home" class="navbar__link">Home</a>
      <a href="index.php#services" class="navbar__link">Services</a>
      <a href="index.php#reviews" class="navbar__link">Reviews</a>
      <a href="index.php#about" class="navbar__link">About</a>
      <a href="index.php#faqs" class="navbar__link">FAQs</a>
      <button class="btn btn--soft" id="userDashboardBtnMobile" style="display:none;">👤 My Dashboard</button>
      <button class="btn btn--soft" id="loginBtnMobile">Login / Register</button>
      <button class="btn btn--brand" id="bookNavBtnMobile">Book Now</button>
    </div>
  </header>