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
          <button class="btn btn--blue btn--block" data-view="register">REGISTER</button>
          <button class="link-btn" id="authBackHome1">← Back to Home</button>
        </div>

        <!-- Register view -->
        <div class="auth-card" id="registerView" hidden>
          <div class="auth-card__logo">AN</div>
          <h2 class="auth-card__title">Register Login</h2>
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
          <p class="auth-card__or">or continue with</p>
          <button class="btn btn--fb btn--block">📘 Facebook</button>
          <p class="auth-card__note">Already have an account?</p>
          <button class="btn btn--brand btn--block" data-view="login">Log in</button>
          <button class="btn btn--blue btn--block" id="registerSubmit">REGISTER</button>
          <button class="link-btn" id="authBackHome2">← Back to Home</button>
        </div>

        <!-- Verify view -->
        <div class="auth-card auth-card--center" id="verifyView" hidden>
          <div class="verify-icon">🔒</div>
          <p class="verify-copy">
            We sent a 6-digit code to your email. Enter it below to confirm your appointment booking.
          </p>
          <div class="verify-email-box">
            <p class="verify-email-label">Verification code sent to</p>
            <p class="verify-email">maria.santos@example.com</p>
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
          <input type="date" id="bookingDate" />
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
          <dl class="summary-dl">
            <div><dt>Name</dt><dd>Maria Santos</dd></div>
            <div><dt>Email</dt><dd>maria.santos@example.com</dd></div>
            <div><dt>Phone</dt><dd>0917 221 4488</dd></div>
          </dl>
        </section>

        <div class="booking-step__actions">
          <button class="link-btn" id="toStep2b">← Back</button>
          <button class="btn btn--brand" id="confirmBooking">Confirm Booking</button>
        </div>
      </div>
    </div>
  </div>