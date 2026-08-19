/* ===========================================================
   Astrid Nails & Beauty Bar — Admin Script
   Mock in-memory data, shaped like MySQL rows for an easy
   swap to real fetch() calls once the PHP backend exists.
   =========================================================== */

/* ---------- Mock data ---------- */
let services = [];

async function fetchServicesAdmin() {
  const grid = document.getElementById("galleryGrid");
  if (grid) grid.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--muted-foreground); grid-column: 1 / -1;">Loading services...</p>';
  try {
    const res = await fetch("includes/services/list.php");
    services = await res.json();
    if (document.getElementById("galleryGrid")) renderGallery();
    if (document.getElementById("popularServices") || document.getElementById("recentBookings")) renderDashboard();
  } catch (err) {
    console.error("Failed to fetch services", err);
    if (grid) grid.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--brand-pink); grid-column: 1 / -1;">Failed to load services.</p>';
  }
}

let bookings = [];

async function fetchAppointmentsAdmin() {
  const filterEl = document.getElementById("listFilter");
  const filterVal = filterEl ? filterEl.value : "All Bookings";
  try {
    const res = await fetch(`includes/appointments/list.php?status=${encodeURIComponent(filterVal)}`);
    bookings = await res.json();
    if (document.getElementById("appointmentList")) {
      const searchEl = document.getElementById("appointmentSearch");
      renderAppointmentList(searchEl ? searchEl.value : "");
    }
    if (document.getElementById("recentBookings")) renderDashboard();
  } catch (err) {
    console.error("Failed to fetch appointments", err);
  }
}

let customers = [];

async function fetchCustomersAdmin() {
  try {
    const res = await fetch("includes/customers/list.php");
    customers = await res.json();
    if (document.getElementById("historyBody")) {
      const historySearch = document.getElementById("historySearch");
      renderHistory(historySearch ? historySearch.value : "");
    }
  } catch (err) {
    console.error("Failed to fetch customers", err);
  }
}

let faqs = [];
let editingFaqId = null;

async function fetchFaqsAdmin() {
  try {
    const res = await fetch("includes/faqs/list.php");
    faqs = await res.json();
    if (document.getElementById("faqManagerList")) renderFaqManager();
  } catch (err) {
    console.error("Failed to fetch FAQs", err);
  }
}

let staffAccounts = [];

