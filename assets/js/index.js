/* ===========================================================
   Astrid Nails & Beauty Bar — Customer Script
   Mirrors src/data/salon.ts so it's easy to swap for a
   PHP/MySQL fetch later.
   =========================================================== */

/* ---------- Mock data (would come from MySQL later) ---------- */
let SERVICES = [];
let isServicesLoaded = false;

async function fetchServices() {
  const grid = document.getElementById("servicesGrid");
  if (grid) grid.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--muted-foreground); grid-column: 1 / -1;">Loading services...</p>';
  try {
    const res = await fetch('includes/services/list.php');
    SERVICES = await res.json();
    isServicesLoaded = true;
    renderServices();
  } catch (err) {
    console.error("Failed to fetch services", err);
    if (grid) grid.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--brand-pink); grid-column: 1 / -1;">Failed to load services. Please try again later.</p>';
  }
}

const TIME_SLOTS = [
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
];

let publicReviews = [];
let publicStats = { total_reviews: 0, average_rating: 0 };

async function fetchReviewsPublic() {
  try {
    const res = await fetch("includes/reviews/list.php");
    const data = await res.json();
    if (data.success) {
      publicReviews = data.reviews || [];
      publicStats = data.stats || { total_reviews: 0, average_rating: 0 };
      renderReviews();
    }
  } catch (err) {
    console.error("Failed to fetch public reviews", err);
  }
}

let FAQS = [];

async function fetchFaqsPublic() {
  try {
    const res = await fetch("includes/faqs/list.php");
    FAQS = await res.json();
    if (document.getElementById("faqsList")) renderFaqs();
  } catch (err) {
    console.error("Failed to fetch FAQs", err);
  }
}

const peso = (value) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hour${h > 1 ? "s" : ""} ${m} minutes`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} minutes`;
}

function starsHtml(rating, size = "1rem") {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span style="font-size:${size}" class="${i <= Math.round(rating) ? "" : "stars__off"}">★</span>`;
  }
  return html;
}

/* ---------- Render: Services ---------- */
function renderServices() {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;
  grid.innerHTML = SERVICES.map((s) => `
    <article class="service-card">
      <div class="service-card__banner" style="${s.image_path ? `background-image: url('${s.image_path}'); background-size: cover; background-position: center;` : ''}"></div>
      <div class="service-card__body">
        <div>
          <h3 class="service-card__name">${s.name}</h3>
          <p class="service-card__desc">${s.description}</p>
        </div>
        <div class="stars">${starsHtml(s.rating, "0.85rem")}</div>
        <div class="service-card__footer">
          <span class="service-card__price">₱${s.price}</span>
          <span class="service-card__time">🕐 ${s.duration}</span>
        </div>
        <button class="btn btn--brand" style="width:100%" data-book="${s.id}">Book This Service</button>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll("[data-book]").forEach((btn) => {
    btn.addEventListener("click", () => openBooking(btn.dataset.book));
  });
}

