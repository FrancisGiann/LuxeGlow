/* ===========================================================
   Astrid Nails & Beauty Bar — Admin Script
   Mock in-memory data, shaped like MySQL rows for an easy
   swap to real fetch() calls once the PHP backend exists.
   =========================================================== */

/* ---------- Mock data ---------- */
let services = [
  {
    id: "nail-care",
    name: "Nail Care",
    category: "Nails",
    price: 1500,
    duration: "45 minutes",
  },
  {
    id: "gel-polish",
    name: "Gel Polish",
    category: "Nails",
    price: 1500,
    duration: "1 hour",
  },
  {
    id: "nail-extension",
    name: "Nail Extensions",
    category: "Nails",
    price: 1500,
    duration: "1 hour 30 minutes",
  },
  {
    id: "lash-extension",
    name: "Lash Extension",
    category: "Lashes",
    price: 1800,
    duration: "1 hour",
  },
  {
    id: "wax-hair-removal",
    name: "Wax Hair Removal",
    category: "Waxing",
    price: 900,
    duration: "30 minutes",
  },
  {
    id: "spa-treatment",
    name: "Spa Treatment",
    category: "Spa",
    price: 1200,
    duration: "1 hour",
  },
  {
    id: "kiddie-package",
    name: "Kiddie Package",
    category: "Packages",
    price: 700,
    duration: "30 minutes",
  },
  {
    id: "gentleman-package",
    name: "Gentleman Package",
    category: "Packages",
    price: 1400,
    duration: "1 hour",
  },
  {
    id: "massage",
    name: "Massage",
    category: "Spa",
    price: 350,
    duration: "30 minutes",
  },
];

let bookings = [
  {
    id: "BK-1041",
    customer: "Maria Santos",
    email: "maria.santos@email.com",
    phone: "0917 221 4488",
    service: "Gel Polish",
    time: "Today, 2:00 PM",
    price: 1500,
    status: "Confirmed",
  },
  {
    id: "BK-1040",
    customer: "Jasmine Reyes",
    email: "jasmine.reyes@email.com",
    phone: "0918 553 1102",
    service: "Lash Extension",
    time: "Today, 11:30 AM",
    price: 1800,
    status: "Completed",
  },
  {
    id: "BK-1039",
    customer: "Andrea Lim",
    email: "andrea.lim@email.com",
    phone: "0921 447 9080",
    service: "Spa Treatment",
    time: "Tomorrow, 10:00 AM",
    price: 1200,
    status: "Pending",
  },
  {
    id: "BK-1038",
    customer: "Paolo Cruz",
    email: "paolo.cruz@email.com",
    phone: "0906 118 2277",
    service: "Gentleman Package",
    time: "Tomorrow, 4:30 PM",
    price: 1400,
    status: "Confirmed",
  },
  {
    id: "BK-1037",
    customer: "Kim Dela Cruz",
    email: "kim.dc@email.com",
    phone: "0995 330 7712",
    service: "Nail Extensions",
    time: "June 18, 1:00 PM",
    price: 1500,
    status: "Pending",
  },
];

const customers = [
  {
    name: "Maria Santos",
    email: "maria.santos@email.com",
    phone: "0917 221 4488",
    visits: 12,
    spent: 18400,
    lastVisit: "June 9, 2026",
  },
  {
    name: "Jasmine Reyes",
    email: "jasmine.reyes@email.com",
    phone: "0918 553 1102",
    visits: 7,
    spent: 11250,
    lastVisit: "June 2, 2026",
  },
  {
    name: "Andrea Lim",
    email: "andrea.lim@email.com",
    phone: "0921 447 9080",
    visits: 4,
    spent: 5600,
    lastVisit: "May 21, 2026",
  },
  {
    name: "Paolo Cruz",
    email: "paolo.cruz@email.com",
    phone: "0906 118 2277",
    visits: 9,
    spent: 13800,
    lastVisit: "May 30, 2026",
  },
  {
    name: "Kim Dela Cruz",
    email: "kim.dc@email.com",
    phone: "0995 330 7712",
    visits: 2,
    spent: 2900,
    lastVisit: "April 14, 2026",
  },
];

let faqs = [
  {
    q: "What are your operating hours?",
    a: "We are open Monday to Saturday from 10:00 AM to 8:00 PM, and Sundays from 11:00 AM to 6:00 PM.",
  },
  {
    q: "What services do you offer?",
    a: "Nail care, gel polish, nail extensions, lash extensions, waxing, spa treatments, massages, and curated kiddie and gentleman packages.",
  },
  {
    q: "Are your products safe and hygienic?",
    a: "Yes. All tools are sterilized after every client, single-use items are never reused, and we only use certified, cruelty-free products.",
  },
  {
    q: "Do I need to book an appointment?",
    a: "Walk-ins are welcome when slots allow, but booking online guarantees your preferred stylist and time slot.",
  },
];