const peso = (v) =>
  `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusClass = (s) => `status-pill status-pill--${s.toLowerCase()}`;
const hasElement = (id) => Boolean(document.getElementById(id));

/* ---------- GLOBAL CONFIRM MODAL ---------- */
let confirmCallback = null;
const confirmModal = document.getElementById("globalConfirmModal");
const confirmOkBtn = document.getElementById("confirmModalOk");
const confirmCancelBtn = document.getElementById("confirmModalCancel");

if (confirmModal && confirmOkBtn && confirmCancelBtn) {
  confirmCancelBtn.addEventListener("click", () => {
    confirmModal.close();
    confirmCallback = null;
  });
  confirmOkBtn.addEventListener("click", () => {
    confirmModal.close();
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
}

function openConfirmModal(title, message, onConfirm) {
  if (!confirmModal) return;
  document.getElementById("confirmModalTitle").textContent = title;
  document.getElementById("confirmModalMessage").textContent = message;
  confirmCallback = onConfirm;
  confirmModal.showModal();
}

/* ---------- Mobile Sidebar Toggle ---------- */
const initSidebarToggle = () => {
  const toggleBtn = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".sidebar");
  if (toggleBtn && sidebar && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = "true";
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("is-open");
    });
  }
};
document.addEventListener("DOMContentLoaded", initSidebarToggle);
initSidebarToggle();

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

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const recent = document.getElementById("recentBookings");
  const popularEl = document.getElementById("popularServices");
  if (!recent || !popularEl) {
    return;
  }

  // Stat calculations
  const todayStr = new Date().toISOString().split("T")[0];
  const todaysBookings = bookings.filter((b) => b.date === todayStr);
  const pendingApprovals = bookings.filter((b) => b.status === "Pending");
  const revenueToday = todaysBookings
    .filter((b) => b.status !== "Cancelled")
    .reduce((sum, b) => sum + b.price, 0);

  const todaysBookingsEl = document.getElementById("statTodaysBookings");
  const pendingApprovalsEl = document.getElementById("statPendingApprovals");
  const revenueTodayEl = document.getElementById("statRevenueToday");
  const avgRatingEl = document.getElementById("statAvgRating");

  if (todaysBookingsEl) todaysBookingsEl.textContent = todaysBookings.length;
  if (pendingApprovalsEl) pendingApprovalsEl.textContent = pendingApprovals.length;
  if (revenueTodayEl) revenueTodayEl.textContent = peso(revenueToday);

  // Fetch real average rating from database
  fetch("includes/reviews/list.php?limit=1")
    .then((r) => r.json())
    .then((d) => {
      if (d.success && d.stats && avgRatingEl) {
        avgRatingEl.textContent = d.stats.average_rating > 0 ? d.stats.average_rating.toFixed(1) : "0.0";
      }
    })
    .catch(() => {});

  recent.innerHTML = bookings
    .slice(0, 5)
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

  // Compute booking frequency per service
  const counts = {};
  bookings.forEach((b) => {
    if (b.service) {
      b.service.split(",").forEach((sName) => {
        const clean = sName.trim();
        counts[clean] = (counts[clean] || 0) + 1;
      });
    }
  });

  const popular = services.slice().sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0)).slice(0, 5);

  if (popular.length === 0) {
    popularEl.innerHTML = '<p class="muted" style="padding:1rem; text-align:center;">No services loaded yet.</p>';
  } else {
    popularEl.innerHTML = popular
      .map((s) => {
        const bookingCnt = counts[s.name] || 0;
        return `
          <div class="card booking-row">
            <div>
              <p class="booking-row__name">${s.name}</p>
              <p class="booking-row__meta">${bookingCnt} booking${bookingCnt === 1 ? "" : "s"} recorded</p>
            </div>
            <span class="price-text" style="color:var(--brand-purple)">₱${parseFloat(s.price).toFixed(2)}</span>
          </div>
        `;
      })
      .join("");
  }
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
      <div class="gallery-card__banner" style="${s.image_path ? `background-image: url('${s.image_path}'); background-size: cover; background-position: center;` : ''}"></div>
      <div class="gallery-card__body">
        <span class="gallery-card__tag">${s.category}</span>
        <h3 class="gallery-card__name">${s.name}</h3>
        <p class="gallery-card__duration">${s.duration}</p>
        <p class="gallery-card__price">₱${s.price}</p>
        <div class="gallery-card__actions">
          <button class="btn btn--soft" data-edit="${s.id}">✏️ Edit</button>
          <button class="btn btn--danger" data-delete="${s.id}">🗑️ Delete</button>
        </div>
      </div>
    </article>
  `,
    )
    .join("");

  // DELETE
  grid.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openConfirmModal("Delete Service", "Are you sure you want to permanently delete this service?", async () => {
        const id = btn.dataset.delete;
        const formData = new FormData();
        formData.append("service_id", id);
        try {
          const res = await fetch("includes/services/delete.php", { method: "POST", body: formData });
          const data = await res.json();
          if (data.success) {
            showToast("Service removed.");
            fetchServicesAdmin();
          } else {
            showToast(data.error);
          }
        } catch (err) {
          showToast("Error deleting service.");
        }
      });
    });
  });

  // EDIT
  grid.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.edit;
      const service = services.find((s) => s.id === id);
      if (service) openServiceModal(service);
    });
  });
}

// MODAL LOGIC
const serviceModal = document.getElementById("serviceModal");
const addServiceBtn = document.getElementById("addServiceBtn");

if (addServiceBtn && serviceModal) {
  addServiceBtn.addEventListener("click", () => openServiceModal());

  const fileInput = document.getElementById("srvImage");
  const labelText = document.getElementById("srvImageLabelText");
  if (fileInput && labelText) {
    fileInput.addEventListener("change", () => {
      labelText.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : "📸 Select a Photo";
    });
  }

  const removeBtn = document.getElementById("srvRemoveImageBtn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      openConfirmModal("Remove Image", "Are you sure you want to remove this cover image? The change will take effect when you hit Save.", () => {
        document.getElementById("srvImagePreview").style.display = "none";
        removeBtn.style.display = "none";
        document.getElementById("srvRemoveImageFlag").value = "1";
      });
    });
  }

  document.getElementById("serviceModalCancel").addEventListener("click", () => serviceModal.close());
  
  document.getElementById("serviceModalSave").addEventListener("click", async () => {
    const id = document.getElementById("srvId").value;
    const name = document.getElementById("srvName").value;
    const category = document.getElementById("srvCategory").value;
    const desc = document.getElementById("srvDesc").value;
    const price = document.getElementById("srvPrice").value;
    const duration = document.getElementById("srvDuration").value;
    
    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", category);
    formData.append("description", desc);
    formData.append("price", price);
    formData.append("duration_minutes", duration);
    
    const fileInput = document.getElementById("srvImage");
    if (fileInput.files.length > 0) {
      formData.append("image", fileInput.files[0]);
    }
    const removeImageFlag = document.getElementById("srvRemoveImageFlag");
    if (removeImageFlag && removeImageFlag.value === "1") {
      formData.append("remove_image", "1");
    }
    
    let endpoint = "includes/services/create.php";
    if (id) {
      formData.append("service_id", id);
      endpoint = "includes/services/update.php";
    }
    
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        serviceModal.close();
        showToast(id ? "Service updated." : "Service created.");
        fetchServicesAdmin();
      } else {
        showToast(data.error);
      }
    } catch (err) {
      showToast("Error saving service.");
    }
  });
}

