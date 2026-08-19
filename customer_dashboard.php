<?php
// customer_dashboard.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Redirect unauthenticated visitors to login modal on homepage
if (!isset($_SESSION['customer_id'])) {
    header('Location: index.php?openAuth=login');
    exit;
}

require_once __DIR__ . '/config/database.php';

// Fetch REAL customer data from database on initial page load (Zero placeholder text!)
$customerId = (int)$_SESSION['customer_id'];
$custStmt = $pdo->prepare("SELECT first_name, last_name, email, phone, created_at FROM customers WHERE customer_id = ?");
$custStmt->execute([$customerId]);
$customerData = $custStmt->fetch(PDO::FETCH_ASSOC);

if (!$customerData) {
    header('Location: index.php?openAuth=login');
    exit;
}

$custFirstName = htmlspecialchars($customerData['first_name'] ?? 'Client');
$custLastName  = htmlspecialchars($customerData['last_name'] ?? '');
$custFullName  = trim($custFirstName . ' ' . $custLastName);
$custEmail     = htmlspecialchars($customerData['email'] ?? '');
$custPhone     = htmlspecialchars($customerData['phone'] ?? '');
$custInitials  = strtoupper(substr($custFirstName, 0, 1) . ($custLastName ? substr($custLastName, 0, 1) : ''));

$pageTitle = "Customer Portal | LuxeGlow Beauty Bar";
require_once __DIR__ . '/includes/partials/header.php';
?>

