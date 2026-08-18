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

const REVIEWS = [
  { name: "Maria Santos", initials: "MS", rating: 5, date: "June 2, 2026", text: "The gel polish lasted a full month and the salon smells amazing. Best nail spa in the city!" },
  { name: "Jasmine Reyes", initials: "JR", rating: 4, date: "May 28, 2026", text: "Lovely staff and very hygienic tools. My lash extensions look so natural." },
  { name: "Andrea Lim", initials: "AL", rating: 5, date: "May 14, 2026", text: "Booked the spa treatment for my mom. She left glowing — we're going monthly now." },
  { name: "Paolo Cruz", initials: "PC", rating: 5, date: "May 3, 2026", text: "The gentleman package is worth every peso. Clean, relaxing, no rushing." },
];

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
  document.getElementById("heroStars").innerHTML = starsHtml(5, "1.4rem");

  const grid = document.getElementById("reviewsGrid");
  grid.innerHTML = REVIEWS.map((r) => `
    <article class="card review-card">
      <div class="review-card__head">
        <span class="review-card__avatar">${r.initials}</span>
        <div>
          <p class="review-card__name">${r.name}</p>
          <p class="review-card__date">${r.date}</p>
        </div>
      </div>
      <div class="review-card__stars">${starsHtml(r.rating, "0.85rem")}</div>
      <p class="review-card__text">${r.text}</p>
    </article>
  `).join("");
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
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

/* ---------- Auth modal ---------- */
const authOverlay = document.getElementById("authOverlay");
const authViews = {
  login: document.getElementById("loginView"),
  register: document.getElementById("registerView"),
  verify: document.getElementById("verifyView"),
};
let verifyTimerInterval;

function openAuth(view = "login") {
  authOverlay.hidden = false;
  showAuthView(view);
}
function closeAuth() {
  authOverlay.hidden = true;
  clearInterval(verifyTimerInterval);
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
  
  if (currentUser) {
    const text = `Hi, ${currentUser.first_name} (Logout)`;
    loginBtns.forEach(btn => {
      if (btn) {
        btn.textContent = text;
        btn.onclick = logout;
      }
    });
  } else {
    const text = "Login / Register";
    loginBtns.forEach(btn => {
      if (btn) {
        btn.textContent = text;
        btn.onclick = () => openAuth("login");
      }
    });
  }
}

async function logout() {
  try {
    await fetch("includes/auth/logout.php");
    currentUser = null;
    updateNavbarState();
    showToast("Logged out successfully.");
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
  document.getElementById("bookingDate").value = "";
  renderBookingServices();
  renderTimeGrid();
  goToStep(1);
  bookingOverlay.hidden = false;
}
function closeBooking() {
  bookingOverlay.hidden = true;
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

document.getElementById("bookingDate").addEventListener("change", (e) => {
  selectedDate = e.target.value;
  selectedTime = "";
  fetchAvailableSlots();
  updateStep2NextState();
});

function goToStep(step) {
  Object.entries(bookingSteps).forEach(([key, el]) => { el.hidden = Number(key) !== step; });
  document.querySelectorAll(".stepper__step").forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle("is-active", n === step);
    el.classList.toggle("is-done", n < step);
    el.querySelector(".stepper__circle").textContent = n < step ? "✓" : n;
  });
  if (step === 2) {
    fetchAvailableSlots();
  } else if (step === 3) {
    renderSummary();
  }
}

function renderSummary() {
  const chosen = SERVICES.filter((s) => selectedServiceIds.includes(s.id));
  const totalMinutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const totalPrice = chosen.reduce((sum, s) => sum + s.price, 0);

  document.getElementById("summaryServices").innerHTML = chosen.map((s) => `
    <li>
      <div>
        <p class="name">${s.name}</p>
        <p class="desc">${s.description}</p>
      </div>
      <div>
        <p class="price">${peso(s.price)}</p>
        <p class="time">${s.duration}</p>
      </div>
    </li>
  `).join("");

  document.getElementById("summaryDetails").innerHTML = `
    <div><dt>Date</dt><dd>${selectedDate}</dd></div>
    <div><dt>Time</dt><dd>${selectedTime}</dd></div>
    <div><dt>Total Duration</dt><dd>${formatDuration(totalMinutes)}</dd></div>
    <div class="total"><dt>Total</dt><dd>${peso(totalPrice)}</dd></div>
  `;
}

document.getElementById("bookHeroBtn").addEventListener("click", () => openBooking());
document.getElementById("bookNavBtn").addEventListener("click", () => openBooking());
document.getElementById("bookNavBtnMobile").addEventListener("click", () => openBooking());
document.getElementById("bookingClose").addEventListener("click", closeBooking);
document.getElementById("bookingBackClose").addEventListener("click", closeBooking);
document.getElementById("toStep2").addEventListener("click", () => goToStep(2));
document.getElementById("toStep1").addEventListener("click", () => goToStep(1));
document.getElementById("toStep3").addEventListener("click", () => goToStep(3));
document.getElementById("toStep2b").addEventListener("click", () => goToStep(2));
document.getElementById("confirmBooking").addEventListener("click", async () => {
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
      closeBooking();
      showToast(`Booking confirmed! Your reference is ${data.appointment_id}.`);
      selectedServiceIds = [];
      selectedDate = "";
      selectedTime = "";
      document.getElementById("bookingDate").value = "";
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

/* ---------- Init ---------- */
document.getElementById("footerYear").textContent = new Date().getFullYear();
fetchServices();
renderReviews();
fetchFaqsPublic();