function openServiceModal(service = null) {
  document.getElementById("serviceModalTitle").textContent = service ? "Edit Service" : "Add Service";
  document.getElementById("srvId").value = service ? service.id : "";
  document.getElementById("srvName").value = service ? service.name : "";
  document.getElementById("srvCategory").value = service ? service.category : "";
  document.getElementById("srvDesc").value = service ? service.description : "";
  document.getElementById("srvPrice").value = service ? service.price : "";
  document.getElementById("srvDuration").value = service ? service.minutes : "";
  document.getElementById("srvImage").value = "";
  
  const labelText = document.getElementById("srvImageLabelText");
  if (labelText) labelText.textContent = "📸 Select a Photo";
  
  const preview = document.getElementById("srvImagePreview");
  const removeBtn = document.getElementById("srvRemoveImageBtn");
  const removeFlag = document.getElementById("srvRemoveImageFlag");
  
  if (removeFlag) removeFlag.value = "0";
  
  if (service && service.image_path) {
    preview.style.backgroundImage = `url('${service.image_path}')`;
    preview.style.display = "block";
    if (removeBtn) removeBtn.style.display = "block";
  } else {
    preview.style.backgroundImage = "none";
    preview.style.display = "none";
    if (removeBtn) removeBtn.style.display = "none";
  }
  
  serviceModal.showModal();
}

/* ---------- Appointment history ---------- */
function renderHistory(filterText = "") {
  const q = filterText.trim().toLowerCase();
  const rows = customers.filter((c) =>
    [c.name, c.email, c.phone].some((v) => (v || "").toLowerCase().includes(q)),
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
          <button class="btn btn--brand btn--sm" data-custview="${c.id}">View</button>
          <button class="btn btn--soft btn--sm" data-custedit="${c.id}">Edit</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  body.querySelectorAll("[data-custview]").forEach((btn) => {
    btn.addEventListener("click", () => openCustomerDetailModal(btn.dataset.custview));
  });
  body.querySelectorAll("[data-custedit]").forEach((btn) => {
    btn.addEventListener("click", () => openCustomerEditModal(btn.dataset.custedit));
  });
}

/* ---------- Customer Detail & Edit Modal Handlers ---------- */
async function openCustomerDetailModal(id) {
  const modal = document.getElementById("customerDetailModal");
  const title = document.getElementById("custDetailTitle");
  const meta = document.getElementById("custDetailMeta");
  const body = document.getElementById("custDetailBody");
  if (!modal || !body) return;

  body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1rem;color:#888;">Loading appointment history...</td></tr>`;
  modal.showModal();

  try {
    const res = await fetch(`includes/customers/detail.php?customer_id=${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!data.success) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--brand-pink);">${data.error || "Failed to load history."}</td></tr>`;
      return;
    }

    title.textContent = `History — ${data.customer.name}`;
    meta.textContent = `${data.customer.email} · ${data.customer.phone}`;

    if (data.appointments.length === 0) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1rem;color:#888;">No appointment history found for this customer.</td></tr>`;
      return;
    }

    body.innerHTML = data.appointments
      .map(
        (a) => `
      <tr>
        <td style="font-weight:600">${a.id}</td>
        <td>${a.date}<br /><span style="font-size:0.75rem" class="muted">${a.time}</span></td>
        <td>${a.service}</td>
        <td style="font-weight:600">${peso(a.price)}</td>
        <td><span class="${statusClass(a.status)}">${a.status}</span></td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--brand-pink);">Error loading history.</td></tr>`;
  }
}

const custDetailClose = document.getElementById("custDetailClose");
if (custDetailClose) {
  custDetailClose.addEventListener("click", () => {
    document.getElementById("customerDetailModal")?.close();
  });
}

function openCustomerEditModal(id) {
  const c = customers.find((x) => x.id == id);
  if (!c) return;

  const modal = document.getElementById("customerEditModal");
  if (!modal) return;

  document.getElementById("editCustId").value = c.id;
  document.getElementById("editCustFirstName").value = c.first_name || "";
  document.getElementById("editCustLastName").value = c.last_name || "";
  document.getElementById("editCustEmail").value = c.email || "";
  document.getElementById("editCustPhone").value = c.phone || "";

  modal.showModal();
}

const editCustCancel = document.getElementById("editCustCancel");
if (editCustCancel) {
  editCustCancel.addEventListener("click", () => {
    document.getElementById("customerEditModal")?.close();
  });
}

const customerEditForm = document.getElementById("customerEditForm");
if (customerEditForm) {
  customerEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(customerEditForm);

    try {
      const res = await fetch("includes/customers/update.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Customer contact info updated successfully!");
        document.getElementById("customerEditModal")?.close();
        fetchCustomersAdmin();
      } else {
        showToast(data.error || "Failed to update customer info.");
      }
    } catch (err) {
      showToast("Error updating customer contact info.");
    }
  });
}