/* ---------- Render: Reviews ---------- */
function renderReviews() {
  const avg = publicStats.average_rating || 0;
  const count = publicStats.total_reviews || 0;

  const roundedRating = Math.round(avg);
  const heroStarsEl = document.getElementById("heroStars");
  if (heroStarsEl) {
    heroStarsEl.innerHTML = starsHtml(roundedRating > 0 ? roundedRating : 5, "1.4rem");
  }

  const avgNumEl = document.getElementById("avgRatingNum");
  if (avgNumEl) avgNumEl.textContent = avg > 0 ? avg.toFixed(1) : "0.0";

  const totalNumEl = document.getElementById("totalReviewsNum");
  if (totalNumEl) totalNumEl.textContent = count;

  const grid = document.getElementById("reviewsGrid");
  if (!grid) return;

  if (publicReviews.length === 0) {
    grid.innerHTML = `
      <div class="card card--center" style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center;">
        <p style="font-size: 1.15rem; font-weight: 700; color: var(--foreground); margin-bottom: 0.5rem;">No reviews yet</p>
        <p class="muted" style="font-size: 0.875rem;">Be the first to share your experience with Astrid Nails &amp; Beauty Bar!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = publicReviews.map((r) => {
    const initials = r.customer_name ? r.customer_name.substring(0, 2).toUpperCase() : "AN";
    const dateFormatted = new Date(r.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    return `
      <article class="card review-card">
        <div class="review-card__head">
          <span class="review-card__avatar">${initials}</span>
          <div>
            <p class="review-card__name">${r.customer_name}</p>
            <p class="review-card__date">${dateFormatted} · <span class="muted">${r.service_names}</span></p>
          </div>
        </div>
        <div class="review-card__stars">${starsHtml(r.rating, "0.85rem")}</div>
        <p class="review-card__text">${r.review_text ? r.review_text : "<em>Great experience!</em>"}</p>
      </article>
    `;
  }).join("");
}

/* ---------- Render: FAQs ---------- */
function renderFaqs() {
  const list = document.getElementById("faqsList");
  if (!list) return;

  if (FAQS.length === 0) {
    list.innerHTML = `<p class="muted" style="text-align:center; padding:1.5rem;">No FAQs available.</p>`;
    return;
  }

  list.innerHTML = FAQS.map((f, i) => `
    <div class="faq-item ${i === 0 ? "is-open" : ""}" data-index="${i}">
      <button class="faq-item__q">
        <span>${f.q}</span>
        <span class="faq-item__chevron">▾</span>
      </button>
      <div class="faq-item__a">${f.a}</div>
    </div>
  `).join("");

  list.querySelectorAll(".faq-item__q").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".faq-item").classList.toggle("is-open");
    });
  });
}

/* ---------- Render: About ---------- */
async function fetchAboutPublic() {
  const storyEl = document.getElementById("aboutStoryText");
  const missionEl = document.getElementById("aboutMissionText");
  if (!storyEl && !missionEl) return;

  try {
    const res = await fetch("includes/about/get.php");
    const data = await res.json();
    if (storyEl && data.description) {
      storyEl.textContent = data.description;
    }
    if (missionEl && data.mission_statement) {
      missionEl.textContent = data.mission_statement;
    }
  } catch (err) {
    console.error("Failed to fetch About content", err);
  }
}
/* ---------- Navbar: mobile toggle ---------- */
const navToggle = document.getElementById("navToggle");
const navMobile = document.getElementById("navMobile");
if (navToggle && navMobile) {
  navToggle.addEventListener("click", () => {
    navToggle.classList.toggle("is-open");
    navMobile.classList.toggle("is-open");
  });
  navMobile.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", () => {
      navToggle.classList.remove("is-open");
      navMobile.classList.remove("is-open");
    });
  });
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

/* ---------- Auth modal ---------- */
const authOverlay = document.getElementById("authOverlay");
const authViews = {
  login: document.getElementById("loginView"),
  "admin-login": document.getElementById("adminLoginView"),
  register: document.getElementById("registerView"),
  verify: document.getElementById("verifyView"),
};
let verifyTimerInterval;

function lockScroll() {
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  const isAuthOpen = authOverlay && !authOverlay.hidden;
  const isBookingOpen = bookingOverlay && !bookingOverlay.hidden;
  const isRateOpen = typeof rateOverlay !== "undefined" && rateOverlay && !rateOverlay.hidden && rateOverlay.style.display !== "none";
  const isDashOpen = typeof customerDashboardOverlay !== "undefined" && customerDashboardOverlay && !customerDashboardOverlay.hidden && customerDashboardOverlay.style.display !== "none";

  if (!isAuthOpen && !isBookingOpen && !isRateOpen && !isDashOpen) {
    document.body.style.overflow = "";
  }
}

function openAuth(view = "login") {
  lockScroll();
  authOverlay.hidden = false;
  showAuthView(view);
}
function closeAuth() {
  authOverlay.hidden = true;
  clearInterval(verifyTimerInterval);
  unlockScroll();
}
function showAuthView(view) {
  Object.entries(authViews).forEach(([key, el]) => { el.hidden = key !== view; });
  if (view === "verify") startVerifyTimer();
}
function startVerifyTimer() {
  clearInterval(verifyTimerInterval);
  let seconds = 298;
  const el = document.getElementById("verifyTimer");
  const tick = () => {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    el.textContent = `${m}:${s}`;
    if (seconds > 0) seconds--;
  };
  tick();
  verifyTimerInterval = setInterval(tick, 1000);
}

let currentUser = null;

async function checkSession() {
  try {
    const res = await fetch("includes/auth/session_check.php");
    const data = await res.json();
    if (data.loggedIn) {
      currentUser = data.customer;
      updateNavbarState();
    }
  } catch (err) {
    console.error("Session check failed", err);
  }
}

function updateNavbarState() {
  const loginBtns = [document.getElementById("loginBtn"), document.getElementById("loginBtnMobile")];
  const dashBtns = [document.getElementById("userDashboardBtn"), document.getElementById("userDashboardBtnMobile")];
  const notifWrap = document.getElementById("notifWrap");
  
  if (currentUser) {
    const loginDesktop = document.getElementById("loginBtn");
    if (loginDesktop) loginDesktop.style.display = "none";

    const loginMobile = document.getElementById("loginBtnMobile");
    if (loginMobile) {
      loginMobile.textContent = "Logout";
      loginMobile.onclick = logout;
    }

    dashBtns.forEach(btn => {
      if (btn) {
        btn.style.display = "inline-flex";
        btn.textContent = `👤 Hi, ${currentUser.first_name}`;
        btn.onclick = () => window.location.href = "customer_dashboard.php";
      }
    });

    if (notifWrap) notifWrap.style.display = "inline-block";

    if (window.location.pathname.includes("customer_dashboard.php")) {
      fetchCustomerDashboardData();
    }
  } else {
    loginBtns.forEach(btn => {
      if (btn) {
        btn.style.display = "inline-flex";
        btn.textContent = "Login / Register";
        btn.onclick = () => openAuth("login");
      }
    });
    dashBtns.forEach(btn => {
      if (btn) {
        btn.style.display = "none";
      }
    });
    if (notifWrap) notifWrap.style.display = "none";
  }
}

async function logout() {
  try {
    await fetch("includes/auth/logout.php");
    currentUser = null;
    updateNavbarState();
    showToast("Logged out successfully.");
    window.location.href = "index.php";
  } catch (err) {
    console.error("Logout failed", err);
  }
}

document.getElementById("loginBtn").addEventListener("click", () => {
  if (!currentUser) openAuth("login");
});
document.getElementById("loginBtnMobile").addEventListener("click", () => {
  if (!currentUser) openAuth("login");
});
document.getElementById("authClose").addEventListener("click", closeAuth);
document.getElementById("authBackHome1").addEventListener("click", closeAuth);
document.getElementById("authBackHome2").addEventListener("click", closeAuth);
document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => showAuthView(btn.dataset.view));
});

document.getElementById("loginSubmit").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  
  errEl.style.display = "none";
  errEl.textContent = "";

  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);

  try {
    const res = await fetch("includes/auth/login.php", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeAuth();
      await checkSession();
      showToast(`Welcome back, ${currentUser.first_name}!`);
    } else {
      errEl.textContent = data.error;
      errEl.style.display = "block";
    }
  } catch (err) {
    errEl.textContent = "An error occurred during login.";
    errEl.style.display = "block";
  }
});

const adminLoginBtn = document.getElementById("adminLoginSubmit");
if (adminLoginBtn) {
  adminLoginBtn.addEventListener("click", async () => {
    const username = document.getElementById("adminLoginUsername").value.trim();
    const password = document.getElementById("adminLoginPassword").value;
    const errEl = document.getElementById("adminLoginError");

    errEl.style.display = "none";
    errEl.textContent = "";

    if (!username || !password) {
      errEl.textContent = "Username and password are required.";
      errEl.style.display = "block";
      return;
    }

    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const res = await fetch("includes/admin-auth/login.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Admin login successful. Redirecting...");
        window.location.href = "admin_dashboard.php?page=home_overview";
      } else {
        errEl.textContent = data.error || "Login failed.";
        errEl.style.display = "block";
      }
    } catch (err) {
      errEl.textContent = "An error occurred during login.";
      errEl.style.display = "block";
    }
  });
}

document.getElementById("registerSubmit").addEventListener("click", async () => {
  const firstName = document.getElementById("regFirstName").value;
  const lastName = document.getElementById("regLastName").value;
  const email = document.getElementById("regEmail").value;
  const phone = document.getElementById("regPhone").value;
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;
  const errEl = document.getElementById("registerError");

  errEl.style.display = "none";
  errEl.textContent = "";

  const formData = new FormData();
  formData.append("first_name", firstName);
  formData.append("last_name", lastName);
  formData.append("email", email);
  formData.append("phone", phone);
  formData.append("password", password);
  formData.append("confirm_password", confirmPassword);

  try {
    const res = await fetch("includes/auth/register.php", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const emailDisplay = document.getElementById("verifyEmailDisplay");
      if (emailDisplay) emailDisplay.textContent = email;
      showAuthView("verify");
    } else {
      errEl.textContent = data.error;
      errEl.style.display = "block";
    }
  } catch (err) {
    errEl.textContent = "An error occurred during registration.";
    errEl.style.display = "block";
  }
});

document.getElementById("resendBtn").addEventListener("click", startVerifyTimer);
document.getElementById("verifySubmit").addEventListener("click", async () => {
  // TODO: Replace with real email OTP in Step 11
  closeAuth();
  await checkSession();
  showToast(`Account verified! Welcome, ${currentUser.first_name}!`);
});

// Run on page load
checkSession();

/* OTP auto-advance */
const otpInputs = document.querySelectorAll("#otpInputs input");
otpInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(-1);
    if (input.value && otpInputs[i + 1]) otpInputs[i + 1].focus();
  });
});

/* ---------- Booking wizard ---------- */
const bookingOverlay = document.getElementById("bookingOverlay");
const bookingSteps = {
  1: document.getElementById("bookingStep1"),
  2: document.getElementById("bookingStep2"),
  3: document.getElementById("bookingStep3"),
  4: document.getElementById("bookingStep4"),
};
let selectedServiceIds = [];
let selectedDate = "";
let selectedTime = "";

function openBooking(initialServiceId) {
  if (!isServicesLoaded) {
    showToast("Services are still loading, please wait...");
    return;
  }
  selectedServiceIds = initialServiceId ? [initialServiceId] : [];
  selectedDate = "";
  selectedTime = "";
  if (bookingDatePicker) {
    bookingDatePicker.clear();
  } else if (document.getElementById("bookingDate")) {
    document.getElementById("bookingDate").value = "";
  }
  renderBookingServices();
  renderTimeGrid();
  goToStep(1);
  lockScroll();
  bookingOverlay.hidden = false;
}
function closeBooking() {
  bookingOverlay.hidden = true;
  unlockScroll();
}

function renderBookingServices() {
  const grid = document.getElementById("bookingServiceGrid");
  grid.innerHTML = SERVICES.map((s) => `
    <button class="service-pill ${selectedServiceIds.includes(s.id) ? "is-selected" : ""}" data-id="${s.id}">
      <span>${s.name}</span>
      <span class="price">₱${s.price}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".service-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      selectedServiceIds = selectedServiceIds.includes(id)
        ? selectedServiceIds.filter((x) => x !== id)
        : [...selectedServiceIds, id];
      renderBookingServices();
      document.getElementById("toStep2").disabled = selectedServiceIds.length === 0;
    });
  });
  document.getElementById("toStep2").disabled = selectedServiceIds.length === 0;
}