<div class="dash-layout-wrapper" style="display: flex; min-height: calc(100vh - 80px); background: #faf8f5;">

  <!-- LEFT SIDEBAR (LuxeGlow Brand Purple #6b21a8) -->
  <aside class="dash-sidebar" style="width: 280px; flex-shrink: 0; background: #6b21a8; color: #ffffff; padding: 2.5rem 1.25rem 3rem; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
    
    <div>
      <!-- Profile Header -->
      <div style="text-align: center; margin-bottom: 2rem;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: #fef3c7; color: #6b21a8; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; margin: 0 auto 0.85rem; box-shadow: 0 6px 16px rgba(0,0,0,0.2);" id="custDashAvatarPage">
          <?= $custInitials ?>
        </div>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; margin: 0 0 0.2rem;" id="custDashGreetingPage">
          <?= $custFullName ?>
        </h2>
        <p style="font-size: 0.825rem; color: #fbcfe8; margin: 0 0 0.35rem; word-break: break-all; opacity: 0.9;" id="custDashEmailPage">
          <?= $custEmail ?>
        </p>
        <p style="font-size: 0.75rem; color: #fef08a; font-weight: 700; margin: 0; opacity: 0.95;" id="custDashJoinedPage">
          Member since <?= date('M Y', strtotime($customerData['created_at'])) ?>
        </p>
      </div>

      <!-- Navigation Menu -->
      <nav style="display: flex; flex-direction: column; gap: 0.4rem;" id="custDashNavList">
        
        <button class="sidebar-nav-item is-active" data-tab="overview" onclick="window.switchDashTab('overview')">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
          <span>Overview</span>
        </button>

        <button class="sidebar-nav-item" data-tab="bookings" onclick="window.switchDashTab('bookings')">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          <span>My Appointments</span>
        </button>

        <button class="sidebar-nav-item" data-tab="notifications" onclick="window.switchDashTab('notifications')">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <span style="display: flex; align-items: center; gap: 0.65rem;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <span>Notifications</span>
            </span>
            <span id="custDashNotifBadgePage" style="display:none; background: #ec4899; color: #ffffff; font-size: 0.7rem; font-weight: 800; border-radius: 50%; padding: 2px 7px;">0</span>
          </div>
        </button>

        <button class="sidebar-nav-item" data-tab="reviews" onclick="window.switchDashTab('reviews')">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
          <span>Ratings &amp; Reviews</span>
        </button>

        <button class="sidebar-nav-item" data-tab="profile" onclick="window.switchDashTab('profile')">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span>My Profile</span>
        </button>

        <button class="sidebar-nav-item" id="dashPageLogoutBtn" style="margin-top: 1rem; color: #fecdd3;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          <span>Logout</span>
        </button>

      </nav>
    </div>

    <!-- Bottom Help Box -->
    <div style="background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(8px); border-radius: 16px; padding: 1.25rem; text-align: center; border: 1px solid rgba(255,255,255,0.15); margin-top: 2rem;">
      <h4 style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin: 0 0 0.25rem;">Need help?</h4>
      <p style="font-size: 0.8rem; color: #fbcfe8; margin: 0 0 0.85rem;">We're here for you!</p>
      <a href="index.php#faqs" class="btn" style="display: block; width: 100%; background: rgba(0,0,0,0.25); color: #ffffff; font-size: 0.8rem; font-weight: 700; border-radius: 10px; padding: 0.5rem; text-align: center;">Contact Us</a>
    </div>

  </aside>

  <!-- RIGHT MAIN CONTENT AREA -->
  <main class="dash-main-content" style="flex: 1; padding: 2.5rem 2rem 4rem; overflow-x: hidden;">
    
    <!-- Welcome Header -->
    <div style="margin-bottom: 2rem;">
      <h1 style="font-size: 2rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.35rem; font-family: Playfair Display, Georgia, serif;">
        Welcome back, <span id="welcomeFnameBanner"><?= $custFirstName ?></span>! 👋
      </h1>
      <p style="font-size: 0.95rem; color: #64748b; margin: 0;">
        Here's what's happening with your visits.
      </p>
    </div>

    <!-- 1. OVERVIEW TAB -->
    <div class="dash-page-sec" id="dashPageSecOverview">

      <!-- 4 Summary Metric Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
        
        <div class="summary-card" onclick="window.switchDashTab('bookings')">
          <div class="summary-card__icon" style="background: #f3e8ff; color: #6b21a8;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <div>
            <span class="summary-card__num" id="sumPageConfirmed">0</span>
            <p class="summary-card__label">Upcoming Appointment</p>
            <span class="summary-card__link" style="color: #6b21a8;">View details &rarr;</span>
          </div>
        </div>

        <div class="summary-card" onclick="window.switchDashTab('bookings')">
          <div class="summary-card__icon" style="background: #fef3c7; color: #d97706;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <span class="summary-card__num" id="sumPagePending">0</span>
            <p class="summary-card__label">Pending Requests</p>
            <span class="summary-card__link" style="color: #d97706;">View details &rarr;</span>
          </div>
        </div>

        <div class="summary-card" onclick="window.switchDashTab('bookings')">
          <div class="summary-card__icon" style="background: #d1fae5; color: #059669;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <span class="summary-card__num" id="sumPageCompleted">0</span>
            <p class="summary-card__label">Completed Visits</p>
            <span class="summary-card__link" style="color: #059669;">View details &rarr;</span>
          </div>
        </div>

        <div class="summary-card" onclick="window.switchDashTab('notifications')">
          <div class="summary-card__icon" style="background: #ffe4e6; color: #e11d48;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          </div>
          <div>
            <span class="summary-card__num" id="sumPageUnread">0</span>
            <p class="summary-card__label">Unread Notifications</p>
            <span class="summary-card__link" style="color: #e11d48;">View all &rarr;</span>
          </div>
        </div>

      </div>

      <!-- MIDDLE ROW: UPCOMING APPOINTMENT & RECENT NOTIFICATIONS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        
        <!-- Upcoming Appointment Hero Box -->
        <div class="dashboard-box" id="dashHeroUpcomingCard">
          <!-- Injected dynamically via index.js -->
        </div>

        <!-- Recent Notifications Snippet -->
        <div class="dashboard-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
            <h3 style="font-size: 1.1rem; font-weight: 800; color: #1e1b4b; margin: 0;">Recent Notifications</h3>
            <button class="link-btn" onclick="window.switchDashTab('notifications')" style="font-size: 0.825rem; font-weight: 700; color: #6b21a8;">View All &rarr;</button>
          </div>
          <div id="dashOverviewNotifSnippet"><!-- Injected --></div>
        </div>

      </div>

      <!-- BOTTOM ROW: RECENT VISITS -->
      <div class="dashboard-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: #1e1b4b; margin: 0;">Recent Visits</h3>
          <button class="link-btn" onclick="window.switchDashTab('bookings')" style="font-size: 0.825rem; font-weight: 700; color: #6b21a8;">View All &rarr;</button>
        </div>
        <div id="dashOverviewVisitsSnippet"><!-- Injected --></div>
      </div>

    </div>

    <!-- 2. MY APPOINTMENTS TAB -->
    <div class="dash-page-sec" id="dashPageSecBookings" hidden>
      <div class="dashboard-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.25rem;">My Appointments</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Manage your upcoming pampering sessions and view past appointment history.</p>
          </div>
          <button class="btn btn--brand" id="dashPageBookBtn2" onclick="openBooking()" style="padding: 0.65rem 1.25rem; font-size: 0.85rem; background: #6b21a8; color: #ffffff;">+ Book Appointment</button>
        </div>
        <div id="dashPageBookingsContainer"><!-- Injected --></div>
      </div>
    </div>

    <!-- 3. NOTIFICATIONS TAB -->
    <div class="dash-page-sec" id="dashPageSecNotifications" hidden>
      <div class="dashboard-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.25rem;">Notifications Center</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Stay updated on your appointment status, reminders, and salon alerts.</p>
          </div>
          <button class="link-btn" id="dashPageMarkAllRead" style="font-size: 0.85rem; font-weight: 700; color: #6b21a8;">✓ Mark All as Read</button>
        </div>
        <div id="dashPageNotificationsContainer"><!-- Injected --></div>
      </div>
    </div>

    <!-- 4. RATINGS & REVIEWS TAB -->
    <div class="dash-page-sec" id="dashPageSecReviews" hidden>
      <div class="dashboard-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.25rem;">Ratings &amp; Reviews</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Rate your completed appointments and view your past feedback.</p>
          </div>
          <button class="btn btn--brand" id="dashPageRateVisitBtn" onclick="openRateModal()" style="padding: 0.65rem 1.25rem; font-size: 0.85rem; background: #6b21a8; color: #ffffff;">⭐ Rate a Visit</button>
        </div>
        <div id="dashPageReviewsContainer"><!-- Injected --></div>
      </div>
    </div>

    <!-- 5. MY PROFILE TAB -->
    <div class="dash-page-sec" id="dashPageSecProfile" hidden>
      <div class="dashboard-box">
        <h2 style="font-size: 1.3rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.25rem;">My Profile &amp; Account Settings</h2>
        <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 1.75rem;">Update your personal details and account password.</p>
        
        <form id="dashPageProfileForm" style="max-width: 580px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
            <label class="field">
              <span class="field__label">First Name</span>
              <input type="text" id="dashProfFname" value="<?= $custFirstName ?>" required style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem;" />
            </label>
            <label class="field">
              <span class="field__label">Last Name</span>
              <input type="text" id="dashProfLname" value="<?= $custLastName ?>" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem;" />
            </label>
          </div>
          <label class="field" style="margin-bottom: 1.25rem; display: block;">
            <span class="field__label">Email Address (Read-only)</span>
            <input type="email" id="dashProfEmail" value="<?= $custEmail ?>" readonly disabled style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font-family: inherit; font-size: 0.9rem;" />
          </label>
          <label class="field" style="margin-bottom: 1.25rem; display: block;">
            <span class="field__label">Phone Number</span>
            <input type="tel" id="dashProfPhone" value="<?= $custPhone ?>" required style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem;" />
          </label>
          <label class="field" style="margin-bottom: 1.5rem; display: block;">
            <span class="field__label">New Password (Leave blank to keep current)</span>
            <input type="password" id="dashProfPassword" placeholder="Minimum 8 characters" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem;" />
          </label>

          <p class="field__error" id="dashProfError" style="color: #ec4899; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></p>
          <button type="submit" class="btn btn--brand" id="dashProfSaveBtn" style="padding: 0.85rem 2rem; font-size: 0.9rem; font-weight: 700; border-radius: 12px; background: #6b21a8; color: #ffffff;">Save Profile Changes</button>
        </form>
      </div>
    </div>

  </main>
</div>

<style>
/* Sidebar Items */
.sidebar-nav-item {
  background: transparent;
  color: #fbcfe8;
  border: none;
  border-radius: 12px;
  padding: 0.85rem 1.15rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  transition: all 0.2s ease;
  font-family: inherit;
  text-align: left;
}
.sidebar-nav-item:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.sidebar-nav-item.is-active {
  background: #ffffff !important;
  color: #6b21a8 !important;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}

/* Dashboard Boxes */
.dashboard-box {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid rgba(229, 231, 235, 0.8);
  box-shadow: 0 10px 30px rgba(0,0,0,0.03);
  padding: 1.75rem;
}

/* Summary Cards */
.summary-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(229, 231, 235, 0.8);
  box-shadow: 0 8px 25px rgba(0,0,0,0.03);
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(107, 33, 168, 0.08);
  border-color: #fbcfe8;
}
.summary-card__icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.summary-card__num {
  font-size: 1.85rem;
  font-weight: 800;
  color: #1e1b4b;
  line-height: 1;
  display: block;
}
.summary-card__label {
  font-size: 0.825rem;
  font-weight: 700;
  color: #475569;
  margin: 0.35rem 0 0.2rem;
}
.summary-card__link {
  font-size: 0.75rem;
  font-weight: 700;
}

@media (max-width: 860px) {
  .dash-layout-wrapper {
    flex-direction: column !important;
  }
  .dash-sidebar {
    width: 100% !important;
  }
}
</style>

<script>
// Inline tab switcher function defined immediately so tab clicks ALWAYS work!
window.switchDashTab = function(tabName) {
  var tabBtns = document.querySelectorAll('#custDashNavList [data-tab]');
  tabBtns.forEach(function(btn) {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });

  var views = {
    overview: document.getElementById('dashPageSecOverview'),
    bookings: document.getElementById('dashPageSecBookings'),
    notifications: document.getElementById('dashPageSecNotifications'),
    reviews: document.getElementById('dashPageSecReviews'),
    profile: document.getElementById('dashPageSecProfile')
  };

  Object.keys(views).forEach(function(key) {
    if (views[key]) {
      views[key].hidden = (key !== tabName);
    }
  });

  if (window.location.pathname.includes('customer_dashboard.php') && window.history && window.history.replaceState) {
    window.history.replaceState(null, '', 'customer_dashboard.php?tab=' + tabName);
  }
};
</script>

<?php 
require_once __DIR__ . '/includes/partials/modals.php';
require_once __DIR__ . '/includes/partials/footer.php';
?>