const historySearch = document.getElementById("historySearch");
if (historySearch) {
  historySearch.addEventListener("input", (e) => renderHistory(e.target.value));
}

/* ---------- Appointment list ---------- */
let selectedRescheduleApp = null;
let selectedRescheduleTime = "";

function renderAppointmentList(filterQuery = "") {
  const list = document.getElementById("appointmentList");
  if (!list) {
    return;
  }

  const query = filterQuery.toLowerCase().trim();
  const filtered = query
    ? bookings.filter((b) =>
        (b.id || "").toLowerCase().includes(query) ||
        (b.customer || "").toLowerCase().includes(query) ||
        (b.email || "").toLowerCase().includes(query) ||
        (b.phone || "").toLowerCase().includes(query) ||
        (b.service || "").toLowerCase().includes(query)
      )
    : bookings;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="card"><p class="muted" style="font-size:0.875rem">No matching appointments found.</p></div>`;
    return;
  }

  list.innerHTML = filtered
    .map((b) => {
      let actionButtons = "";
      if (b.status === "Pending") {
        actionButtons = `
          <button class="btn btn--brand btn--sm" data-confirm="${b.id}">Confirm</button>
          <button class="btn btn--soft btn--sm" data-reschedule="${b.id}">Reschedule</button>
          <button class="btn btn--danger btn--sm" data-cancel="${b.id}">Cancel</button>
        `;
      } else if (b.status === "Confirmed") {
        actionButtons = `
          <button class="btn btn--brand btn--sm" data-complete="${b.id}">Complete</button>
          <button class="btn btn--soft btn--sm" data-reschedule="${b.id}">Reschedule</button>
          <button class="btn btn--danger btn--sm" data-cancel="${b.id}">Cancel</button>
        `;
      }

      return `
        <div class="card booking-row" data-id="${b.id}">
          <div>
            <p class="booking-row__name"><span style="font-weight:700; color:var(--brand-purple, #6b21a8); font-size:0.95rem; margin-right:0.4rem;">[${b.id}]</span> ${b.customer}</p>
            <p class="booking-row__meta">${b.email} · ${b.phone}</p>
            <p style="margin-top:0.25rem;font-size:0.875rem">${b.service} — <span class="muted">${b.time}</span></p>
          </div>
          <div class="booking-row__right">
            <span class="price-text">${peso(b.price)}</span>
            <span class="${statusClass(b.status)}">${b.status}</span>
            ${actionButtons}
            <button class="btn btn--soft btn--sm" data-view-detail="${b.id}">👁️ Details</button>
          </div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll("[data-view-detail]").forEach((btn) => {
    btn.addEventListener("click", () => openAppointmentDetailModal(btn.dataset.viewDetail));
  });
  list.querySelectorAll("[data-confirm]").forEach((btn) => {
    btn.addEventListener("click", () => setBookingStatus(btn.dataset.confirm, "Confirmed"));
  });
  list.querySelectorAll("[data-complete]").forEach((btn) => {
    btn.addEventListener("click", () => setBookingStatus(btn.dataset.complete, "Completed"));
  });
  list.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.cancel;
      openConfirmModal("Cancel Appointment", `Are you sure you want to cancel appointment ${id}?`, () => {
        setBookingStatus(id, "Cancelled");
      });
    });
  });
  list.querySelectorAll("[data-reschedule]").forEach((btn) => {
    btn.addEventListener("click", () => openRescheduleModal(btn.dataset.reschedule));
  });
}