async function fetchAvailableSlots() {
  if (!selectedDate) return;
  const chosen = SERVICES.filter((s) => selectedServiceIds.includes(s.id));
  const duration = chosen.reduce((sum, s) => sum + s.minutes, 0);
  if (duration === 0) return;

  try {
    const res = await fetch(`includes/appointments/available_slots.php?date=${encodeURIComponent(selectedDate)}&duration_minutes=${duration}`);
    const slots = await res.json();
    renderTimeGrid(slots);
  } catch (err) {
    console.error("Failed to fetch available slots", err);
    renderTimeGrid();
  }
}

function renderTimeGrid(availableSlots = null) {
  const grid = document.getElementById("timeGrid");
  const availMap = {};
  if (Array.isArray(availableSlots)) {
    availableSlots.forEach((s) => { availMap[s.time] = s.available; });
  }

  grid.innerHTML = TIME_SLOTS.map((t) => {
    const isAvail = availMap.hasOwnProperty(t) ? availMap[t] : true;
    const isSel = selectedTime === t && isAvail;

    if (selectedTime === t && !isAvail) {
      selectedTime = "";
      updateStep2NextState();
    }

    return `
      <button 
        class="time-slot ${isSel ? "is-selected" : ""} ${!isAvail ? "time-slot--unavailable" : ""}" 
        data-time="${t}" 
        ${!isAvail ? "disabled" : ""}
      >${t}</button>
    `;
  }).join("");

  grid.querySelectorAll(".time-slot:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedTime = btn.dataset.time;
      renderTimeGrid(availableSlots);
      updateStep2NextState();
    });
  });
}

function updateStep2NextState() {
  document.getElementById("toStep3").disabled = !(selectedDate && selectedTime);
}

let bookingDatePicker;
if (typeof flatpickr !== "undefined" && document.getElementById("bookingDate")) {
  bookingDatePicker = flatpickr("#bookingDate", {
    minDate: "today",
    dateFormat: "Y-m-d",
    onChange: function (selectedDates, dateStr) {
      selectedDate = dateStr;
      selectedTime = "";
      fetchAvailableSlots();
      updateStep2NextState();
    },
  });
} else if (document.getElementById("bookingDate")) {
  document.getElementById("bookingDate").addEventListener("change", (e) => {
    selectedDate = e.target.value;
    selectedTime = "";
    fetchAvailableSlots();
    updateStep2NextState();
  });
}

function goToStep(step) {
  Object.entries(bookingSteps).forEach(([key, el]) => {
    if (el) el.hidden = Number(key) !== step;
  });
  const stepperEl = document.getElementById("stepper");
  if (stepperEl) stepperEl.style.display = step === 4 ? "none" : "flex";

  document.querySelectorAll(".stepper__step").forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle("is-active", n === step);
    el.classList.toggle("is-done", n < step);
    el.querySelector(".stepper__circle").textContent = n < step ? "✓" : n;
  });
  if (step === 2) {
    fetchAvailableSlots();
    updateStep2NextState();
  }
  if (step === 3) {
    renderSummary();
  }
}

function selectedServices() {
  return SERVICES.filter((s) => selectedServiceIds.map(String).includes(String(s.id)));
}