let staffAccounts = [
  {
    name: "Astrid Villanueva",
    position: "Super Admin",
    contact: "0917 000 1122",
    email: "astrid@astridnails.com",
    address: "12 Mabini St, Quezon City",
    username: "astrid.admin",
    password: "Ast#2026luxe",
    status: "Active",
  },
  {
    name: "Rina Bautista",
    position: "Salon Manager",
    contact: "0918 224 5566",
    email: "rina@astridnails.com",
    address: "8 Katipunan Ave, Quezon City",
    username: "rina.mgr",
    password: "Rina#2026",
    status: "Active",
  },
  {
    name: "Joy Mercado",
    position: "Nail Technician",
    contact: "0927 883 4410",
    email: "joy@astridnails.com",
    address: "45 Aurora Blvd, Manila",
    username: "joy.tech",
    password: "Joy#2026",
    status: "Active",
  },
  {
    name: "Leah Ramos",
    position: "Front Desk",
    contact: "0933 771 9021",
    email: "leah@astridnails.com",
    address: "3 Rizal St, Pasig",
    username: "leah.desk",
    password: "Leah#2026",
    status: "Inactive",
  },
];

const peso = (v) =>
  `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusClass = (s) => `status-pill status-pill--${s.toLowerCase()}`;
const hasElement = (id) => Boolean(document.getElementById(id));

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const recent = document.getElementById("recentBookings");
  const popularEl = document.getElementById("popularServices");
  if (!recent || !popularEl) {
    return;
  }

  recent.innerHTML = bookings
    .map(
      (b) => `
    <div class="card booking-row">
      <div>
        <p class="booking-row__name">${b.customer}</p>
        <p class="booking-row__meta">${b.service} · ${b.time}</p>
      </div>
      <div class="booking-row__right">
        <span class="price-text">${peso(b.price)}</span>
        <span class="${statusClass(b.status)}">${b.status}</span>
      </div>
    </div>
  `,
    )
    .join("");

  const popular = services.slice(0, 4);
  popularEl.innerHTML = popular
    .map(
      (s, i) => `
    <div class="card booking-row">
      <div>
        <p class="booking-row__name">${s.name}</p>
        <p class="booking-row__meta">${58 - i * 9} bookings this month</p>
      </div>
      <span class="price-text" style="color:var(--brand-purple)">₱${s.price}</span>
    </div>
  `,
    )
    .join("");
}

/* ---------- Services gallery ---------- */
function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) {
    return;
  }

  grid.innerHTML = services
    .map(
      (s) => `
    <article class="gallery-card" data-id="${s.id}">
      <div class="gallery-card__banner"></div>
      <div class="gallery-card__body">
        <span class="gallery-card__tag">${s.category}</span>
        <h3 class="gallery-card__name">${s.name}</h3>
        <p class="gallery-card__duration">${s.duration}</p>
        <p class="gallery-card__price">₱${s.price}</p>
        <div class="gallery-card__actions">
          <button class="btn btn--soft">✏️ Edit</button>
          <button class="btn btn--danger" data-delete="${s.id}">🗑️ Delete</button>
        </div>
      </div>
    </article>
  `,
    )
    .join("");

  grid.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      services = services.filter((s) => s.id !== btn.dataset.delete);
      renderGallery();
      renderDashboard();
      showToast("Service removed.");
    });
  });
}

const addServiceBtn = document.getElementById("addServiceBtn");
if (addServiceBtn) {
  addServiceBtn.addEventListener("click", () => {
    const id = `new-${Date.now()}`;
    services.push({
      id,
      name: "New Service",
      category: "Nails",
      price: 1000,
      duration: "45 minutes",
    });
    renderGallery();
    showToast("Service added — edit the details.");
  });
}

/* ---------- Appointment history ---------- */
function renderHistory(filterText = "") {
  const q = filterText.trim().toLowerCase();
  const rows = customers.filter((c) =>
    [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(q)),
  );

  const body = document.getElementById("historyBody");
  if (!body) {
    return;
  }

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--muted-foreground)">No customers match "${filterText}".</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (c) => `
    <tr>
      <td style="font-weight:500">${c.name}</td>
      <td class="muted">${c.email}<br /><span style="font-size:0.75rem">${c.phone}</span></td>
      <td>${c.visits}</td>
      <td style="font-weight:600;color:var(--brand-pink)">${peso(c.spent)}</td>
      <td class="muted">${c.lastVisit}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn--brand btn--sm">View</button>
          <button class="btn btn--soft btn--sm">Edit</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

const historySearch = document.getElementById("historySearch");
if (historySearch) {
  historySearch.addEventListener("input", (e) => renderHistory(e.target.value));
}