/* ---------- Appointment Detail Modal Handler ---------- */
function openAppointmentDetailModal(id) {
  const b = bookings.find((item) => item.id === id);
  if (!b) return;

  const modal = document.getElementById("appointmentDetailModal");
  if (!modal) return;

  document.getElementById("detailAppId").textContent = b.id;
  document.getElementById("detailCustomerName").textContent = b.customer;
  document.getElementById("detailCustomerContact").textContent = b.phone || "-";
  document.getElementById("detailCustomerEmail").textContent = b.email || "-";
  document.getElementById("detailDate").textContent = b.date || "-";
  document.getElementById("detailTimeDuration").textContent = `${b.time} (${b.duration_minutes || 60} mins)`;
  document.getElementById("detailTotalPrice").textContent = peso(b.price || 0);

  const statusPill = document.getElementById("detailStatusPill");
  if (statusPill) {
    statusPill.textContent = b.status;
    statusPill.className = statusClass(b.status);
  }

  const servicesList = document.getElementById("detailServicesList");
  if (servicesList) {
    if (b.service_items && b.service_items.length > 0) {
      servicesList.innerHTML = b.service_items
        .map(
          (s) => `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; padding:0.4rem 0.6rem; background:#f9f9f9; border-radius:6px;">
          <span><strong>${s.name}</strong> <span class="muted" style="font-size:0.75rem">(${s.category})</span></span>
          <span style="font-weight:600">${peso(parseFloat(s.price))}</span>
        </div>
      `,
        )
        .join("");
    } else {
      servicesList.innerHTML = `<div style="font-size:0.85rem; color:#666;">${b.service}</div>`;
    }
  }

  modal.showModal();
}

const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
if (closeDetailModalBtn) {
  closeDetailModalBtn.addEventListener("click", () => {
    document.getElementById("appointmentDetailModal")?.close();
  });
}

async function setBookingStatus(id, status) {
  const formData = new FormData();
  formData.append("appointment_id", id);
  formData.append("status", status);

  try {
    const res = await fetch("includes/appointments/update_status.php", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Appointment ${id} status set to ${status}.`);
      fetchAppointmentsAdmin();
    } else {
      showToast(data.error || "Failed to update appointment status.");
    }
  } catch (err) {
    showToast("Error updating appointment status.");
  }
}

/* ---------- Reschedule Modal Handler ---------- */
function openRescheduleModal(id) {
  selectedRescheduleApp = bookings.find((b) => b.id === id);
  if (!selectedRescheduleApp) return;

  const modal = document.getElementById("rescheduleModal");
  if (!modal) return;

  document.getElementById("rescheduleAppId").value = id;
  document.getElementById("rescheduleSub").textContent = `Rescheduling ${id} for ${selectedRescheduleApp.customer} (${selectedRescheduleApp.service})`;
  
  const dateInput = document.getElementById("rescheduleDate");
  const targetDate = selectedRescheduleApp.date || new Date().toISOString().split("T")[0];
  if (rescheduleDatePicker) {
    rescheduleDatePicker.setDate(targetDate);
  } else if (dateInput) {
    dateInput.value = targetDate;
  }
  selectedRescheduleTime = "";

  modal.showModal();
  fetchRescheduleSlots();
}

let rescheduleDatePicker;
if (typeof flatpickr !== "undefined" && document.getElementById("rescheduleDate")) {
  rescheduleDatePicker = flatpickr("#rescheduleDate", {
    minDate: "today",
    dateFormat: "Y-m-d",
    onChange: function () {
      selectedRescheduleTime = "";
      fetchRescheduleSlots();
    },
  });
} else if (document.getElementById("rescheduleDate")) {
  document.getElementById("rescheduleDate").addEventListener("change", () => {
    selectedRescheduleTime = "";
    fetchRescheduleSlots();
  });
}

async function fetchRescheduleSlots() {
  if (!selectedRescheduleApp) return;
  const dateVal = document.getElementById("rescheduleDate").value;
  const grid = document.getElementById("rescheduleTimeGrid");
  if (!dateVal || !grid) return;

  grid.innerHTML = `<p style="font-size:0.85rem; color:#888; grid-column: 1 / -1;">Checking slots...</p>`;

  try {
    const duration = selectedRescheduleApp.duration_minutes || 60;
    const res = await fetch(`includes/appointments/available_slots.php?date=${encodeURIComponent(dateVal)}&duration_minutes=${duration}&exclude_id=${encodeURIComponent(selectedRescheduleApp.id)}`);
    const slots = await res.json();

    if (!Array.isArray(slots)) {
      grid.innerHTML = `<p style="font-size:0.85rem; color:var(--brand-pink); grid-column: 1 / -1;">Failed to load slots.</p>`;
      return;
    }

    grid.innerHTML = slots.map((s) => `
      <button 
        type="button"
        class="time-slot ${selectedRescheduleTime === s.time ? "is-selected" : ""} ${!s.available ? "time-slot--unavailable" : ""}" 
        data-rtime="${s.time}" 
        ${!s.available ? "disabled" : ""}
      >${s.time}</button>
    `).join("");

    grid.querySelectorAll("[data-rtime]:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRescheduleTime = btn.dataset.rtime;
        grid.querySelectorAll("[data-rtime]").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      });
    });
  } catch (err) {
    grid.innerHTML = `<p style="font-size:0.85rem; color:var(--brand-pink); grid-column: 1 / -1;">Error checking slots.</p>`;
  }
}

const rescheduleDateInput = document.getElementById("rescheduleDate");
if (rescheduleDateInput) {
  rescheduleDateInput.addEventListener("change", () => {
    selectedRescheduleTime = "";
    fetchRescheduleSlots();
  });
}

const rescheduleCancelBtn = document.getElementById("rescheduleCancel");
if (rescheduleCancelBtn) {
  rescheduleCancelBtn.addEventListener("click", () => {
    document.getElementById("rescheduleModal")?.close();
  });
}

const rescheduleSaveBtn = document.getElementById("rescheduleSave");
if (rescheduleSaveBtn) {
  rescheduleSaveBtn.addEventListener("click", async () => {
    if (!selectedRescheduleApp || !selectedRescheduleTime) {
      showToast("Please select a date and an available time slot.");
      return;
    }

    const dateVal = document.getElementById("rescheduleDate").value;
    const formData = new FormData();
    formData.append("appointment_id", selectedRescheduleApp.id);
    formData.append("new_date", dateVal);
    formData.append("new_time", selectedRescheduleTime);

    try {
      const res = await fetch("includes/appointments/reschedule.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Appointment ${selectedRescheduleApp.id} rescheduled successfully!`);
        document.getElementById("rescheduleModal")?.close();
        fetchAppointmentsAdmin();
      } else {
        showToast(data.error || "Failed to reschedule appointment.");
      }
    } catch (err) {
      showToast("Error processing reschedule request.");
    }
  });
}

