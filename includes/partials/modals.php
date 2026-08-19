  <!-- ===== Auth Modal ===== -->
  <div class="overlay" id="authOverlay" hidden>
    <button class="overlay__close" id="authClose" aria-label="Close">✕</button>
    <div class="overlay__inner">
      <div class="overlay__collage">
        <div class="overlay__collage-logo">AN</div>
        <div class="overlay__collage-grid">
          <div class="overlay__collage-tile overlay__collage-tile--wide">Salon interior</div>
          <div class="overlay__collage-tile">Nail art</div>
          <div class="overlay__collage-tile overlay__collage-tile--full">Gel polish</div>
        </div>
      </div>

      <div class="overlay__form-wrap">
        <!-- Login view -->
        <div class="auth-card" id="loginView">
          <div class="auth-card__logo">AN</div>
          <h2 class="auth-card__title">Customer Login</h2>
          <div class="auth-card__fields">
            <label class="field">
              <span class="field__label">Email address</span>
              <input type="email" id="loginEmail" placeholder="astrid@astrid.com" />
            </label>
            <label class="field">
              <span class="field__label">Password</span>
              <input type="password" id="loginPassword" placeholder="••••••••" />
            </label>
          </div>
          <p class="field__error" id="loginError" style="color:var(--brand-pink);font-size:0.8rem;margin-top:0.25rem;margin-bottom:1rem;display:none;"></p>
          <button class="btn btn--brand btn--block" id="loginSubmit">Log in</button>
          <p class="auth-card__note" style="text-align: center; margin-top: 1.25rem; margin-bottom: 0.5rem;">
            Don't have an account? 
            <button class="link-btn" data-view="register" style="display: inline; font-family: inherit; color: var(--brand-purple); font-weight: 600;">Register</button>
          </p>
          <p class="auth-card__note" style="text-align: center; margin-top: 0.75rem; border-top: 1px dashed var(--border, #eee); padding-top: 0.75rem;">
            Are you a salon staff member? 
            <button class="link-btn" data-view="admin-login" style="display: inline; font-family: inherit; color: var(--brand-purple); font-weight: 600;">🔐 Sign in as Staff / Admin</button>
          </p>
          <button class="link-btn" id="authBackHome1" style="font-family: inherit; width: 100%; justify-content: center; margin-top: 1rem;">← Back to Home</button>
        </div>

        <!-- Admin Login view -->
        <div class="auth-card" id="adminLoginView" hidden>
          <div class="auth-card__logo">AN</div>
          <h2 class="auth-card__title">Admin / Staff Login</h2>
          <div class="auth-card__fields">
            <label class="field">
              <span class="field__label">Username</span>
              <input type="text" id="adminLoginUsername" placeholder="e.g. astrid.admin" />
            </label>
            <label class="field">
              <span class="field__label">Password</span>
              <input type="password" id="adminLoginPassword" placeholder="••••••••" />
            </label>
          </div>
          <p class="field__error" id="adminLoginError" style="color:var(--brand-pink);font-size:0.8rem;margin-top:0.25rem;margin-bottom:1rem;display:none;"></p>
          <button class="btn btn--brand btn--block" id="adminLoginSubmit">Log in as Staff</button>
          
          <p class="auth-card__note" style="text-align: center; margin-top: 1.5rem; margin-bottom: 0.5rem;">
            Not a staff member? 
            <button class="link-btn" data-view="login" style="display: inline; font-family: inherit; color: var(--brand-purple); font-weight: 600;">← Back to Customer Login</button>
          </p>
        </div>

        <!-- Register view -->
        <div class="auth-card" id="registerView" hidden>
          <div class="auth-card__logo">AN</div>
          <h2 class="auth-card__title">Create an Account</h2>
          <div class="auth-card__fields">
            <div class="field-row">
              <label class="field">
                <span class="field__label">First Name</span>
                <input type="text" id="regFirstName" placeholder="Juan" />
              </label>
              <label class="field">
                <span class="field__label">Last Name</span>
                <input type="text" id="regLastName" placeholder="Dela Cruz" />
              </label>
            </div>
            <label class="field">
              <span class="field__label">Email address</span>
              <input type="email" id="regEmail" placeholder="astrid@astrid.com" />
            </label>
            <label class="field">
              <span class="field__label">Phone Number</span>
              <input type="tel" id="regPhone" placeholder="0917-000-1122" />
            </label>
            <label class="field">
              <span class="field__label">Password</span>
              <input type="password" id="regPassword" placeholder="••••••••" />
            </label>
            <label class="field">
              <span class="field__label">Confirm Password</span>
              <input type="password" id="regConfirmPassword" placeholder="••••••••" />
            </label>
          </div>
          <p class="field__error" id="registerError" style="color:var(--brand-pink);font-size:0.8rem;margin-top:0.25rem;margin-bottom:1rem;display:none;"></p>
          <button class="btn btn--brand btn--block" id="registerSubmit">REGISTER</button>
          
          <p class="auth-card__or" style="margin-top: 1.5rem;">or continue with</p>
          <button class="btn btn--fb btn--block" style="margin-bottom: 1rem;">📘 Facebook</button>
          
          <p class="auth-card__note" style="text-align: center; margin-top: 1.5rem; margin-bottom: 1rem;">
            Already have an account? 
            <button class="link-btn" data-view="login" style="display: inline; font-family: inherit; color: var(--brand-purple); font-weight: 600;">Log in instead</button>
          </p>
          <button class="link-btn" id="authBackHome2" style="font-family: inherit; width: 100%; justify-content: center; margin-top: 1rem;">← Back to Home</button>
        </div>

        <!-- Verify view -->
        <div class="auth-card auth-card--center" id="verifyView" hidden>
          <div class="verify-icon">🔒</div>
          <p class="verify-copy">
            We sent a 6-digit code to your email. Enter it below to confirm your appointment booking.
          </p>
          <div class="verify-email-box">
            <p class="verify-email-label">Verification code sent to</p>
            <p class="verify-email" id="verifyEmailDisplay">maria.santos@example.com</p>
            <button class="btn btn--soft" data-view="register">Change Email</button>
          </div>
          <div class="otp" id="otpInputs">
            <input maxlength="1" inputmode="numeric" aria-label="Digit 1" />
            <input maxlength="1" inputmode="numeric" aria-label="Digit 2" />
            <input maxlength="1" inputmode="numeric" aria-label="Digit 3" />
            <input maxlength="1" inputmode="numeric" aria-label="Digit 4" />
            <input maxlength="1" inputmode="numeric" aria-label="Digit 5" />
            <input maxlength="1" inputmode="numeric" aria-label="Digit 6" />
          </div>
          <p class="verify-spam">Check your spam folder if you can't find the email</p>
          <p class="verify-timer" id="verifyTimer">4:58</p>
          <button class="btn btn--brand btn--block" id="verifySubmit">Verify Code</button>
          <p class="verify-resend-copy">Didn't receive your code?</p>
          <button class="btn btn--soft btn--block" id="resendBtn">Resend Email</button>
          <p class="verify-disclaimer">
            This verification helps us prevent fraudulent bookings and protect your appointment slot.
            Never share your code with anyone.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Booking Modal ===== -->
  <div class="booking-overlay" id="bookingOverlay" hidden>
    <div class="booking-modal">
      <button class="overlay__close overlay__close--dark" id="bookingClose" aria-label="Close booking">✕</button>
      <h2 class="booking-modal__title">Book an Appointment</h2>
      <p class="booking-modal__subtitle">Follow the steps below to schedule your visit</p>

      <div class="stepper" id="stepper">
        <div class="stepper__step" data-step="1"><span class="stepper__circle">1</span></div>
        <span class="stepper__arrow">→</span>
        <div class="stepper__step" data-step="2"><span class="stepper__circle">2</span></div>
        <span class="stepper__arrow">→</span>
        <div class="stepper__step" data-step="3"><span class="stepper__circle">3</span></div>
      </div>

      <!-- Step 1 -->
      <div class="booking-step" id="bookingStep1">
        <p class="booking-step__title">Step 1: Select a Service</p>
        <div class="booking-step__services" id="bookingServiceGrid"><!-- injected --></div>
        <div class="booking-step__actions">
          <button class="link-btn" id="bookingBackClose">← Back</button>
          <button class="btn btn--brand" id="toStep2" disabled>Next →</button>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="booking-step" id="bookingStep2" hidden>
        <p class="booking-step__title">Step 2: Choose Date &amp; Time</p>
        <label class="field">
          <span class="field__label">📅 Preferred Date</span>
          <input type="text" id="bookingDate" class="flatpickr-input" placeholder="Select your preferred date..." style="padding: 0.65rem 0.85rem; border: 1px solid var(--border, #e2e8f0); border-radius: 10px; width: 100%; font-family: inherit; font-size: 0.9rem; background: #fff; cursor: pointer;" />
        </label>
        <p class="field__label" style="margin-top:1.25rem;">🕐 Preferred Time</p>
        <div class="time-grid" id="timeGrid"><!-- injected --></div>
        <div class="booking-step__actions">
          <button class="link-btn" id="toStep1">← Back</button>
          <button class="btn btn--brand" id="toStep3" disabled>Next →</button>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="booking-step" id="bookingStep3" hidden>
        <p class="booking-step__title">Step 3: Confirm Your Booking</p>

        <section class="summary-box">
          <h3 class="summary-box__title">Booked Services</h3>
          <ul class="summary-box__list" id="summaryServices"><!-- injected --></ul>
        </section>

        <section class="summary-box">
          <h3 class="summary-box__title">Appointment Details</h3>
          <dl class="summary-dl" id="summaryDetails"><!-- injected --></dl>
        </section>

        <section class="summary-box">
          <h3 class="summary-box__title">Customer Information</h3>
          <dl class="summary-dl" id="summaryCustomerInfo"><!-- injected --></dl>
        </section>

        <div class="booking-step__actions">
          <button class="link-btn" id="toStep2b">← Back</button>
          <button class="btn btn--brand" id="confirmBooking">Confirm Booking</button>
        </div>
      </div>

      <!-- Step 4: Success / Confirmation View -->
      <div class="booking-step" id="bookingStep4" hidden style="text-align: center; padding: 0.5rem 0;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
        <h3 style="font-size: 1.5rem; font-weight: 800; color: var(--foreground, #1a1a1a); margin-bottom: 0.25rem;">Booking Confirmed!</h3>
        <p style="font-size: 0.875rem; color: var(--muted-foreground, #666); margin-bottom: 1.25rem;">Thank you! Your appointment has been successfully scheduled.</p>

        <div style="background: rgba(107, 33, 168, 0.06); border: 2px dashed var(--brand-purple, #6b21a8); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.25rem;">
          <p style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 0.35rem;">Your Booking Reference ID</p>
          <p id="successBookingRef" style="font-size: 1.4rem; font-weight: 800; color: var(--brand-purple, #6b21a8); letter-spacing: 0.5px;"></p>
        </div>

        <section class="summary-box" style="text-align: left; margin-bottom: 1.5rem;">
          <h3 class="summary-box__title">Appointment Summary</h3>
          <dl class="summary-dl" id="successSummaryDetails"><!-- injected --></dl>
        </section>

        <button class="btn btn--brand btn--block" id="bookingSuccessDone" style="padding: 0.75rem;">Done &amp; Close</button>
      </div>
    </div>
  </div>

  <!-- ===== Rate Us Modal ===== -->
  <div class="booking-overlay" id="rateOverlay" hidden style="align-items: center; justify-content: center; background: rgba(28, 27, 41, 0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
    <div class="auth-card" style="max-width: 460px; width: min(92vw, 460px); margin: 2rem auto; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
      <button class="overlay__close overlay__close--dark" id="rateClose" aria-label="Close modal" style="position: absolute; top: 1rem; right: 1rem;">✕</button>
      <div class="auth-card__logo" style="display: flex; align-items: center; justify-content: center; font-size: 2rem;">⭐</div>
      <h2 class="auth-card__title">Rate Your Visit</h2>
      <p style="font-size: 0.875rem; color: var(--muted-foreground, #666); text-align: center; margin-bottom: 1.25rem;">
        Share your feedback to help us serve you better!
      </p>

      <form id="rateForm">
        <div class="auth-card__fields">
          <label class="field">
            <span class="field__label">Select Visit to Rate</span>
            <select id="rateAppointmentSelect" class="select" style="width: 100%; padding: 0.65rem; border-radius: 8px; border: 1px solid var(--border, #ccc); font-family: inherit; font-size: 0.875rem;" required>
              <!-- injected via ratable.php -->
            </select>
          </label>

          <div class="field" style="text-align: center;">
            <span class="field__label" style="margin-bottom: 0.5rem; display: block;">Your Rating</span>
            <div id="starRatingInput" style="display: flex; justify-content: center; gap: 0.5rem; font-size: 1.75rem; cursor: pointer; user-select: none;">
              <span data-star="1" style="color: #fbbf24; transition: color 0.2s;">★</span>
              <span data-star="2" style="color: #fbbf24; transition: color 0.2s;">★</span>
              <span data-star="3" style="color: #fbbf24; transition: color 0.2s;">★</span>
              <span data-star="4" style="color: #fbbf24; transition: color 0.2s;">★</span>
              <span data-star="5" style="color: #fbbf24; transition: color 0.2s;">★</span>
            </div>
            <input type="hidden" id="rateRatingVal" value="5" />
          </div>

          <label class="field">
            <span class="field__label">Your Review (Optional)</span>
            <textarea id="rateReviewText" rows="3" placeholder="Tell us what you loved or how we can improve..." style="width: 100%; padding: 0.65rem; border-radius: 8px; border: 1px solid var(--border, #ccc); font-family: inherit; font-size: 0.875rem; resize: vertical;"></textarea>
          </label>
        </div>

        <p class="field__error" id="rateError" style="color: var(--brand-pink, #ec4899); font-size: 0.8rem; margin-top: 0.5rem; margin-bottom: 1rem; display: none;"></p>

        <button type="submit" class="btn btn--brand btn--block" id="rateSubmitBtn" style="margin-top: 1rem; padding: 0.75rem;">Submit Rating</button>
      </form>
    </div>
  </div>

  <!-- ===== Customer Dashboard Modal ===== -->
  <div class="booking-overlay" id="customerDashboardOverlay" hidden style="display: flex; align-items: center; justify-content: center; background: rgba(28, 27, 41, 0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 1.5rem 1rem;">
    <div class="auth-card" style="max-width: 900px; width: min(96vw, 900px); max-height: 90vh; overflow-y: auto; margin: 1rem auto; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border-radius: 16px; padding: 2rem;">
      <button class="overlay__close overlay__close--dark" id="customerDashClose" aria-label="Close modal" style="position: absolute; top: 1.25rem; right: 1.25rem;">✕</button>

      <!-- Dashboard Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border, #eee); padding-bottom: 1rem; padding-right: 2.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--gradient-brand, linear-gradient(135deg, #6b21a8, #ec4899)); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;" id="custDashAvatar">
            AN
          </div>
          <div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--foreground, #1a1a1a); margin: 0;" id="custDashGreeting">Welcome Back!</h2>
            <p style="font-size: 0.85rem; color: var(--muted-foreground, #666); margin: 0;" id="custDashEmail">customer@example.com</p>
          </div>
        </div>
        <button class="btn btn--soft" id="dashLogoutBtn" style="padding: 0.45rem 1rem; font-size: 0.85rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.25); white-space: nowrap;">
          Logout 🚪
        </button>
      </div>

      <!-- Dashboard Nav Tabs -->
      <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border, #f1f5f9);" id="custDashTabs">
        <button class="btn btn--soft is-active" data-tab="overview" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">📊 Overview</button>
        <button class="btn btn--soft" data-tab="bookings" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">📅 My Appointments</button>
        <button class="btn btn--soft" data-tab="reviews" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">⭐ Ratings &amp; Reviews</button>
        <button class="btn btn--soft" data-tab="profile" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">👤 My Profile</button>
      </div>

      <!-- TAB 1: Overview -->
      <div class="cust-dash-view" id="custDashTabOverview">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card card--center" style="padding: 1.25rem;">
            <p style="font-size: 1.75rem; font-weight: 800; color: #6b21a8; margin: 0;" id="sumConfirmedCount">0</p>
            <p class="stat-label" style="margin: 0.25rem 0 0;">Upcoming Visits</p>
          </div>
          <div class="card card--center" style="padding: 1.25rem;">
            <p style="font-size: 1.75rem; font-weight: 800; color: #eab308; margin: 0;" id="sumPendingCount">0</p>
            <p class="stat-label" style="margin: 0.25rem 0 0;">Pending Requests</p>
          </div>
          <div class="card card--center" style="padding: 1.25rem;">
            <p style="font-size: 1.75rem; font-weight: 800; color: #10b981; margin: 0;" id="sumCompletedCount">0</p>
            <p class="stat-label" style="margin: 0.25rem 0 0;">Completed Visits</p>
          </div>
          <div class="card card--center" style="padding: 1.25rem;">
            <p style="font-size: 1.75rem; font-weight: 800; color: #ec4899; margin: 0;" id="sumUnreadNotifs">0</p>
            <p class="stat-label" style="margin: 0.25rem 0 0;">Unread Alerts</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--foreground); margin: 0;">Recent Appointment Activity</h3>
          <button class="btn btn--brand" id="dashBookShortcutBtn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;">+ Book New Visit</button>
        </div>
        <div id="custDashRecentActivity"><!-- injected --></div>
      </div>

      <!-- TAB 2: My Appointments -->
      <div class="cust-dash-view" id="custDashTabBookings" hidden>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--foreground); margin-bottom: 1rem;">My Appointments</h3>
        <div id="custDashBookingsList"><!-- injected --></div>
      </div>

      <!-- TAB 3: Ratings & Reviews -->
      <div class="cust-dash-view" id="custDashTabReviews" hidden>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--foreground); margin: 0;">My Ratings &amp; Reviews</h3>
          <button class="btn btn--brand" id="dashRateVisitBtn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;">⭐ Rate a Visit</button>
        </div>
        <div id="custDashReviewsList"><!-- injected --></div>
      </div>

      <!-- TAB 5: My Profile -->
      <div class="cust-dash-view" id="custDashTabProfile" hidden>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--foreground); margin-bottom: 1rem;">Account Profile</h3>
        <form id="custProfileForm" style="max-width: 500px;">
          <div class="auth-card__fields">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <label class="field">
                <span class="field__label">First Name</span>
                <input type="text" id="custProfFirstName" required style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #ccc);" />
              </label>
              <label class="field">
                <span class="field__label">Last Name</span>
                <input type="text" id="custProfLastName" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #ccc);" />
              </label>
            </div>
            <label class="field">
              <span class="field__label">Email Address (Read-only)</span>
              <input type="email" id="custProfEmail" readonly disabled style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #ccc); background: #f3f4f6; color: #6b7280;" />
            </label>
            <label class="field">
              <span class="field__label">Phone Number</span>
              <input type="tel" id="custProfPhone" required style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #ccc);" />
            </label>
            <label class="field">
              <span class="field__label">New Password (Leave blank to keep current)</span>
              <input type="password" id="custProfNewPassword" placeholder="Minimum 8 characters" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #ccc);" />
            </label>
          </div>

          <p class="field__error" id="custProfError" style="color: var(--brand-pink, #ec4899); font-size: 0.8rem; margin-top: 0.5rem; display: none;"></p>
          <button type="submit" class="btn btn--brand" id="custProfSaveBtn" style="margin-top: 1rem; padding: 0.65rem 1.5rem;">Save Changes</button>
        </form>
      </div>

    </div>
  </div>