/* ---------- Appointment list ---------- */
function renderAppointmentList(filter = "All Bookings") {
  const visible =
    filter === "All Bookings"
      ? bookings
      : bookings.filter((b) => b.status === filter);
  const list = document.getElementById("appointmentList");
  if (!list) {
    return;
  }

  if (visible.length === 0) {
    list.innerHTML = `<div class="card"><p class="muted" style="font-size:0.875rem">No bookings in this status.</p></div>`;
    return;
  }

  list.innerHTML = visible
    .map(
      (b) => `
    <div class="card booking-row" data-id="${b.id}">
      <div>
        <p class="booking-row__name">${b.customer}</p>
        <p class="booking-row__meta">${b.email} · ${b.phone}</p>
        <p style="margin-top:0.25rem;font-size:0.875rem">${b.service} — <span class="muted">${b.time}</span></p>
      </div>
      <div class="booking-row__right">
        <span class="price-text">${peso(b.price)}</span>
        <span class="${statusClass(b.status)}">${b.status}</span>
        <button class="btn btn--brand btn--sm" data-confirm="${b.id}">Confirm</button>
        <button class="btn btn--soft btn--sm">Reschedule</button>
        <button class="btn btn--danger btn--sm" data-cancel="${b.id}">Cancel</button>
      </div>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll("[data-confirm]").forEach((btn) => {
    btn.addEventListener("click", () =>
      setBookingStatus(btn.dataset.confirm, "Confirmed"),
    );
  });
  list.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", () =>
      setBookingStatus(btn.dataset.cancel, "Cancelled"),
    );
  });
}

function setBookingStatus(id, status) {
  bookings = bookings.map((b) => (b.id === id ? { ...b, status } : b));
  const listFilter = document.getElementById("listFilter");
  renderAppointmentList(listFilter ? listFilter.value : "All Bookings");
  renderDashboard();
}

const listFilter = document.getElementById("listFilter");
if (listFilter) {
  listFilter.addEventListener("change", (e) =>
    renderAppointmentList(e.target.value),
  );
}

/* ---------- FAQ manager ---------- */
function renderFaqManager() {
  const list = document.getElementById("faqManagerList");
  if (!list) {
    return;
  }

  list.innerHTML = faqs
    .map(
      (f, i) => `
    <div class="card" data-index="${i}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem">
        <button class="faq-toggle" style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;font-weight:500;color:inherit;padding:0">
          <span>${f.q}</span>
          <span>▾</span>
        </button>
        <button class="btn btn--soft btn--sm">✏️ Edit</button>
        <button class="btn btn--danger btn--sm" data-delete-faq="${i}">🗑️ Delete</button>
      </div>
      <p class="faq-answer muted" style="display:none;margin-top:0.75rem;font-size:0.875rem;border-top:1px solid var(--border);padding-top:0.75rem">${f.a}</p>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll(".faq-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const answer = btn.closest(".card").querySelector(".faq-answer");
      answer.style.display = answer.style.display === "none" ? "block" : "none";
    });
  });
  list.querySelectorAll("[data-delete-faq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      faqs.splice(Number(btn.dataset.deleteFaq), 1);
      renderFaqManager();
      showToast("FAQ removed.");
    });
  });
}

const addFaqBtn = document.getElementById("addFaqBtn");
if (addFaqBtn) {
  addFaqBtn.addEventListener("click", () => {
    faqs.push({ q: "New question", a: "Add your answer here." });
    renderFaqManager();
  });
}

/* ---------- About editor ---------- */
const saveAboutBtn = document.getElementById("saveAboutBtn");
if (saveAboutBtn) {
  saveAboutBtn.addEventListener("click", () => showToast("Changes saved"));
}

/* ---------- Account management ---------- */
function renderAccounts() {
  const body = document.getElementById("accountsBody");
  if (!body) {
    return;
  }

  body.innerHTML = staffAccounts
    .map(
      (a) => `
    <tr>
      <td style="font-weight:500">${a.name}</td>
      <td class="muted">${a.position}</td>
      <td class="muted">${a.contact}</td>
      <td class="muted">${a.email}</td>
      <td class="muted">${a.address}</td>
      <td>${a.username}</td>
      <td><button class="reveal-btn" data-reveal="${a.username}">••••••••</button></td>
      <td><span class="${statusClass(a.status)}">${a.status}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn--soft btn--sm">Edit</button>
          <button class="btn btn--danger btn--sm" data-remove="${a.username}">Remove</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  body.querySelectorAll("[data-reveal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const account = staffAccounts.find(
        (a) => a.username === btn.dataset.reveal,
      );
      btn.textContent =
        btn.textContent === "••••••••" ? account.password : "••••••••";
    });
  });
  body.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      staffAccounts = staffAccounts.filter(
        (a) => a.username !== btn.dataset.remove,
      );
      renderAccounts();
      showToast("Account removed.");
    });
  });
}

const addAccountBtn = document.getElementById("addAccountBtn");
if (addAccountBtn) {
  addAccountBtn.addEventListener("click", () =>
    showToast("Open the add-account form here."),
  );
}

/* ---------- Init ---------- */
renderDashboard();
renderGallery();
renderHistory();
renderAppointmentList();
renderFaqManager();
renderAccounts();