const listFilterEl = document.getElementById("listFilter");
if (listFilterEl) {
  listFilterEl.addEventListener("change", () => fetchAppointmentsAdmin());
}

const appointmentSearch = document.getElementById("appointmentSearch");
if (appointmentSearch) {
  appointmentSearch.addEventListener("input", (e) => renderAppointmentList(e.target.value));
}

/* ---------- FAQ manager ---------- */
function renderFaqManager() {
  const list = document.getElementById("faqManagerList");
  if (!list) {
    return;
  }

  if (faqs.length === 0) {
    list.innerHTML = `<div class="card"><p class="muted" style="font-size:0.875rem">No FAQs found. Click + Add FAQ to create one.</p></div>`;
    return;
  }

  list.innerHTML = faqs
    .map((f) => {
      if (editingFaqId === f.id) {
        return `
          <div class="card" data-id="${f.id}">
            <div style="display:flex; flex-direction:column; gap:0.5rem">
              <label style="font-size:0.85rem; font-weight:600">Question</label>
              <input type="text" id="editFaqQ_${f.id}" value="${f.q ? f.q.replace(/"/g, '&quot;') : ''}" style="padding:0.5rem; border:1px solid #ccc; border-radius:4px; font-family:inherit;" />
              <label style="font-size:0.85rem; font-weight:600; margin-top:0.25rem;">Answer</label>
              <textarea id="editFaqA_${f.id}" style="padding:0.5rem; border:1px solid #ccc; border-radius:4px; font-family:inherit; min-height:70px;">${f.a || ''}</textarea>
              <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem">
                <button class="btn btn--soft btn--sm" data-cancel-faq="${f.id}">Cancel</button>
                <button class="btn btn--brand btn--sm" data-save-faq="${f.id}">Save</button>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="card" data-id="${f.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem">
            <button class="faq-toggle" style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;font-weight:500;color:inherit;padding:0">
              <span>${f.q}</span>
              <span>▾</span>
            </button>
            <button class="btn btn--soft btn--sm" data-edit-faq="${f.id}">✏️ Edit</button>
            <button class="btn btn--danger btn--sm" data-delete-faq="${f.id}">🗑️ Delete</button>
          </div>
          <p class="faq-answer muted" style="display:none;margin-top:0.75rem;font-size:0.875rem;border-top:1px solid var(--border);padding-top:0.75rem">${f.a}</p>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".faq-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const answer = btn.closest(".card").querySelector(".faq-answer");
      answer.style.display = answer.style.display === "none" ? "block" : "none";
    });
  });

  list.querySelectorAll("[data-edit-faq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingFaqId = Number(btn.dataset.editFaq);
      renderFaqManager();
    });
  });

  list.querySelectorAll("[data-cancel-faq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingFaqId = null;
      renderFaqManager();
    });
  });

  list.querySelectorAll("[data-save-faq]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.saveFaq;
      const qInput = document.getElementById(`editFaqQ_${id}`);
      const aInput = document.getElementById(`editFaqA_${id}`);
      if (!qInput || !aInput) return;

      const qVal = qInput.value.trim();
      const aVal = aInput.value.trim();

      if (!qVal || !aVal) {
        showToast("Question and answer cannot be empty.");
        return;
      }

      const formData = new FormData();
      formData.append("faq_id", id);
      formData.append("question", qVal);
      formData.append("answer", aVal);

      try {
        const res = await fetch("includes/faqs/update.php", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          showToast("FAQ updated.");
          editingFaqId = null;
          fetchFaqsAdmin();
        } else {
          showToast(data.error || "Failed to update FAQ.");
        }
      } catch (err) {
        showToast("Error updating FAQ.");
      }
    });
  });

  list.querySelectorAll("[data-delete-faq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteFaq;
      openConfirmModal("Delete FAQ", "Are you sure you want to delete this FAQ?", async () => {
        const formData = new FormData();
        formData.append("faq_id", id);
        try {
          const res = await fetch("includes/faqs/delete.php", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.success) {
            showToast("FAQ removed.");
            fetchFaqsAdmin();
          } else {
            showToast(data.error || "Failed to delete FAQ.");
          }
        } catch (err) {
          showToast("Error deleting FAQ.");
        }
      });
    });
  });
}

const addFaqBtn = document.getElementById("addFaqBtn");
if (addFaqBtn) {
  addFaqBtn.addEventListener("click", async () => {
    const formData = new FormData();
    formData.append("question", "");
    formData.append("answer", "");

    try {
      const res = await fetch("includes/faqs/create.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("New FAQ added!");
        editingFaqId = data.id;
        fetchFaqsAdmin();
      } else {
        showToast(data.error || "Failed to add FAQ.");
      }
    } catch (err) {
      showToast("Error adding FAQ.");
    }
  });
}

/* ---------- About editor ---------- */
async function fetchAboutAdmin() {
  const nameInput = document.getElementById("aboutName");
  const descInput = document.getElementById("aboutDesc");
  const missionInput = document.getElementById("aboutMission");
  if (!nameInput || !descInput || !missionInput) return;

  try {
    const res = await fetch("includes/about/get.php");
    const data = await res.json();
    nameInput.value = data.salon_name || "";
    descInput.value = data.description || "";
    missionInput.value = data.mission_statement || "";
  } catch (err) {
    console.error("Failed to fetch About content", err);
  }
}

const saveAboutBtn = document.getElementById("saveAboutBtn");
if (saveAboutBtn) {
  saveAboutBtn.addEventListener("click", async () => {
    const nameVal = document.getElementById("aboutName")?.value.trim();
    const descVal = document.getElementById("aboutDesc")?.value.trim();
    const missionVal = document.getElementById("aboutMission")?.value.trim();

    if (!nameVal || !descVal || !missionVal) {
      showToast("All fields are required.");
      return;
    }

    const formData = new FormData();
    formData.append("salon_name", nameVal);
    formData.append("description", descVal);
    formData.append("mission_statement", missionVal);

    try {
      const res = await fetch("includes/about/update.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Changes saved");
      } else {
        showToast(data.error || "Failed to save changes.");
      }
    } catch (err) {
      showToast("Error saving About content.");
    }
  });
}

/* ---------- Account management ---------- */
async function fetchStaffAccountsAdmin() {
  const body = document.getElementById("accountsBody");
  if (!body) return;

  try {
    const res = await fetch("includes/staff/list.php");
    if (!res.ok) return;
    staffAccounts = await res.json();
    renderAccounts();
  } catch (err) {
    console.error("Failed to fetch staff accounts", err);
  }
}

function renderAccounts() {
  const body = document.getElementById("accountsBody");
  if (!body) return;

  if (!Array.isArray(staffAccounts) || staffAccounts.length === 0) {
    body.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center; padding:1.5rem;">No staff accounts found.</td></tr>`;
    return;
  }

  body.innerHTML = staffAccounts
    .map(
      (a) => `
    <tr data-id="${a.account_id}">
      <td style="font-weight:500">${a.name}</td>
      <td class="muted">${a.position}</td>
      <td><span class="status-pill status-pill--${a.role === 'Super Admin' ? 'completed' : 'pending'}">${a.role}</span></td>
      <td class="muted">${a.contact_number || '-'}</td>
      <td class="muted">${a.email}</td>
      <td>${a.username}</td>
      <td><span class="status-pill status-pill--${a.status.toLowerCase()}">${a.status}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn--soft btn--sm" data-edit-staff="${a.account_id}">Edit</button>
          <button class="btn btn--soft btn--sm" data-reset-pw="${a.account_id}">Reset Password</button>
          <button class="btn btn--${a.status === 'Active' ? 'danger' : 'brand'} btn--sm" data-toggle-status="${a.account_id}">${a.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  body.querySelectorAll("[data-edit-staff]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.editStaff);
      const acc = staffAccounts.find((a) => Number(a.account_id) === id);
      if (!acc) return;

      document.getElementById("staffModalTitle").textContent = "Edit Staff Account";
      document.getElementById("staffAccountId").value = acc.account_id;
      document.getElementById("staffName").value = acc.name;
      document.getElementById("staffPosition").value = acc.position;
      document.getElementById("staffRole").value = acc.role;
      document.getElementById("staffEmail").value = acc.email;
      document.getElementById("staffContact").value = acc.contact_number || "";
      document.getElementById("staffAddress").value = acc.address || "";
      document.getElementById("staffCreateOnlyFields").style.display = "none";

      document.getElementById("staffModal").showModal();
    });
  });

  body.querySelectorAll("[data-reset-pw]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.resetPw);
      const acc = staffAccounts.find((a) => Number(a.account_id) === id);
      if (!acc) return;

      document.getElementById("resetAccountId").value = acc.account_id;
      document.getElementById("resetStaffNameText").textContent = `Resetting password for ${acc.name} (${acc.username})`;
      document.getElementById("newPasswordInput").value = "";
      document.getElementById("resetPasswordModal").showModal();
    });
  });

  body.querySelectorAll("[data-toggle-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.toggleStatus);
      const acc = staffAccounts.find((a) => Number(a.account_id) === id);
      if (!acc) return;

      const actionText = acc.status === "Active" ? "deactivate" : "activate";
      openConfirmModal(
        `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Account`,
        `Are you sure you want to ${actionText} ${acc.name}'s account?`,
        async () => {
          const formData = new FormData();
          formData.append("account_id", id);
          try {
            const res = await fetch("includes/staff/toggle_status.php", {
              method: "POST",
              body: formData,
            });
            const data = await res.json();
            if (data.success) {
              showToast(`Account status updated to ${data.new_status}.`);
              fetchStaffAccountsAdmin();
            } else {
              showToast(data.error || "Failed to update account status.");
            }
          } catch (err) {
            showToast("Error updating account status.");
          }
        }
      );
    });
  });
}