function renderSummary() {
  const chosen = selectedServices();
  const totalMinutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const totalPrice = chosen.reduce((sum, s) => sum + s.price, 0);

  const servicesEl = document.getElementById("summaryServices");
  if (servicesEl) {
    servicesEl.innerHTML = chosen
      .map(
        (s) => `
      <li>
        <div>
          <p class="name">${s.name}</p>
          <p class="desc">${s.description || ""}</p>
        </div>
        <div>
          <p class="price">${peso(s.price)}</p>
          <p class="time">${s.duration}</p>
        </div>
      </li>
    `,
      )
      .join("");
  }

  const detailsEl = document.getElementById("summaryDetails");
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div><dt>Date</dt><dd>${selectedDate || "-"}</dd></div>
      <div><dt>Time</dt><dd>${selectedTime || "-"}</dd></div>
      <div><dt>Total Duration</dt><dd>${formatDuration(totalMinutes)}</dd></div>
      <div class="total"><dt>Total</dt><dd>${peso(totalPrice)}</dd></div>
    `;
  }

  const custInfoEl = document.getElementById("summaryCustomerInfo");
  if (custInfoEl) {
    if (currentUser) {
      custInfoEl.innerHTML = `
        <div><dt>Name</dt><dd>${currentUser.first_name} ${currentUser.last_name || ""}</dd></div>
        <div><dt>Email</dt><dd>${currentUser.email}</dd></div>
        <div><dt>Phone</dt><dd>${currentUser.phone || "N/A"}</dd></div>
      `;
    } else {
      custInfoEl.innerHTML = `
        <div><dt>Status</dt><dd><span style="color:var(--brand-pink, #ec4899); font-weight:600;">Not logged in</span> — <button class="link-btn" id="summaryLoginLink" style="display:inline; font-family:inherit; color:var(--brand-purple); font-weight:600;">Log in now</button></dd></div>
      `;
      document.getElementById("summaryLoginLink")?.addEventListener("click", () => {
        closeBooking();
        openAuth("login");
      });
    }
  }
}

document.getElementById("bookHeroBtn")?.addEventListener("click", () => openBooking());
document.getElementById("bookNavBtn")?.addEventListener("click", () => openBooking());
document.getElementById("bookNavBtnMobile")?.addEventListener("click", () => openBooking());
document.getElementById("bookingClose")?.addEventListener("click", closeBooking);
document.getElementById("bookingBackClose")?.addEventListener("click", closeBooking);
document.getElementById("toStep2")?.addEventListener("click", () => goToStep(2));
document.getElementById("toStep1")?.addEventListener("click", () => goToStep(1));
document.getElementById("toStep3")?.addEventListener("click", () => goToStep(3));
document.getElementById("toStep2b")?.addEventListener("click", () => goToStep(2));
document.getElementById("confirmBooking")?.addEventListener("click", async () => {
  if (!currentUser) {
    closeBooking();
    openAuth("login");
    showToast("Please log in to confirm your booking.");
    return;
  }

  const confirmBtn = document.getElementById("confirmBooking");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Processing...";

  const formData = new FormData();
  formData.append("service_ids", JSON.stringify(selectedServiceIds));
  formData.append("date", selectedDate);
  formData.append("time", selectedTime);

  try {
    const res = await fetch("includes/appointments/create.php", {
      method: "POST",
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("successBookingRef").textContent = data.appointment_id;
      const totalP = selectedServices().reduce((sum, s) => sum + parseFloat(s.price), 0);
      document.getElementById("successSummaryDetails").innerHTML = `
        <div><dt>Date</dt><dd>${selectedDate}</dd></div>
        <div><dt>Time</dt><dd>${selectedTime}</dd></div>
        <div class="total"><dt>Total Amount</dt><dd>${peso(totalP)}</dd></div>
      `;

      goToStep(4);
      selectedServiceIds = [];
      selectedDate = "";
      selectedTime = "";
      if (document.getElementById("bookingDate")) {
        document.getElementById("bookingDate").value = "";
      }
    } else {
      showToast(data.error || "Booking failed.");
      if (data.error && data.error.includes("no longer available")) {
        goToStep(2);
        fetchAvailableSlots();
      }
    }
  } catch (err) {
    showToast("Error processing booking request.");
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirm Booking";
  }
});

const bookingSuccessDone = document.getElementById("bookingSuccessDone");
if (bookingSuccessDone) {
  bookingSuccessDone.addEventListener("click", closeBooking);
}

/* ---------- Rate Us Modal ---------- */
const rateOverlay = document.getElementById("rateOverlay");
let selectedRating = 5;

async function openRateModal() {
  if (!currentUser) {
    openAuth("login");
    showToast("Please log in to rate your appointment.");
    return;
  }

  try {
    const res = await fetch("includes/reviews/ratable.php");
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "Failed to load completed appointments.");
      return;
    }

    if (!data.appointments || data.appointments.length === 0) {
      showToast("You don't have any completed appointments to rate yet.");
      return;
    }

    const select = document.getElementById("rateAppointmentSelect");
    select.innerHTML = data.appointments.map(a => `
      <option value="${a.appointment_id}">
        ${a.appointment_id} — ${a.service_names} (${a.appointment_date} at ${a.appointment_time})
      </option>
    `).join("");

    selectedRating = 5;
    updateStarInputVisual(5);
    document.getElementById("rateRatingVal").value = "5";
    document.getElementById("rateReviewText").value = "";
    document.getElementById("rateError").style.display = "none";

    rateOverlay.style.display = "flex";
    rateOverlay.hidden = false;
    lockScroll();
  } catch (err) {
    showToast("Error checking ratable appointments.");
  }
}

function closeRateModal() {
  if (rateOverlay) {
    rateOverlay.style.display = "none";
    rateOverlay.hidden = true;
  }
  unlockScroll();
}

if (rateOverlay) {
  rateOverlay.addEventListener("click", (e) => {
    if (e.target === rateOverlay) {
      closeRateModal();
    }
  });
}

function updateStarInputVisual(rating) {
  const stars = document.querySelectorAll("#starRatingInput [data-star]");
  stars.forEach((star) => {
    const val = Number(star.dataset.star);
    star.style.color = val <= rating ? "#fbbf24" : "#e5e7eb";
  });
}

document.querySelectorAll("#starRatingInput [data-star]").forEach((star) => {
  star.addEventListener("click", () => {
    selectedRating = Number(star.dataset.star);
    document.getElementById("rateRatingVal").value = selectedRating;
    updateStarInputVisual(selectedRating);
  });
  star.addEventListener("mouseenter", () => {
    updateStarInputVisual(Number(star.dataset.star));
  });
});

const starContainer = document.getElementById("starRatingInput");
if (starContainer) {
  starContainer.addEventListener("mouseleave", () => {
    updateStarInputVisual(selectedRating);
  });
}

const rateCloseBtn = document.getElementById("rateClose");
if (rateCloseBtn) rateCloseBtn.addEventListener("click", closeRateModal);

const rateForm = document.getElementById("rateForm");
if (rateForm) {
  rateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const appSelect = document.getElementById("rateAppointmentSelect");
    const ratingVal = document.getElementById("rateRatingVal").value;
    const reviewText = document.getElementById("rateReviewText").value.trim();
    const errEl = document.getElementById("rateError");
    const submitBtn = document.getElementById("rateSubmitBtn");

    errEl.style.display = "none";
    errEl.textContent = "";

    if (!appSelect.value) {
      errEl.textContent = "Please select an appointment to rate.";
      errEl.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const formData = new FormData();
    formData.append("appointment_id", appSelect.value);
    formData.append("rating", ratingVal);
    formData.append("review_text", reviewText);

    try {
      const res = await fetch("includes/reviews/create.php", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        closeRateModal();
        showToast("Thank you for your review!");
        fetchReviewsPublic();
        fetchCustomerDashboardData();
      } else {
        errEl.textContent = data.error || "Failed to submit review.";
        errEl.style.display = "block";
      }
    } catch (err) {
      errEl.textContent = "An error occurred while submitting your review.";
      errEl.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Rating";
    }
  });
}

/* ---------- Customer Dashboard Modal & Page ---------- */
const customerDashboardOverlay = document.getElementById("customerDashboardOverlay");
var customerDashboardData = null;
var activeDashTab = "overview";

function openCustomerDashboard(defaultTab = "overview") {
  window.location.href = "customer_dashboard.php?tab=" + defaultTab;
}

function closeCustomerDashboard() {
  if (customerDashboardOverlay) {
    customerDashboardOverlay.style.display = "none";
    customerDashboardOverlay.hidden = true;
  }
  unlockScroll();
}

window.switchDashTab = function(tabName) {
  activeDashTab = tabName;
  
  // Tab buttons (page or modal)
  const tabBtns = document.querySelectorAll("#custDashNavList [data-tab], #custDashTabs [data-tab]");
  tabBtns.forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("is-active");
    } else {
      btn.classList.remove("is-active");
    }
  });

  const pageViews = {
    overview: document.getElementById("dashPageSecOverview"),
    bookings: document.getElementById("dashPageSecBookings"),
    notifications: document.getElementById("dashPageSecNotifications"),
    reviews: document.getElementById("dashPageSecReviews"),
    profile: document.getElementById("dashPageSecProfile"),
  };

  Object.entries(pageViews).forEach(([key, el]) => {
    if (el) el.hidden = key !== tabName;
  });

  if (window.location.pathname.includes("customer_dashboard.php") && window.history && window.history.replaceState) {
    window.history.replaceState(null, "", "customer_dashboard.php?tab=" + tabName);
  }
};

document.querySelectorAll("#custDashNavList [data-tab], #custDashTabs [data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchDashTab(btn.dataset.tab);
  });
});

async function fetchCustomerDashboardData(targetTab) {
  try {
    const res = await fetch("includes/customers/my_dashboard.php");
    const data = await res.json();

    if (!data.success) {
      if (res.status === 401) {
        logout();
      }
      return;
    }

    customerDashboardData = data;
    renderCustomerDashboardUI();

    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = targetTab || urlParams.get("tab") || "overview";
    switchDashTab(initialTab);

  } catch (err) {
    console.error("Failed to fetch customer dashboard data", err);
  }
}

function renderCustomerDashboardUI() {
  if (!customerDashboardData) return;
  const { customer, summary, appointments, notifications, reviews } = customerDashboardData;

  // Banner Greeting
  const welcomeBannerFname = document.getElementById("welcomeFnameBanner");
  if (welcomeBannerFname) welcomeBannerFname.textContent = customer.first_name || "Client";

  // Header & Avatar (Page & Modal)
  const greetingText = `Welcome back, ${customer.first_name}!`;
  const emailText = customer.email || "";
  const joinedText = customer.joined_at ? `Member since ${customer.joined_at}` : "";
  const initials = customer.first_name ? customer.first_name.substring(0, 1) + (customer.last_name ? customer.last_name.substring(0, 1) : "") : "AN";

  ["custDashGreeting", "custDashGreetingPage"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = greetingText;
  });

  ["custDashEmail", "custDashEmailPage"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = emailText;
  });

  const joinedEl = document.getElementById("custDashJoinedPage");
  if (joinedEl && joinedText) joinedEl.textContent = joinedText;

  ["custDashAvatar", "custDashAvatarPage"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials.toUpperCase();
  });

  // Summary Counters
  const confVal = summary.confirmed_count || 0;
  const pendVal = summary.pending_count || 0;
  const compVal = summary.completed_count || 0;
  const unreadVal = summary.unread_notifications || 0;

  ["sumConfirmedCount", "sumPageConfirmed"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = confVal; });
  ["sumPendingCount", "sumPagePending"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = pendVal; });
  ["sumCompletedCount", "sumPageCompleted"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = compVal; });
  ["sumUnreadNotifs", "sumPageUnread"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = unreadVal; });

  const notifBadges = [document.getElementById("headerNotifBadge"), document.getElementById("custDashNotifBadgePage")];
  notifBadges.forEach((b) => {
    if (b) {
      if (unreadVal > 0) {
        b.textContent = unreadVal;
        b.style.display = "inline-block";
      } else {
        b.style.display = "none";
      }
    }
  });

  renderHeaderNotificationsList(notifications);
  renderHeroUpcomingAppointmentCard(appointments);
  renderOverviewNotifSnippet(notifications);
  renderOverviewVisitsSnippet(appointments);

  renderDashRecentActivity(appointments);
  renderDashBookingsList(appointments);
  renderDashNotificationsList(notifications);
  renderDashReviewsList(reviews, appointments);

  // Profile Form Fill
  ["custProfFirstName", "dashProfFname"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = customer.first_name || ""; });
  ["custProfLastName", "dashProfLname"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = customer.last_name || ""; });
  ["custProfEmail", "dashProfEmail"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = customer.email || ""; });
  ["custProfPhone", "dashProfPhone"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = customer.phone || ""; });
  ["custProfNewPassword", "dashProfPassword"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
}

// Render Featured Hero Upcoming Appointment Card
function renderHeroUpcomingAppointmentCard(appointments) {
  const container = document.getElementById("dashHeroUpcomingCard");
  if (!container) return;

  const upcoming = (appointments || []).find((a) => a.status === "Confirmed" || a.status === "Pending");

  if (!upcoming) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0.5rem;">
        <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">✨</div>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.35rem;">You don't have any upcoming appointments</h3>
        <p style="font-size: 0.875rem; color: #64748b; margin: 0 0 1.25rem; max-width: 460px; margin-left: auto; margin-right: auto;">
          Treat yourself to a pampering session at Astrid Nails &amp; Beauty Bar today!
        </p>
        <button class="btn btn--brand" onclick="openBooking()" style="padding: 0.75rem 1.5rem; font-size: 0.875rem; font-weight: 700; border-radius: 12px; background: #77334f; color: #fff;">
          + Book an Appointment Now
        </button>
      </div>
    `;
    return;
  }

  let statusBadgeClass = upcoming.status === "Confirmed" ? "badge--confirmed" : "badge--pending";
  const imageHtml = upcoming.service_image 
    ? `<img src="${upcoming.service_image}" alt="${upcoming.service}" style="width: 90px; height: 90px; border-radius: 16px; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div style="display:none; width: 90px; height: 90px; border-radius: 16px; background: #f3e8ff; color: #6b21a8; align-items: center; justify-content: center; font-size: 2rem;">✨</div>`
    : `<div style="width: 90px; height: 90px; border-radius: 16px; background: #f3e8ff; color: #6b21a8; display: flex; align-items: center; justify-content: center; font-size: 2rem;">✨</div>`;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
      <h3 style="font-size: 1.1rem; font-weight: 800; color: #1e1b4b; margin: 0;">Upcoming Appointment</h3>
      <button class="link-btn" onclick="window.switchDashTab('bookings')" style="font-size: 0.825rem; font-weight: 700; color: #6b21a8;">View All &rarr;</button>
    </div>

    <div style="display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
      ${imageHtml}
      <div>
        <h4 style="font-size: 1.2rem; font-weight: 800; color: #1e1b4b; margin: 0 0 0.4rem;">${upcoming.service}</h4>
        <p style="font-size: 0.875rem; color: #475569; margin: 0 0 0.25rem; font-weight: 600;">📅 ${upcoming.date}</p>
        <p style="font-size: 0.875rem; color: #475569; margin: 0 0 0.25rem; font-weight: 600;">⏰ ${upcoming.time}</p>
        <p style="font-size: 0.825rem; color: #64748b; margin: 0 0 0.5rem;">Booking Ref: <strong style="color: #6b21a8;">#${upcoming.id}</strong></p>
        <span class="badge ${statusBadgeClass}">${upcoming.status}</span>
      </div>
    </div>

    <button class="btn" onclick="window.switchDashTab('bookings')" style="display: block; width: 100%; padding: 0.8rem; background: #6b21a8; color: #ffffff; font-weight: 700; font-size: 0.875rem; border-radius: 12px; text-align: center; border: none; cursor: pointer;">View Appointment</button>
  `;
}

// Render Overview Snippet: Recent Notifications
function renderOverviewNotifSnippet(notifications) {
  const container = document.getElementById("dashOverviewNotifSnippet");
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <p style="font-size: 0.85rem; color: #94a3b8; text-align: center; margin: 1.5rem 0;">You're all caught up! No notifications.</p>
    `;
    return;
  }

  const top3 = notifications.slice(0, 3);
  container.innerHTML = top3.map((n) => `
    <div style="padding: 0.75rem; border-radius: 12px; margin-bottom: 0.6rem; font-size: 0.825rem; background: ${!n.is_read ? "#fdf2f8" : "#f8fafc"}; border: 1px solid ${!n.is_read ? "#fbcfe8" : "#f1f5f9"}; display: flex; align-items: flex-start; gap: 0.65rem;">
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${n.type === 'confirmed' ? '#d1fae5' : '#fef3c7'}; color: ${n.type === 'confirmed' ? '#059669' : '#d97706'}; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0;">
        ${n.type === 'confirmed' ? '✓' : '🔔'}
      </div>
      <div style="flex: 1;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #1e1b4b; font-size: 0.85rem;">${n.title}</strong>
          <span style="font-size: 0.7rem; color: #94a3b8;">${n.created_at}</span>
        </div>
        <p style="margin: 0.15rem 0 0; color: #64748b; font-size: 0.8rem; line-height: 1.3;">${n.message}</p>
      </div>
    </div>
  `).join("") + `
    <div style="text-align: center; margin-top: 1rem;">
      <button class="link-btn" onclick="window.switchDashTab('notifications')" style="font-size: 0.8rem; font-weight: 700; color: #6b21a8;">View All Notifications &rarr;</button>
    </div>
  `;
}

// Render Overview Snippet: Recent Completed Visits
function renderOverviewVisitsSnippet(appointments) {
  const container = document.getElementById("dashOverviewVisitsSnippet");
  if (!container) return;

  const completedVisits = (appointments || []).filter((a) => a.status === "Completed").slice(0, 3);

  if (completedVisits.length === 0) {
    container.innerHTML = `
      <p style="font-size: 0.85rem; color: #94a3b8; text-align: center; margin: 1.5rem 0;">No completed appointments yet.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
      ${completedVisits.map((a) => {
        const thumbHtml = a.service_image 
          ? `<img src="${a.service_image}" alt="${a.service}" style="width: 52px; height: 52px; border-radius: 12px; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div style="display:none; width: 52px; height: 52px; border-radius: 12px; background: #f3e8ff; color: #6b21a8; align-items: center; justify-content: center; font-size: 1.25rem;">✨</div>`
          : `<div style="width: 52px; height: 52px; border-radius: 12px; background: #f3e8ff; color: #6b21a8; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">✨</div>`;

        const ratingBtnOrBadge = a.has_rating
          ? `<span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 20px; white-space: nowrap;">✓ Rated (${a.rating_given} ★)</span>`
          : `<button class="btn btn--brand dash-rate-now-btn" data-appid="${a.id}" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px; white-space: nowrap; background: #6b21a8; color: #ffffff;">⭐ Rate Now</button>`;

        return `
          <div style="padding: 0.85rem; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${thumbHtml}
              <div>
                <strong style="font-size: 0.875rem; color: #1e1b4b; display: block; margin-bottom: 0.15rem;">${a.service}</strong>
                <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 0.25rem;">${a.date}</span>
                <span class="badge badge--completed" style="font-size: 0.65rem;">Completed</span>
              </div>
            </div>
            ${ratingBtnOrBadge}
          </div>
        `;
      }).join("")}
    </div>
  `;

  bindDashAppointmentActionEvents(container);
}

function renderDashRecentActivity(appointments) {
  const container = document.getElementById("custDashRecentActivity");
  if (!container) return;

  if (!appointments || appointments.length === 0) {
    container.innerHTML = `
      <div class="card card--center" style="padding: 2rem 1rem; text-align: center;">
        <p style="font-size: 1rem; font-weight: 700; color: var(--foreground); margin-bottom: 0.5rem;">No appointments yet</p>
        <p class="muted" style="font-size: 0.85rem; margin-bottom: 1rem;">Book your first luxury nail or spa treatment today!</p>
        <button class="btn btn--brand" onclick="closeCustomerDashboard(); openBooking();">Book Appointment Now</button>
      </div>
    `;
    return;
  }

  const recent = appointments.slice(0, 3);
  container.innerHTML = recent.map((a) => renderAppointmentCardHtml(a)).join("");
  bindDashAppointmentActionEvents(container);
}

function renderDashBookingsList(appointments) {
  const container = document.getElementById("custDashBookingsList");
  if (!container) return;

  if (!appointments || appointments.length === 0) {
    container.innerHTML = `
      <div class="card card--center" style="padding: 2rem 1rem; text-align: center;">
        <p style="font-size: 1rem; font-weight: 700; color: var(--foreground); margin-bottom: 0.5rem;">No bookings found</p>
        <p class="muted" style="font-size: 0.85rem; margin-bottom: 1rem;">You don't have any past or upcoming appointments.</p>
        <button class="btn btn--brand" onclick="closeCustomerDashboard(); openBooking();">Book Appointment Now</button>
      </div>
    `;
    return;
  }

  container.innerHTML = appointments.map((a) => renderAppointmentCardHtml(a)).join("");
  bindDashAppointmentActionEvents(container);
}

function renderAppointmentCardHtml(a) {
  let statusBadgeClass = "badge--pending";
  if (a.status === "Confirmed") statusBadgeClass = "badge--confirmed";
  if (a.status === "Completed") statusBadgeClass = "badge--completed";
  if (a.status === "Cancelled") statusBadgeClass = "badge--cancelled";

  let actionHtml = "";
  if (a.status === "Completed") {
    if (a.has_rating) {
      actionHtml = `<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #b45309; border: 1px solid #fde68a; font-weight: 700;">✓ Rated (${a.rating_given} ★)</span>`;
    } else {
      actionHtml = `<button class="btn btn--brand dash-rate-now-btn" data-appid="${a.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">⭐ Rate Now</button>`;
    }
  } else if (a.status === "Pending") {
    actionHtml = `<span class="badge badge--pending" style="font-size:0.75rem;">Awaiting Approval</span>`;
  } else if (a.status === "Confirmed") {
    actionHtml = `<span class="badge badge--confirmed" style="font-size:0.75rem;">Confirmed Visit</span>`;
  } else {
    actionHtml = `<span class="badge badge--cancelled" style="font-size:0.75rem;">Cancelled</span>`;
  }

  return `
    <div class="card" style="padding: 1.15rem; margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem; border-left: 4px solid ${getAppointmentBorderColor(a.status)};">
      <div>
        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem;">
          <span style="font-weight: 800; color: var(--brand-purple, #6b21a8); font-size: 0.95rem;">${a.id}</span>
          <span class="badge ${statusBadgeClass}">${a.status}</span>
        </div>
        <p style="font-size: 0.9rem; font-weight: 700; color: var(--foreground); margin: 0 0 0.25rem;">${a.service}</p>
        <p style="font-size: 0.8rem; color: var(--muted-foreground); margin: 0;">
          📅 <strong>${a.date}</strong> at <strong>${a.time}</strong> · ₱${a.price.toFixed(2)}
        </p>
      </div>
      <div>
        ${actionHtml}
      </div>
    </div>
  `;
}