const addAccountBtn = document.getElementById("addAccountBtn");
if (addAccountBtn) {
  addAccountBtn.addEventListener("click", () => {
    document.getElementById("staffModalTitle").textContent = "Add Staff Account";
    document.getElementById("staffForm").reset();
    document.getElementById("staffAccountId").value = "";
    document.getElementById("staffCreateOnlyFields").style.display = "grid";
    document.getElementById("staffModal").showModal();
  });
}

const cancelStaffModal = document.getElementById("cancelStaffModal");
if (cancelStaffModal) {
  cancelStaffModal.addEventListener("click", () => document.getElementById("staffModal").close());
}
const cancelResetModal = document.getElementById("cancelResetModal");
if (cancelResetModal) {
  cancelResetModal.addEventListener("click", () => document.getElementById("resetPasswordModal").close());
}

const staffForm = document.getElementById("staffForm");
if (staffForm) {
  staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("staffAccountId").value;
    const isEdit = Boolean(id);
    const endpoint = isEdit ? "includes/staff/update.php" : "includes/staff/create.php";
    const formData = new FormData(staffForm);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? "Staff account updated." : "Staff account created.");
        document.getElementById("staffModal").close();
        fetchStaffAccountsAdmin();
      } else {
        showToast(data.error || "Failed to save staff account.");
      }
    } catch (err) {
      showToast("Error saving staff account.");
    }
  });
}

const resetPasswordForm = document.getElementById("resetPasswordForm");
if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(resetPasswordForm);

    try {
      const res = await fetch("includes/staff/reset_password.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Password reset successfully.");
        document.getElementById("resetPasswordModal").close();
      } else {
        showToast(data.error || "Failed to reset password.");
      }
    } catch (err) {
      showToast("Error resetting password.");
    }
  });
}

/* ---------- Init ---------- */
fetchAppointmentsAdmin();
fetchServicesAdmin();
fetchCustomersAdmin();
fetchFaqsAdmin();
fetchAboutAdmin();
fetchStaffAccountsAdmin();