function getAppointmentBorderColor(status) {
  switch (status) {
    case "Confirmed": return "#6b21a8";
    case "Completed": return "#10b981";
    case "Cancelled": return "#ef4444";
    default: return "#eab308";
  }
}

function bindDashAppointmentActionEvents(container) {
  container.querySelectorAll(".dash-rate-now-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appId = btn.dataset.appid;
      openRateModalSpecific(appId);
    });
  });
}

async function openRateModalSpecific(targetAppId) {
  await openRateModal();
  if (targetAppId) {
    const select = document.getElementById("rateAppointmentSelect");
    if (select) {
      select.value = targetAppId;
    }
  }
}

function renderDashNotificationsList(notifications) {
  const container = document.getElementById("custDashNotificationsList");
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <div class="card card--center" style="padding: 2rem 1rem; text-align: center;">
        <p style="font-size: 1rem; font-weight: 700; color: var(--foreground); margin-bottom: 0.5rem;">No notifications</p>
        <p class="muted" style="font-size: 0.85rem;">You don't have any alerts yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map((n) => {
    let icon = "🔔";
    if (n.type === "confirmed") icon = "✅";
    if (n.type === "cancelled") icon = "❌";
    if (n.type === "reminder") icon = "⏰";

    const unreadStyle = !n.is_read ? "background: rgba(236, 72, 153, 0.05); border-left: 4px solid #ec4899;" : "border-left: 4px solid var(--border);";

    return `
      <div class="card" style="padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; ${unreadStyle}">
        <div style="display: flex; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">${icon}</span>
          <div>
            <p style="font-size: 0.9rem; font-weight: 700; color: var(--foreground); margin: 0 0 0.2rem;">${n.title}</p>
            <p style="font-size: 0.825rem; color: var(--muted-foreground); margin: 0 0 0.35rem;">${n.message}</p>
            <span style="font-size: 0.75rem; color: #9ca3af;">${n.created_at}</span>
          </div>
        </div>
        ${!n.is_read ? `<button class="link-btn mark-notif-read-btn" data-id="${n.id}" style="font-size: 0.75rem; white-space: nowrap;">Mark Read</button>` : `<span style="font-size:0.75rem; color:#9ca3af;">Read</span>`}
      </div>
    `;
  }).join("");

  container.querySelectorAll(".mark-notif-read-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const notifId = btn.dataset.id;
      const formData = new FormData();
      formData.append("notification_id", notifId);
      await fetch("includes/notifications/mark_read.php", { method: "POST", body: formData });
      fetchCustomerDashboardData("notifications");
    });
  });
}

function renderHeaderNotificationsList(notifications) {
  const container = document.getElementById("headerNotifList");
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem 0.5rem; text-align: center; color: var(--muted-foreground, #666); font-size: 0.825rem;">
        No notifications yet
      </div>
    `;
    return;
  }

  const recent = notifications.slice(0, 5);
  container.innerHTML = recent.map((n) => {
    let icon = "🔔";
    if (n.type === "confirmed") icon = "✅";
    if (n.type === "cancelled") icon = "❌";
    if (n.type === "reminder") icon = "⏰";

    const bg = !n.is_read ? "background: rgba(236, 72, 153, 0.06);" : "";
    return `
      <div style="padding: 0.6rem; border-radius: 8px; margin-bottom: 0.4rem; font-size: 0.8rem; ${bg}">
        <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
          <span>${icon}</span>
          <div>
            <strong style="color: var(--foreground); font-size: 0.825rem;">${n.title}</strong>
            <p style="margin: 0.15rem 0; color: var(--muted-foreground); line-height: 1.3;">${n.message}</p>
            <span style="font-size: 0.7rem; color: #9ca3af;">${n.created_at}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Notification Popover Toggle
const notifBellBtn = document.getElementById("notifBellBtn");
const notifDropdownPop = document.getElementById("notifDropdownPop");

if (notifBellBtn && notifDropdownPop) {
  notifBellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdownPop.hidden = !notifDropdownPop.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!notifDropdownPop.contains(e.target) && e.target !== notifBellBtn) {
      notifDropdownPop.hidden = true;
    }
  });
}

const headerMarkAllNotifsRead = document.getElementById("headerMarkAllNotifsRead");
if (headerMarkAllNotifsRead) {
  headerMarkAllNotifsRead.addEventListener("click", async () => {
    const formData = new FormData();
    formData.append("mark_all", "1");
    await fetch("includes/notifications/mark_read.php", { method: "POST", body: formData });
    fetchCustomerDashboardData();
    showToast("All notifications marked as read.");
  });
}

const dashLogoutBtn = document.getElementById("dashLogoutBtn");
if (dashLogoutBtn) {
  dashLogoutBtn.addEventListener("click", () => {
    closeCustomerDashboard();
    logout();
  });
}

const markAllNotifsReadBtn = document.getElementById("markAllNotifsReadBtn");
if (markAllNotifsReadBtn) {
  markAllNotifsReadBtn.addEventListener("click", async () => {
    const formData = new FormData();
    formData.append("mark_all", "1");
    await fetch("includes/notifications/mark_read.php", { method: "POST", body: formData });
    fetchCustomerDashboardData("notifications");
    showToast("All notifications marked as read.");
  });
}

function renderDashReviewsList(reviews, appointments) {
  const container = document.getElementById("custDashReviewsList");
  if (!container) return;

  let html = "";

  const unrated = (appointments || []).filter((a) => a.status === "Completed" && !a.has_rating);
  if (unrated.length > 0) {
    html += `
      <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid #fde68a; padding: 1rem; border-radius: 12px; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <p style="font-weight: 700; color: #b45309; margin: 0 0 0.2rem; font-size: 0.9rem;">You have ${unrated.length} completed visit(s) to rate!</p>
          <p style="font-size: 0.8rem; color: #666; margin: 0;">Share your experience to help us improve.</p>
        </div>
        <button class="btn btn--brand" id="dashRateVisitPromptBtn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;">⭐ Rate Visit Now</button>
      </div>
    `;
  }

  if (!reviews || reviews.length === 0) {
    html += `
      <div class="card card--center" style="padding: 2rem 1rem; text-align: center;">
        <p style="font-size: 1rem; font-weight: 700; color: var(--foreground); margin-bottom: 0.5rem;">No reviews submitted yet</p>
        <p class="muted" style="font-size: 0.85rem;">Once you complete an appointment, you can share your feedback here.</p>
      </div>
    `;
  } else {
    html += reviews.map((r) => `
      <div class="card" style="padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--foreground);">${r.service_names} (${r.appointment_id})</span>
          <span style="font-size: 0.85rem; color: #fbbf24;">${starsHtml(r.rating, "0.85rem")}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--muted-foreground); margin: 0 0 0.35rem;">${r.review_text ? `"${r.review_text}"` : "<em>No written review provided.</em>"}</p>
        <span style="font-size: 0.75rem; color: #9ca3af;">Submitted on ${r.created_at}</span>
      </div>
    `).join("");
  }

  container.innerHTML = html;

  const promptBtn = container.querySelector("#dashRateVisitPromptBtn");
  if (promptBtn) {
    promptBtn.addEventListener("click", () => {
      closeCustomerDashboard();
      openRateModal();
    });
  }
}

// Page-level Customer Dashboard Actions & Event Handlers
["dashPageBookBtn", "dashPageBookBtn2", "dashBookShortcutBtn"].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener("click", () => openBooking());
  }
});

const viewAllBookingsBtn = document.getElementById("viewAllBookingsBtn");
if (viewAllBookingsBtn) {
  viewAllBookingsBtn.addEventListener("click", () => switchDashTab("bookings"));
}

["dashPageLogoutBtn", "dashLogoutBtn"].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener("click", () => logout());
  }
});

const dashPageMarkAllRead = document.getElementById("dashPageMarkAllRead");
if (dashPageMarkAllRead) {
  dashPageMarkAllRead.addEventListener("click", async () => {
    const formData = new FormData();
    formData.append("mark_all", "1");
    await fetch("includes/notifications/mark_read.php", { method: "POST", body: formData });
    fetchCustomerDashboardData("notifications");
    showToast("All notifications marked as read.");
  });
}

["dashPageRateVisitBtn", "dashRateVisitBtn"].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener("click", () => openRateModal());
  }
});

// Profile Form Submit (Page & Modal)
["custProfileForm", "dashPageProfileForm"].forEach((formId) => {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fname = (document.getElementById("dashProfFname") || document.getElementById("custProfFirstName")).value.trim();
    const lname = (document.getElementById("dashProfLname") || document.getElementById("custProfLastName")).value.trim();
    const phone = (document.getElementById("dashProfPhone") || document.getElementById("custProfPhone")).value.trim();
    const newPass = (document.getElementById("dashProfPassword") || document.getElementById("custProfNewPassword")).value;
    const errEl = document.getElementById("dashProfError") || document.getElementById("custProfError");
    const saveBtn = document.getElementById("dashProfSaveBtn") || document.getElementById("custProfSaveBtn");

    if (errEl) {
      errEl.style.display = "none";
      errEl.textContent = "";
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const formData = new FormData();
    formData.append("first_name", fname);
    formData.append("last_name", lname);
    formData.append("phone", phone);
    if (newPass) formData.append("new_password", newPass);

    try {
      const res = await fetch("includes/customers/update_profile.php", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        showToast("Profile updated successfully!");
        if (currentUser) {
          currentUser.first_name = fname;
          updateNavbarState();
        }
        const passInput = document.getElementById("dashProfPassword") || document.getElementById("custProfNewPassword");
        if (passInput) passInput.value = "";
        fetchCustomerDashboardData("profile");
      } else {
        if (errEl) {
          errEl.textContent = data.error || "Failed to update profile.";
          errEl.style.display = "block";
        }
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = "An error occurred while updating profile.";
        errEl.style.display = "block";
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    }
  });
});

/* ---------- Init ---------- */
document.getElementById("footerYear").textContent = new Date().getFullYear();
fetchServices();
fetchReviewsPublic();
fetchFaqsPublic();
fetchAboutPublic();

// Auto-fetch customer dashboard data if customer_dashboard.php is open
if (window.location.pathname.includes("customer_dashboard.php")) {
  fetchCustomerDashboardData();
}

// Auto-open Admin Login modal if openAuth=admin query parameter is present
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("openAuth") === "admin") {
  openAuth("admin-login");
}