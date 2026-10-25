import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logoutToPublicHome } from "../utils/manualLogout";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusPill";
import { Spinner } from "../components/ui/Spinner";
import { AdminDialog } from "../components/admin/AdminDialog";
import { BrandLogo } from "../components/branding/BrandLogo";
import { useToast } from "../components/ui/Toast";
import { useToastControls } from "../components/ui/ToastControls";
import { StaffNotificationBell } from "../components/admin/StaffNotificationBell";
import { ReviewModerationPanel } from "../components/admin/ReviewModerationPanel";
import { ScheduleSettings } from "../components/admin/ScheduleSettings";
import { formatPeso } from "../utils/format";
import { isStaffRole } from "../utils/roles";
import { getHeadInviteState } from "../utils/staffInvitations";
import {
  curateHomepageServices,
  supportsHomepageCuration,
} from "../utils/services";
import { serviceImageUrl } from "../utils/serviceImages";
import {
  serviceCategoryOptions as categoryOptionsForType,
  serviceSubcategoryOptions as subcategoryOptionsFor,
  serviceTypeOptions,
} from "../utils/serviceMetadata";
import {
  deleteFaq,
  getAdminAbout,
  getCustomerHistory,
  inviteStaff,
  listAdminAppointments,
  listAdminFaqs,
  listAdminProfiles,
  listAdminStaffMembers,
  listAdminServices,
  markAppointmentArrived,
  respondToNoShow,
  resetStaffPassword,
  reviewRescheduleRequest,
  saveFaq,
  saveService,
  setServiceActive,
  setServiceHomepageFeatured,
  updateAdminAbout,
  updateAdminProfile,
  updateAdminStaffMember,
  updateAppointmentStatus,
  uploadServiceImage,
} from "../api/admin";
import {
  STAFF_POSITION_TITLE_MAX_LENGTH,
  normalizeStaffPositionTitle,
} from "../utils/staffPositionTitle";
import {
  adminNavGroupForTab,
  appointmentFilterPreset,
  appointmentQueueEmptyMessage,
  createInitialAppointmentFilters,
  getAppointmentStaffName,
  getAdminAppointmentQueue,
  manilaDateKey,
} from "../utils/adminAppointments";
import {
  canRecordAppointmentArrival,
  findDueNoShowAppointment,
} from "../utils/noShowAppointments";
import {
  closeAdminStatusConfirmation,
  runAdminStatusConfirmation,
} from "../utils/adminStatusConfirmation";
import { activateStaffAccountImmediately } from "../utils/adminStaffActivation";
import { getAdminAppointmentActions } from "../utils/adminAppointmentActions";
import { createStaffDirectory } from "../utils/staffDirectory";
import { pendingReschedule, requestedTimeLabel, rescheduleOutcome } from "../utils/rescheduleRequests";
import { RescheduleRequestHistory } from "../components/booking/RescheduleRequestHistory";
import { StaffDirectory } from "../components/admin/StaffDirectory";

const createServiceDraft = () => ({
  id: globalThis.crypto.randomUUID(),
  name: "",
  category: "",
  subcategory: "",
  item_type: "service",
  price: "",
  duration_minutes: 60,
  description: "",
  is_active: true,
});
import {
  IconArrowRight,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconGrid,
  IconMenu,
  IconSearch,
  IconSparkle,
  IconStar,
  IconUser,
  IconX,
} from "../components/icons";

const TERMINAL_APPOINTMENT_STATUSES = new Set(["Completed", "Cancelled"]);
const NAV_GROUPS = [
  {
    id: "daily-work",
    label: "Daily work",
    items: [
      ["appointments", "Appointments", IconCalendar],
      ["history", "History", IconGrid],
      ["customers", "Customers", IconUser],
    ],
  },
  {
    id: "salon-setup",
    label: "Salon setup",
    items: [
      ["catalog", "Services", IconSparkle],
      ["schedule", "Hours & closures", IconClock],
    ],
    adminOnly: true,
  },
  {
    id: "website-content",
    label: "Website content",
    items: [
      ["faqs", "FAQs", IconCheckCircle],
      ["about", "Business info", IconGrid],
        ["reviews", "Review approvals", IconStar],
    ],
    adminOnly: true,
  },
  {
    id: "people-access",
    label: "Accounts management",
    items: [["staff", "Accounts", IconUser]],
    adminOnly: true,
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const SERVICE_PAGE_SIZE = 10;
const CUSTOMER_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 5;

const ADMIN_MOBILE_MENU_ID = "admin-mobile-menu";

function AdminWorkspaceBrand({ onNavigate }) {
  return (
    <div className="flex justify-center border-b border-line px-5 py-2">
      <Link to="/" aria-label="Astrid Nails & Beauty Bar home" onClick={onNavigate} className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800">
        <BrandLogo className="h-20 w-20" />
      </Link>
    </div>
  );
}

function AdminNav({ tab, setTab, isAdmin, onNavigate }) {
  const groups = NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin);
  const [openGroup, setOpenGroup] = useState(
    () => adminNavGroupForTab(tab) || "daily-work",
  );
  useEffect(() => {
    setOpenGroup(adminNavGroupForTab(tab));
  }, [tab]);
  const idPrefix = useId();
  return (
    <nav aria-label="Staff sections" className="flex flex-col gap-2 px-3 py-6">
      {groups.map((group) => {
        const expanded = openGroup === group.id;
        const activeItem = group.items.find(([key]) => key === tab);
        const panelId = idPrefix + "-group-" + group.id;
        return (
          <section key={group.id}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() =>
                setOpenGroup((current) =>
                  current === group.id ? null : group.id,
                )
              }
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-ink-700 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
            >
              <span className="min-w-0 flex-1">
                {group.label}
                {activeItem && !expanded && (
                  <span className="mt-0.5 block truncate text-xs font-medium text-brand-800">
                    Current: {activeItem[1]}
                  </span>
                )}
              </span>
              <IconArrowRight
                size={15}
                aria-hidden="true"
                className={
                  "shrink-0 text-ink-500 transition-transform " +
                  (expanded ? "rotate-90" : "")
                }
              />
            </button>
            <div
              id={panelId}
              hidden={!expanded}
              className="mt-1 flex flex-col gap-1"
            >
              {group.items.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setOpenGroup(adminNavGroupForTab(key));
                    onNavigate?.();
                  }}
                  aria-current={tab === key ? "page" : undefined}
                  className={
                    "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 " +
                    (tab === key
                      ? "bg-blush-100 font-bold text-brand-800"
                      : "font-medium text-ink-600 hover:bg-canvas hover:text-ink-900")
                  }
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

function AdminWorkspaceFooter({ onLogout, onNavigate }) {
  return (
    <div className="mt-auto border-t border-line p-4">
      <p className="text-xs text-ink-500">Workspace</p>
      <button
        type="button"
        onClick={() => {
          onLogout();
          onNavigate?.();
        }}
        className="mt-1 flex min-h-11 w-full items-center rounded-lg px-3 text-sm font-semibold text-danger hover:bg-blush-50"
      >
        Log out
      </button>
    </div>
  );
}

function AdminRail({ tab, setTab, isAdmin, onLogout }) {
  return (
    <aside className="hidden border-r border-line bg-surface lg:block">
      <div className="sticky top-0 flex h-screen w-[210px] flex-col">
        <AdminWorkspaceBrand />
        <AdminNav tab={tab} setTab={setTab} isAdmin={isAdmin} />
        <AdminWorkspaceFooter onLogout={onLogout} />
      </div>
    </aside>
  );
}

function AdminMobileDrawer({
  open,
  onClose,
  tab,
  setTab,
  isAdmin,
  onLogout,
  pageTitle,
}) {
  const closeButtonRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = drawer
        ? [...drawer.querySelectorAll("button:not([disabled]), a[href]")]
        : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (
        previouslyFocused instanceof HTMLElement &&
        document.body.contains(previouslyFocused)
      )
        previouslyFocused.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div id={ADMIN_MOBILE_MENU_ID} className="fixed inset-0 z-[1050] lg:hidden">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default border-0 bg-ink-900/50"
        onClick={onClose}
        aria-label="Close navigation"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-mobile-menu-title"
        className="absolute inset-y-0 left-0 flex w-[320px] max-w-[calc(100vw-1rem)] flex-col bg-surface shadow-pop"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <AdminWorkspaceBrand onNavigate={onClose} />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="mr-3 mt-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-canvas hover:text-ink-900"
          >
            <IconX size={19} />
          </button>
        </div>
        <div className="border-b border-line px-5 py-4">
          <h2
            id="admin-mobile-menu-title"
            className="font-display text-lg font-medium text-ink-900"
          >
            Navigation
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Current section:{" "}
            <span className="font-semibold text-ink-900">{pageTitle}</span>
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminNav
            tab={tab}
            setTab={setTab}
            isAdmin={isAdmin}
            onNavigate={onClose}
          />
        </div>
        <AdminWorkspaceFooter onLogout={onLogout} onNavigate={onClose} />
      </aside>
    </div>
  );
}

function isTerminalAppointment(appointment) {
  return TERMINAL_APPOINTMENT_STATUSES.has(appointment?.status);
}

function statusConfirmationCopy(status) {
  if (status === "Confirmed")
    return { title: "Confirm appointment?", button: "Confirm appointment" };
  if (status === "Completed")
    return { title: "Mark appointment completed?", button: "Mark completed" };
  return { title: "Update appointment?", button: "Update status" };
}

function serviceNames(appointment) {
  return (appointment?.services || [])
    .map((service) => service.service_name)
    .filter(Boolean);
}

function attendanceTimeLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function staffDisplayName(profile) {
  return (
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    profile?.email ||
    "Team member"
  );
}

function localDateLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")))
    return "Date unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function noShowPromptDetails(appointment) {
  return {
    id: String(appointment.id),
    reference: appointment.reference_no || "Reference unavailable",
    customerName:
      [appointment.customer?.first_name, appointment.customer?.last_name]
        .filter(Boolean)
        .join(" ") || "Customer details unavailable",
    customerPhone: String(appointment.customer?.phone || "").trim() || "No phone recorded",
    date: localDateLabel(appointment.local_date),
    time: appointment.local_time?.slice(0, 5) || "Time unavailable",
  };
}

function PaginationControls({
  page,
  pageCount,
  total,
  pageSize,
  label,
  onPageChange,
}) {
  if (!total) return null;
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
      aria-label={`${label} pages`}
    >
      <p className="text-sm text-ink-500">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-sm font-semibold text-ink-600">
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage >= pageCount}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function appointmentCancellationReason(appointment) {
  return String(appointment?.cancellation_reason || "").trim()
    || String(appointment?.customer_cancellation_reason || "").trim()
    || "No reason recorded";
}

function AppointmentRow({ appointment, selected, onSelect, index, showCancellationReason }) {
  const customer = appointment.customer || {};
  const gridColumns = showCancellationReason
    ? "lg:grid-cols-[minmax(8rem,0.8fr)_minmax(10rem,1.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(7.5rem,7.5rem)]"
    : "lg:grid-cols-[minmax(8rem,0.8fr)_minmax(10rem,1.2fr)_minmax(0,1.5fr)_minmax(7.5rem,7.5rem)]";
  return (
    <li className={`border-b border-line last:border-b-0 ${index % 2 ? "bg-blush-100" : "bg-surface"}`}>
      <button
        type="button"
        onClick={(event) => onSelect(appointment, event.currentTarget)}
        className={`block w-full px-3 py-2.5 text-left leading-relaxed transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-800 ${selected ? "bg-brand-50 ring-2 ring-inset ring-brand-400" : ""}`}
      >
        <div className={`grid min-h-16 items-center gap-x-4 gap-y-2 ${gridColumns}`}>
          <span className="grid min-w-0 gap-0.5 lg:block">
            <span className="text-xs font-semibold text-ink-500 lg:hidden">Date &amp; time</span>
            <span className="block font-display text-base font-medium leading-snug text-ink-900">{appointment.local_time?.slice(0, 5) || "—"}</span>
            <span className="block break-words text-xs leading-snug text-ink-600">{appointment.local_date || "Date unavailable"}</span>
          </span>
          <span className="grid min-w-0 gap-0.5 break-words lg:block">
            <span className="text-xs font-semibold text-ink-500 lg:hidden">Customer</span>
            <span className="block text-sm font-bold leading-snug text-ink-900">{[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer details unavailable"}</span>
          </span>
          <span className="grid min-w-0 gap-0.5 break-words text-sm leading-snug text-ink-700 lg:block">
            <span className="text-xs font-semibold text-ink-500 lg:hidden">Services</span>
            <span>{serviceNames(appointment).join(", ") || "No services"}</span>
          </span>
          {showCancellationReason && (
            <span className="grid min-w-0 gap-0.5 break-words text-sm leading-snug text-ink-700 lg:block">
              <span className="text-xs font-semibold text-ink-500 lg:hidden">Cancellation reason</span>
              <span>{appointmentCancellationReason(appointment)}</span>
            </span>
          )}
          <span className="grid justify-start gap-0.5 lg:block lg:justify-self-end lg:whitespace-nowrap">
            <span className="text-xs font-semibold text-ink-500 lg:hidden">Status</span>
            <span className="inline-flex rounded-full bg-surface p-0.5 shadow-sm"><StatusPill status={appointment.status} size="sm" /></span>
          </span>
        </div>
      </button>
    </li>
  );
}

function AppointmentDetailsActions({
  appointment,
  role,
  onRequestStatus,
  onReschedule,
  onMarkArrived,
  arrivalBusy = false,
  arrivalError = "",
  onViewInAppointments,
}) {
  const [arrivalClock, setArrivalClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setArrivalClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const terminal = isTerminalAppointment(appointment);
  const arrivalAvailable = canRecordAppointmentArrival(appointment, arrivalClock);
  const hasArrivalTime = Number.isFinite(Date.parse(appointment.start_at));
  const isStaff = role === "admin" || role === "head";
  const statusActions = getAdminAppointmentActions(appointment.status, role);
  const primaryActions = statusActions.filter((action) => action.variant === "primary");
  const secondaryActions = statusActions.filter((action) => action.variant !== "primary");
  const canMarkArrived = isStaff && appointment.status === "Confirmed" && !appointment.arrived_at && onMarkArrived;
  const canReschedule = isStaff && !appointment.arrived_at && !!pendingReschedule(appointment);
  const secondaryCount = Number(!!canMarkArrived) + Number(canReschedule) + secondaryActions.length;
  const arrivalUnavailable = isStaff && appointment.status === "Confirmed" && !appointment.arrived_at && !arrivalAvailable;

  if (terminal && !onViewInAppointments && !arrivalError) return null;

  return (
    <div className="space-y-3">
      {arrivalError && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">
          {arrivalError}
        </p>
      )}
      {!terminal && (primaryActions.length > 0 || secondaryCount > 0 || arrivalUnavailable) && (
        <div className={`grid grid-cols-1 gap-3 ${primaryActions.length > 0 && secondaryCount > 0 ? "sm:grid-cols-[auto_minmax(0,1fr)]" : ""} sm:items-start`}>
          {primaryActions.length > 0 && (
            <div className="flex flex-col gap-2">
              {primaryActions.map((action) => (
                <Button
                  key={action.status}
                  type="button"
                  size="md"
                  variant="primary"
                  className="min-h-11 w-full sm:w-auto"
                  disabled={arrivalBusy}
                  onClick={() => onRequestStatus(appointment, action.status)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
          {(secondaryCount > 0 || arrivalUnavailable) && (
            <div className={`${primaryActions.length > 0 ? "border-t border-line pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0" : ""} space-y-2`}>
              {arrivalUnavailable && (
                <p className="text-xs leading-relaxed text-ink-500" role="status">
                  {hasArrivalTime
                    ? "Arrival can only be recorded on the appointment’s calendar date in Manila time."
                    : "Arrival is unavailable because the scheduled start time could not be loaded."}
                </p>
              )}
              {secondaryCount > 0 && (
                <div className={`grid gap-2 sm:flex sm:flex-wrap ${secondaryCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {canMarkArrived && (
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      className="min-h-11 w-full sm:w-auto"
                      loading={arrivalBusy}
                      disabled={arrivalBusy || !arrivalAvailable}
                      onClick={() => onMarkArrived(appointment)}
                    >
                      Person arrived
                    </Button>
                  )}
                  {canReschedule && (
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={arrivalBusy}
                      onClick={() => onReschedule(appointment)}
                    >
                      Review request
                    </Button>
                  )}
                  {secondaryActions.map((action) => (
                    <Button
                      key={action.status}
                      type="button"
                      size="sm"
                      variant="soft"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={arrivalBusy}
                      onClick={() => onRequestStatus(appointment, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {onViewInAppointments && (
        <div className="border-t border-line pt-3">
          <Button
            type="button"
            size="sm"
            variant="soft"
            className="min-h-11 w-full sm:w-auto"
            onClick={onViewInAppointments}
          >
            View in appointments
          </Button>
        </div>
      )}
    </div>
  );
}

function AppointmentDetails({
  appointment,
}) {
  const customer = appointment.customer || {};
  const terminal = isTerminalAppointment(appointment);
  const arrivedAtLabel = attendanceTimeLabel(appointment.arrived_at);
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h2 className="break-all font-display text-2xl font-medium text-ink-900">
          {appointment.reference_no || "Reference unavailable"}
        </h2>
        <StatusPill status={appointment.status} />
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
          Customer
        </h3>
        <p className="mt-3 font-semibold text-ink-900">
          {[customer.first_name, customer.last_name]
            .filter(Boolean)
            .join(" ") || "Customer details unavailable"}
        </p>
        <p className="mt-1 break-all text-sm text-ink-600">
          {customer.email || "No email"}
        </p>
        {customer.phone && (
          <p className="mt-1 text-sm text-ink-600">{customer.phone}</p>
        )}
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
          When
        </h3>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <IconCalendar size={16} className="text-brand-600" />
          {localDateLabel(appointment.local_date)}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <IconClock size={16} className="text-brand-600" />
          {appointment.local_time?.slice(0, 5) || "Time unavailable"} ·{" "}
          {appointment.total_duration_minutes || "—"} min
        </p>
        <p className="mt-2 text-sm text-ink-600">
          Team member:{" "}
          <span className="font-semibold text-ink-900">
            {getAppointmentStaffName(appointment)}
          </span>
        </p>
        {appointment.status === "Cancelled" && (
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
              Cancellation reason
            </h3>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">
              {appointmentCancellationReason(appointment)}
            </p>
          </div>
        )}
        {appointment.customer_reschedule_reason && (
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
              Latest customer reschedule reason
            </h3>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">
              {appointment.customer_reschedule_reason}
            </p>
          </div>
        )}
        {appointment.arrived_at && (
          <p className="mt-2 text-sm font-semibold text-success" role="status">
            Person arrived
            {arrivedAtLabel ? ` · ${arrivedAtLabel}` : ""}
          </p>
        )}
        {appointment.staff_id && appointment.staff_rating_count > 0 && (
          <p className="mt-2 text-sm text-ink-600">
            Published staff rating:{" "}
            <span className="font-semibold text-ink-900">
              {Number(appointment.staff_average_rating).toFixed(1)} / 5
            </span>{" "}
            <span className="text-xs text-ink-500">
              ({appointment.staff_rating_count} visit
              {appointment.staff_rating_count === 1 ? "" : "s"})
            </span>
          </p>
        )}
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
          Services
        </h3>
        {appointment.services?.length ? (
          <ul className="mt-3 divide-y divide-line">
            {appointment.services.map((service, index) => (
              <li
                key={`${appointment.id}-${service.service_name}-${index}`}
                className="flex justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 text-ink-700">
                  {service.service_name || "Unnamed service"}
                </span>
                <span className="shrink-0 font-semibold text-ink-900">
                  {formatPeso(service.unit_price)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-500">No services recorded.</p>
        )}
        <p className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-bold">
          <span>Total</span>
          <span className="font-display text-lg text-brand-800">
            {formatPeso(appointment.total_price)}
          </span>
        </p>
      </div>
      {terminal && (
        <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink-500">
          Completed and cancelled appointments are read-only.
        </p>
      )}
    </>
  );
}

function AppointmentQueue({
  appointments,
  filters,
  section,
  totalAppointments,
  selectedAppointment,
  filtersExpanded,
  headingRef,
  onToggleFilters,
  onFilterChange,
  onAllDates,
  onToday,
  onReset,
  onSelectAppointment,
}) {
  const historyView = section === "history";
  const showCancellationReason = historyView && filters.status === "Cancelled";
  const today = manilaDateKey();
  const pendingCount = appointments.filter((appointment) => appointment.status === "Pending").length;
  const confirmedCount = appointments.filter((appointment) => appointment.status === "Confirmed").length;
  const gridColumns = showCancellationReason
    ? "sm:grid-cols-[minmax(8rem,0.8fr)_minmax(10rem,1.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(7.5rem,7.5rem)]"
    : "sm:grid-cols-[minmax(8rem,0.8fr)_minmax(10rem,1.2fr)_minmax(0,1.5fr)_minmax(7.5rem,7.5rem)]";
  const filterSummary = [
    historyView ? `History · ${filters.status}` : "Pending and Confirmed appointments",
    filters.date || "All dates",
    filters.search.trim() ? `Search “${filters.search.trim()}”` : "",
  ].filter(Boolean).join(" · ");
  const allDatesActive = !filters.date;
  const todayActive = filters.date === today;
  const shortcutClass = (active) => `min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${active ? "border-brand-800 bg-brand-50 text-brand-800" : "border-line bg-surface text-ink-700 hover:border-brand-300"}`;

  const dateControls = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto]">
      <label className="min-w-0 text-sm font-semibold text-ink-900">
        Date
        <input
          type="date"
          value={filters.date}
          onChange={(event) => onFilterChange("date", event.target.value)}
          className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
      </label>
      <div className="grid grid-cols-3 gap-2 sm:contents">
        <button type="button" aria-pressed={allDatesActive} onClick={onAllDates} className={`${shortcutClass(allDatesActive)} self-end`}>
          All dates
        </button>
        <button type="button" aria-pressed={todayActive} onClick={onToday} className={`${shortcutClass(todayActive)} self-end`}>
          Today
        </button>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 self-end rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
        >
          Reset
        </button>
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden p-5 sm:p-7">
      <div className="border-b border-line pb-5">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-lg font-bold text-ink-900">
          {historyView ? "History" : "Appointments"}
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          {historyView ? "Review the full appointment log by status, including cancellation details." : "All Pending and Confirmed appointments, across every date."} Times use Asia/Manila.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-semibold text-ink-900">
          <span className="sr-only">Search appointments</span>
          <span className="relative block">
            <IconSearch
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => onFilterChange("search", event.target.value)}
              placeholder="Search appointments"
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 pl-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </span>
        </label>
        {historyView && (
          <button
            type="button"
            aria-expanded={filtersExpanded}
            aria-controls="appointment-filter-fields"
            onClick={onToggleFilters}
            className="min-h-11 shrink-0 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
          >
            Filters{filtersExpanded ? " · Hide" : ""}
          </button>
        )}
      </div>
      <div
        id="appointment-filter-fields"
        hidden={historyView && !filtersExpanded}
        className="mt-4 border-b border-line pb-4"
      >
        {historyView && (
          <label className="mb-3 block max-w-xs text-sm font-semibold text-ink-900">
            Status
            <select
              value={filters.status}
              onChange={(event) => onFilterChange("status", event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            >
              {["Pending", "Confirmed", "Completed", "Cancelled"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        )}
        {dateControls}
      </div>
      <div className="mt-4 flex flex-col gap-1 border-b border-line pb-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 break-words font-semibold text-ink-700" role="status" aria-live="polite">
          {filterSummary}
        </p>
        <p className="shrink-0 text-ink-500">
          {historyView
            ? `${appointments.length} ${appointments.length === 1 ? "record" : "records"}`
            : `${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"} · ${pendingCount} pending · ${confirmedCount} confirmed`}
        </p>
      </div>
      <div className={`mt-3 hidden min-h-12 items-center gap-x-4 border-b border-line bg-canvas px-3 py-3 text-xs font-bold uppercase leading-snug tracking-[0.12em] text-ink-500 lg:grid ${gridColumns}`}>
        <span>Date &amp; time</span>
        <span>Customer</span>
        <span>Services</span>
        {showCancellationReason && <span>Cancellation reason</span>}
        <span className="lg:text-right">Status</span>
      </div>
      <ul className="mt-1">
        {appointments.length ? (
          appointments.map((appointment, index) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              selected={selectedAppointment?.id === appointment.id}
              index={index}
              showCancellationReason={showCancellationReason}
              onSelect={onSelectAppointment}
            />
          ))
        ) : (
          <li className="py-12 text-center text-sm text-ink-500">
            {appointmentQueueEmptyMessage(totalAppointments, filters, section)}
          </li>
        )}
      </ul>
    </Card>
  );
}

function NotificationAppointmentDialog({
  state,
  appointment,
  role,
  onClose,
  onRequestStatus,
  onReschedule,
  onMarkArrived,
  arrivalBusy,
  arrivalError,
  onViewInAppointments,
}) {
  if (!state) return null;
  return (
    <AdminDialog
      open
      title="Appointment details"
      description={
        appointment
          ? "Review the latest appointment details and available actions."
          : "The appointment linked to this notification could not be displayed."
      }
      onClose={onClose}
      footer={appointment && (!isTerminalAppointment(appointment) || onViewInAppointments) ? (
        <AppointmentDetailsActions
          appointment={appointment}
          role={role}
          onRequestStatus={onRequestStatus}
          onReschedule={onReschedule}
          onMarkArrived={onMarkArrived}
          arrivalBusy={arrivalBusy}
          arrivalError={arrivalError}
          onViewInAppointments={onViewInAppointments}
        />
      ) : null}
    >
      {state.loading && (
        <div
          className="flex items-center gap-3 py-8 text-sm text-ink-500"
          role="status"
        >
          <Spinner size="sm" tone="brand" />
          Loading the latest appointment details…
        </div>
      )}
      {!state.loading && state.error && (
        <p
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
          role="alert"
        >
          {state.error}
        </p>
      )}
      {!state.loading && appointment && (
        <AppointmentDetails
          appointment={appointment}
        />
      )}
    </AdminDialog>
  );
}

function serviceTypeLabel(service) {
  if (service.item_type === "package") return "Package · fixed price";
  if (service.item_type === "add_on") return "Add-on";
  return "Service";
}

function customerDisplayName(profile) {
  const fullName = String(
    profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
  ).trim();
  return fullName || String(profile?.email || "").trim() || "Customer details";
}

function ServiceRow({
  service,
  onSaved,
  onEdit,
  editing,
  homepageCurated,
  homepageCurationSupported,
  onToggleHomepage,
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const imageUrl = serviceImageUrl(service);
  const updateImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await uploadServiceImage(service.id, file);
      if (!result.success) throw new Error(result.error);
      setMessage("Image saved.");
      await onSaved();
    } catch (uploadError) {
      setMessage(uploadError.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  const toggle = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await setServiceActive(service.id, !service.is_active);
      if (!result.success) throw new Error(result.error);
      await onSaved();
    } catch (toggleError) {
      setMessage(toggleError.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleHomepage = async () => {
    if (homepageCurationSupported === false) {
      setMessage("Homepage selection needs the latest database migration.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await onToggleHomepage(service.id, !homepageCurated);
      if (!result.success) throw new Error(result.error);
      setMessage(
        homepageCurated ? "Removed from homepage." : "Added to homepage.",
      );
      await onSaved();
    } catch (homepageError) {
      setMessage(homepageError.message);
    } finally {
      setBusy(false);
    }
  };
  const homepageDisabled =
    homepageCurationSupported === false ||
    busy ||
    (!homepageCurated && service.is_active === false);
  const homepageActionLabel = homepageCurated
    ? "Remove from homepage"
    : service.is_active === false
      ? "Activate to add"
      : "Add to homepage";
  return (
    <li
      className={`border-b border-line py-4 last:border-b-0 ${editing ? "bg-blush-50/60" : ""}`}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,22rem)] md:items-start md:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-blush-50 text-brand-300">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <IconSparkle size={20} aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 break-words font-display text-lg font-medium text-ink-900">
                {service.name}
              </p>
              {homepageCurated && (
                <span className="rounded-full border border-gold-500/50 bg-gold-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-gold-600">
                  Homepage preview
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-500">
              <span>{service.category || "Other"}</span>
              <span aria-hidden="true">·</span>
              <span>{service.subcategory || "General"}</span>
              <span aria-hidden="true">·</span>
              <span>{serviceTypeLabel(service)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="font-display font-semibold text-brand-800">
                {formatPeso(service.price)}
              </span>
              <span className="text-ink-600">
                {service.duration_minutes
                  ? `${service.duration_minutes} min`
                  : "Duration unavailable"}
              </span>
              <span
                className={`font-semibold ${service.is_active ? "text-success" : "text-danger"}`}
              >
                {service.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 md:justify-self-end md:w-full">
          <Button
            type="button"
            size="sm"
            variant="soft"
            className="min-h-11 w-full"
            disabled={busy}
            onClick={() => onEdit(service)}
          >
            Edit
          </Button>
          <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-line px-3.5 text-center text-xs font-bold text-ink-700 transition-colors hover:border-brand-300 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-800">
            {busy
              ? "Saving…"
              : service.image_path
                ? "Replace image"
                : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={updateImage}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="soft"
            className="min-h-11 w-full"
            disabled={busy}
            onClick={toggle}
          >
            {service.is_active ? "Deactivate" : "Activate"}
          </Button>
          {homepageCurationSupported === false ? (
            <Button
              type="button"
              size="sm"
              variant="soft"
              className="min-h-11 w-full sm:col-span-2"
              disabled
              title="Apply the homepage curation migration to enable this control."
            >
              Homepage setup needed
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={homepageCurated ? "soft" : "primary"}
              className="min-h-11 w-full sm:col-span-2"
              disabled={homepageDisabled}
              loading={busy}
              title={
                !homepageCurated && service.is_active === false
                  ? "Activate this service before adding it to the homepage."
                  : undefined
              }
              onClick={toggleHomepage}
            >
              {homepageActionLabel}
            </Button>
          )}
        </div>
      </div>
      {message && (
        <p
          className="mt-2 text-xs font-semibold text-ink-500 md:col-span-2"
          role="status"
        >
          {message}
        </p>
      )}
    </li>
  );
}

function ServiceMetadataFields({ form, setForm, disabled = false, isEditing = false }) {
  const typeOptions = useMemo(() => {
    const currentType = String(form.item_type || "");
    const options = serviceTypeOptions();
    if (currentType && !options.some((option) => option.value === currentType))
      options.push({
        value: currentType,
        label: `Legacy type: ${currentType}`,
      });
    return options;
  }, [form.item_type]);
  const categoryOptions = useMemo(() => {
    const currentCategory = String(form.category || "");
    const options = categoryOptionsForType(form.item_type);
    if (
      currentCategory &&
      !options.some((option) => option.value === currentCategory)
    )
      options.push({
        value: currentCategory,
        label: `Legacy category: ${currentCategory}`,
      });
    return options;
  }, [form.item_type, form.category]);
  const subcategoryOptions = useMemo(() => {
    const currentSubcategory = String(form.subcategory || "");
    const options = subcategoryOptionsFor(form.item_type, form.category).map(
      (value) => ({ value, label: value }),
    );
    if (
      currentSubcategory &&
      !options.some((option) => option.value === currentSubcategory)
    )
      options.push({
        value: currentSubcategory,
        label: `Legacy subcategory: ${currentSubcategory}`,
      });
    return options;
  }, [form.item_type, form.category, form.subcategory]);
  const updateType = (event) => {
    const itemType = event.target.value;
    const categories = categoryOptionsForType(itemType);
    const category = itemType === "service" ? "" : categories[0]?.value || "";
    const subcategory = subcategoryOptionsFor(itemType, category)[0] || "";
    setForm((current) => ({
      ...current,
      item_type: itemType,
      category,
      subcategory,
    }));
  };
  const updateCategory = (event) => {
    const category = event.target.value;
    const subcategory =
      subcategoryOptionsFor(form.item_type, category)[0] || "";
    setForm((current) => ({ ...current, category, subcategory }));
  };
  return (
    <fieldset disabled={disabled} className="admin-service-form__classification grid gap-4 rounded-xl border border-line bg-canvas/60 p-4 sm:grid-cols-2">
      <legend className="px-1 font-display text-lg font-medium text-ink-900">
        Classification
      </legend>
      <p className="-mt-2 text-xs leading-relaxed text-ink-500 sm:col-span-2">
        Choose a type first, then its category and subcategory. Existing menu
        choices stay available when you edit a service.
      </p>
      <label className="text-sm font-semibold text-ink-900">
        Type
        <select
          required={!isEditing}
          value={form.item_type}
          onChange={updateType}
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        >
          <option value="">
            {isEditing ? "Existing type not specified" : "Select a type"}
          </option>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-ink-900">
        Category
        <select
          required={!isEditing}
          value={form.category}
          onChange={updateCategory}
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        >
          <option value="">
            {isEditing ? "Existing category not specified" : "Select a category"}
          </option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-ink-900 sm:col-span-2">
        Subcategory
        <select
          required={!isEditing}
          value={form.subcategory}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              subcategory: event.target.value,
            }))
          }
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        >
          <option value="">
            {isEditing
              ? "Existing subcategory not specified"
              : "Select a subcategory"}
          </option>
          {subcategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

function ServiceViewTabs({ view, count, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Service workspace view"
      className="mt-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1"
    >
      {[
        ["all", "All services"],
        ["homepage", `Homepage preview (${count}/6)`],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={view === value}
          aria-controls="service-list-panel"
          onClick={() => onChange(value)}
          className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${view === value ? "bg-surface text-brand-800 shadow-sm" : "text-ink-500 hover:bg-surface/70 hover:text-ink-800"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ServiceListEmpty({ homepageView, onViewAll }) {
  return (
    <li className="py-10 text-center text-sm text-ink-500">
      <p>
        {homepageView
          ? "No featured services match these filters."
          : "No services match these filters."}
      </p>
      {homepageView && (
        <button
          type="button"
          className="mt-3 min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
          onClick={onViewAll}
        >
          View all services
        </button>
      )}
    </li>
  );
}

function FaqRow({ faq, onSaved }) {
  const [form, setForm] = useState({
    question: faq.question,
    answer: faq.answer,
    display_order: faq.display_order,
    is_published: faq.is_published,
  });
  const [busy, setBusy] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteBusyRef = useRef(false);
  const save = async () => {
    setBusy(true);
    try {
      const result = await saveFaq({ id: faq.id, ...form });
      if (!result.success) throw new Error(result.error);
      onSaved();
    } catch (saveError) {
      onSaved(saveError.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (deleteBusyRef.current) return;
    deleteBusyRef.current = true;
    setBusy(true);
    setDeleteError("");
    try {
      const result = await deleteFaq(faq.id);
      if (!result.success) throw new Error(result.error);
      setDeleteConfirmationOpen(false);
      onSaved();
    } catch (removeError) {
      setDeleteError(removeError.message || "Could not delete this FAQ. Please try again.");
    } finally {
      deleteBusyRef.current = false;
      setBusy(false);
    }
  };
  const closeDeleteConfirmation = () => {
    if (deleteBusyRef.current) return;
    setDeleteConfirmationOpen(false);
    setDeleteError("");
  };
  return (
    <>
      <li className="grid gap-3 border-b border-line py-4 last:border-b-0 sm:grid-cols-[1fr_1.4fr_auto]">
        <input
          value={form.question}
          onChange={(event) =>
            setForm((current) => ({ ...current, question: event.target.value }))
          }
          className="min-h-11 rounded-lg border border-line px-3 text-sm"
          aria-label="FAQ question"
          disabled={busy}
        />
        <textarea
          value={form.answer}
          onChange={(event) =>
            setForm((current) => ({ ...current, answer: event.target.value }))
          }
          className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="FAQ answer"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <input
            type="number"
            min="0"
            value={form.display_order}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                display_order: event.target.value,
              }))
            }
            className="min-h-10 w-20 rounded-lg border border-line px-2 text-sm"
            aria-label="FAQ order"
            disabled={busy}
          />
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  is_published: event.target.checked,
                }))
              }
              disabled={busy}
            />
            Published
          </label>
          <Button type="button" size="sm" onClick={save} disabled={busy}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="soft"
            onClick={() => {
              setDeleteError("");
              setDeleteConfirmationOpen(true);
            }}
            disabled={busy}
          >
            Delete
          </Button>
        </div>
      </li>
      <AdminDialog
        open={deleteConfirmationOpen}
        title="Delete this FAQ?"
        description={`“${form.question}” will be removed from the public FAQ list.`}
        closeDisabled={busy}
        onClose={closeDeleteConfirmation}
      >
        {deleteError && (
          <p
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
            role="alert"
          >
            {deleteError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="soft"
            className="min-h-11"
            disabled={busy}
            onClick={closeDeleteConfirmation}
          >
            Keep FAQ
          </Button>
          <Button
            type="button"
            variant="danger"
            className="min-h-11"
            loading={busy}
            onClick={remove}
          >
            Delete FAQ
          </Button>
        </div>
      </AdminDialog>
    </>
  );
}

function AssignedAppointments({ appointments, staffId }) {
  const assignedAppointments = appointments
    .filter((appointment) => String(appointment.staff_id || "") === String(staffId || ""))
    .map((appointment, index) => ({ appointment, index }))
    .sort(({ appointment: left, index: leftIndex }, { appointment: right, index: rightIndex }) =>
      String(left.local_date || "\uffff").localeCompare(String(right.local_date || "\uffff")) ||
      String(left.local_time || "\uffff").localeCompare(String(right.local_time || "\uffff")) ||
      leftIndex - rightIndex,
    )
    .map(({ appointment }) => appointment);
  const blockingAppointments = assignedAppointments.filter((appointment) =>
    ["Pending", "Confirmed"].includes(appointment.status),
  );
  const otherAppointments = assignedAppointments.filter(
    (appointment) => !["Pending", "Confirmed"].includes(appointment.status),
  );

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-medium text-ink-900">
          Assigned appointments
        </h3>
        <span className="text-xs text-ink-500">
          {assignedAppointments.length} appointment
          {assignedAppointments.length === 1 ? "" : "s"}
        </span>
      </div>
      {assignedAppointments.length ? (
        <ul className="mt-3 divide-y divide-line">
          {[...blockingAppointments, ...otherAppointments].map((appointment) => (
            <li
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {appointment.reference_no}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {localDateLabel(appointment.local_date)} ·{" "}
                  {appointment.local_time?.slice(0, 5) || "Time unavailable"}{" "}
                  · {appointment.total_duration_minutes || "—"} min
                </p>
              </div>
              <StatusPill status={appointment.status} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-5 text-sm text-ink-500">
          No assigned appointments found.
        </p>
      )}
    </div>
  );
}

function TeamMemberTitleEditor({ staffMember, canManage, onSave, pending = false }) {
  const [title, setTitle] = useState(staffMember?.position_title || "");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isBusy = busy || pending;

  if (
    !canManage ||
    !staffMember ||
    staffMember.record_kind !== "staff"
  )
    return null;

  const save = async (event) => {
    event.preventDefault();
    const nextTitle = normalizeStaffPositionTitle(title);
    const currentTitle = normalizeStaffPositionTitle(
      staffMember.position_title,
    );
    setError("");
    setNotice("");
    if (nextTitle === currentTitle) {
      setNotice("Position title is unchanged.");
      return;
    }
    if (nextTitle && nextTitle.length > STAFF_POSITION_TITLE_MAX_LENGTH) {
      setError(
        `Position title must be ${STAFF_POSITION_TITLE_MAX_LENGTH} characters or fewer.`,
      );
      return;
    }
    if (busyRef.current || pending) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await onSave(staffMember.id, nextTitle);
      if (!result.success)
        throw new Error(result.error || "Could not save position title.");
      const savedTitle = normalizeStaffPositionTitle(result.position_title);
      setTitle(savedTitle || "");
    } catch (saveError) {
      setError(saveError?.message || "Could not save position title.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const inputId = `staff-position-title-${staffMember.id}`;
  return (
    <form
      onSubmit={save}
      aria-busy={isBusy}
      className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <label htmlFor={inputId} className="text-sm font-semibold text-ink-900">
        Position title
        <input
          id={inputId}
          type="text"
          maxLength={STAFF_POSITION_TITLE_MAX_LENGTH}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setError("");
            setNotice("");
          }}
          placeholder="e.g. Nail Artist"
          disabled={isBusy}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60"
        />
      </label>
      <Button
        type="submit"
        size="sm"
        className="min-h-11 w-fit justify-self-start"
        disabled={isBusy}
      >
        {isBusy ? "Saving…" : "Save title"}
      </Button>
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm font-semibold text-danger sm:col-span-2"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="text-sm font-semibold text-success sm:col-span-2"
          role="status"
        >
          {notice}
        </p>
      )}
    </form>
  );
}

function StaffAccountPanel({
  staffMember,
  appointments,
  onRequestAction,
  actionBusy,
  actionBusyLabel,
  actionFeedback,
  canManage,
}) {
  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="staff-directory-details-heading" tabIndex={-1} className="font-display text-2xl font-medium text-ink-900">
            {staffMember
              ? staffDisplayName(staffMember)
              : "Choose a person"}
            </h2>
            {staffMember && (
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-bold uppercase text-ink-600">
                {staffMember.role === "admin" ? "Admin" : "Head"}
              </span>
            )}
          </div>
          {staffMember?.email && (
            <p className="mt-1 text-sm text-ink-500">{staffMember.email}</p>
          )}
        </div>
        {staffMember && (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${staffMember.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {staffMember.is_active ? "Active account" : "Inactive account"}
          </span>
        )}
      </div>
      {staffMember && canManage && (
        <div className="mt-5 border-y border-line py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
                Account controls
              </h3>
              <p className="mt-1 text-xs text-ink-500">Manage sign-in access.</p>
            </div>
            {actionBusy && (
              <span
                className="text-xs font-semibold text-brand-800"
                role="status"
              >
                {actionBusyLabel || "Saving account change…"}
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={actionBusy}
              onClick={() =>
                onRequestAction({
                  type: "active",
                  enabled: !staffMember.is_active,
                })
              }
              className="min-h-11"
            >
              {staffMember.is_active
                ? "Deactivate account"
                : "Activate account"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={actionBusy}
              onClick={() => onRequestAction({ type: "reset" })}
              className="min-h-11"
            >
              Send password reset
            </Button>
          </div>
          {actionFeedback && actionFeedback.kind !== "busy" && (
            <p
              className={`mt-3 text-sm font-semibold ${actionFeedback.kind === "error" ? "text-danger" : "text-success"}`}
              role={actionFeedback.kind === "error" ? "alert" : "status"}
            >
              {actionFeedback.message}
            </p>
          )}
        </div>
      )}
      {!staffMember ? (
        <p className="py-8 text-sm text-ink-500">
          Select a person to view details.
        </p>
      ) : <AssignedAppointments appointments={appointments} staffId={staffMember.id} />}
    </Card>
  );
}

function TeamMemberDetailsPanel({
  staffMember,
  appointments,
  busyId,
  feedback,
  onChange,
  onSaveTitle,
  canManage,
}) {
  const isOwner = staffMember?.record_kind === "owner";
  const isBusy = staffMember && busyId === String(staffMember.id);
  return (
    <Card className="p-5 sm:p-7">
      {!staffMember ? (
        <p className="py-8 text-sm text-ink-500">Select a person to view details.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="staff-directory-details-heading" tabIndex={-1} className="font-display text-2xl font-medium text-ink-900">
                  {staffMember.full_name}
                </h2>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-bold uppercase text-ink-600">
                  {isOwner ? "Owner" : "Staff"}
                </span>
              </div>
              {staffMember.position_title && (
                <p className="mt-1 text-sm font-semibold text-brand-800">
                  {staffMember.position_title}
                </p>
              )}
              {staffMember.rating_count > 0 && (
                <p className="mt-2 text-xs font-semibold text-gold-600">
                  {Number(staffMember.average_rating).toFixed(1)} / 5 · {staffMember.rating_count} published ratings
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${staffMember.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                {staffMember.is_active ? "Active" : "Inactive"}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${staffMember.is_active && staffMember.is_bookable ? "bg-success/10 text-success" : "bg-canvas text-ink-500"}`}>
                {isOwner || !staffMember.is_bookable
                  ? "Not bookable"
                  : staffMember.is_active
                    ? "Bookable"
                    : "Bookable when active"}
              </span>
            </div>
          </div>
          {!isOwner && canManage && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={staffMember.is_active ? "soft" : "primary"}
                  className="min-h-11"
                  disabled={busyId !== null}
                  loading={Boolean(isBusy)}
                  onClick={() => onChange(staffMember, { is_active: !staffMember.is_active })}
                >
                  {staffMember.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={staffMember.is_bookable ? "soft" : "primary"}
                  className="min-h-11"
                  disabled={busyId !== null}
                  onClick={() => onChange(staffMember, { is_bookable: !staffMember.is_bookable })}
                >
                  {staffMember.is_bookable ? "Mark not bookable" : "Make bookable"}
                </Button>
              </div>
              <TeamMemberTitleEditor
                key={`${staffMember.id}:${staffMember.position_title || ""}`}
                staffMember={staffMember}
                canManage={canManage}
                onSave={onSaveTitle}
                pending={Boolean(isBusy)}
              />
            </div>
          )}
          {feedback?.id === String(staffMember.id) && feedback.kind !== "busy" && (
            <p
              className={`mt-3 text-sm font-semibold ${feedback.kind === "error" ? "text-danger" : "text-success"}`}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </p>
          )}
          <AssignedAppointments appointments={appointments} staffId={staffMember.id} />
        </>
      )}
    </Card>
  );
}

export function AdminPage() {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = useCallback(
    () => logoutToPublicHome(navigate, logout),
    [navigate, logout],
  );
  const toast = useToast();
  const { clearScope: clearToastScope } = useToastControls();
  const toastScopePrefix = useId();
  const workspaceMountedRef = useRef(false);
  const tabGenerationRef = useRef(0);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [teamRoster, setTeamRoster] = useState([]);
  const [teamRosterError, setTeamRosterError] = useState("");
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [notificationAppointmentModal, setNotificationAppointmentModal] =
    useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [serviceForm, setServiceForm] = useState(createServiceDraft);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceBusy, setServiceBusy] = useState(false);
  const serviceSaveBusyRef = useRef(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceCategory, setServiceCategory] = useState("All categories");
  const [serviceVisibility, setServiceVisibility] = useState("active");
  const [serviceView, setServiceView] = useState("all");
  const [servicePage, setServicePage] = useState(1);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "head",
  });
  const [aboutForm, setAboutForm] = useState({});
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
  const [newFaq, setNewFaq] = useState({
    question: "",
    answer: "",
    display_order: 0,
  });
  const [reschedule, setReschedule] = useState(null);
  const rescheduleSubmitRef = useRef(false);
  const rescheduleOutcomeRef = useRef(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleDialogError, setRescheduleDialogError] = useState("");
  useEffect(() => {
    if (reschedule?.resolved) rescheduleOutcomeRef.current?.focus();
  }, [reschedule?.resolved]);
  const [statusConfirm, setStatusConfirm] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const statusBusyRef = useRef(false);
  const [statusDialogError, setStatusDialogError] = useState("");
  const [arrivalBusyId, setArrivalBusyId] = useState(null);
  const [arrivalError, setArrivalError] = useState(null);
  const [noShowConfirm, setNoShowConfirm] = useState(null);
  const [noShowBusy, setNoShowBusy] = useState(false);
  const [noShowDialogError, setNoShowDialogError] = useState("");
  const [customerDialogError, setCustomerDialogError] = useState("");
  const [tab, setTabState] = useState("appointments");
  const tabRef = useRef(tab);
  const noticeGeneration = tabGenerationRef.current;
  const setTab = useCallback((nextTab) => {
    const next = typeof nextTab === "function" ? nextTab(tabRef.current) : nextTab;
    const previous = tabRef.current;
    if (next !== previous) {
      tabRef.current = next;
      tabGenerationRef.current += 1;
      clearToastScope(`${toastScopePrefix}:${previous}`);
      if (next !== "appointments") setNoShowConfirm(null);
    }
    if (next !== "appointments") setSelectedAppointment(null);
    setTabState(next);
  }, [clearToastScope, toastScopePrefix]);
  const setNotice = (message) => {
    if (
      !workspaceMountedRef.current ||
      tabRef.current !== tab ||
      tabGenerationRef.current !== noticeGeneration
    ) return;
    const scope = `${toastScopePrefix}:${tab}`;
    if (!message) {
      clearToastScope(scope);
      return;
    }
    toast(message, "success", {
      duration: 5000,
      scope,
      dismissible: true,
      replaceScope: true,
    });
  };
  const [appointmentFilters, setAppointmentFilters] = useState(() =>
    createInitialAppointmentFilters(),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);
  const appointmentQueueHeadingRef = useRef(null);
  const appointmentReturnFocusRef = useRef(null);
  const [appointmentFiltersExpanded, setAppointmentFiltersExpanded] = useState(false);
  const historyRequestRef = useRef(0);
  const notificationAppointmentRequestRef = useRef(0);
  const noShowDismissedIdsRef = useRef(new Set());
  const [selectedStaffKey, setSelectedStaffKey] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteDialogError, setInviteDialogError] = useState("");
  const [staffAction, setStaffAction] = useState(null);
  const [staffActionBusy, setStaffActionBusy] = useState(false);
  const [staffActionError, setStaffActionError] = useState("");
  const staffActivationBusyRef = useRef(false);
  const [staffActivationBusyId, setStaffActivationBusyId] = useState(null);
  const [staffActivationFeedback, setStaffActivationFeedback] = useState(null);
  const rosterBusyRef = useRef(null);
  const [rosterBusyId, setRosterBusyId] = useState(null);
  const [rosterFeedback, setRosterFeedback] = useState(null);

  useEffect(() => {
    workspaceMountedRef.current = true;
    return () => {
      workspaceMountedRef.current = false;
      NAV_ITEMS.forEach(([key]) => {
        clearToastScope(`${toastScopePrefix}:${key}`);
      });
    };
  }, [clearToastScope, toastScopePrefix]);

  const openAppointments = useCallback((kind = "pending", appointment = null) => {
    appointmentReturnFocusRef.current = null;
    setAppointmentFilters(
      appointmentFilterPreset(kind, manilaDateKey(), appointment),
    );
    const selectedTab = kind === "history" || (kind === "appointment" && isTerminalAppointment(appointment)) ? "history" : "appointments";
    setTab(selectedTab);
    setSelectedAppointment(kind === "appointment" ? appointment : null);
  }, [setTab]);
  const setNavigationTab = useCallback((nextTab) => {
    if (nextTab === "history") {
      setAppointmentFilters(appointmentFilterPreset("history"));
      setSelectedAppointment(null);
    } else if (nextTab === "appointments") {
      setAppointmentFilters(appointmentFilterPreset("appointments"));
      setSelectedAppointment(null);
    }
    setTab(nextTab);
  }, [setTab]);
  const visibleAppointments = useMemo(
    () => getAdminAppointmentQueue(appointments, appointmentFilters, tab === "history" ? "history" : "appointments"),
    [appointments, appointmentFilters, tab],
  );
  const selectedVisibleAppointment = selectedAppointment
    ? visibleAppointments.find(
        (appointment) => appointment?.id === selectedAppointment.id,
      ) || null
    : null;
  const appointmentDetailsOpen = Boolean(
    selectedVisibleAppointment &&
    !statusConfirm &&
    !reschedule &&
    !notificationAppointmentModal &&
    !noShowConfirm,
  );
  const { disabled: inviteRoleDisabled } = getHeadInviteState(
    inviteForm.role,
    staff,
  );
  useEffect(() => {
    if (
      selectedAppointment &&
      !visibleAppointments.some(
        (appointment) => appointment?.id === selectedAppointment.id,
      )
    )
      setSelectedAppointment(null);
  }, [selectedAppointment, visibleAppointments]);

  const load = useCallback(async (initialLoad = false) => {
    if (initialLoad) setLoading(true);
    setError("");
    try {
      const [
        nextAppointments,
        nextServices,
        nextFaqs,
        nextAbout,
        nextProfiles,
        rosterResult,
      ] = await Promise.all([
        listAdminAppointments(),
        listAdminServices(),
        listAdminFaqs(),
        getAdminAbout(),
        listAdminProfiles(),
        listAdminStaffMembers()
          .then((members) => ({ members }))
          .catch((rosterLoadError) => ({ rosterLoadError })),
      ]);
      setAppointments(nextAppointments);
      setSelectedAppointment((current) =>
        current
          ? nextAppointments.find(
              (appointment) => appointment.id === current.id,
            ) || null
          : current,
      );
      setNotificationAppointmentModal((current) => {
        if (!current) return current;
        const refreshedAppointment = nextAppointments.find(
          (appointment) => String(appointment.id) === current.appointmentId,
        );
        return refreshedAppointment
          ? { ...current, appointment: refreshedAppointment, error: "" }
          : {
              ...current,
              appointment: null,
              loading: false,
              error:
                "This appointment is no longer available. It may have been deleted or you may no longer have access.",
            };
      });
      setServices(nextServices);
      setFaqs(nextFaqs);
      setAboutForm(nextAbout || {});
      setCustomers(
        nextProfiles.filter(
          (profile) =>
            profile.role === "customer" &&
            !(!profile.is_active && profile.accepts_appointments),
        ),
      );
      if (rosterResult.rosterLoadError) {
        setTeamRosterError(
          rosterResult.rosterLoadError.message || "Could not load staff details.",
        );
        setTeamRoster([]);
      } else {
        setTeamRoster(rosterResult.members);
        setTeamRosterError("");
      }
      const nextStaff = nextProfiles.filter(
        (profile) => isStaffRole(profile.role),
      );
      setStaff(nextStaff);
      const nextDirectory = createStaffDirectory(
        rosterResult.rosterLoadError ? [] : rosterResult.members,
        nextStaff,
      );
      setSelectedStaffKey((current) =>
        nextDirectory.some((entry) => entry.key === current)
          ? current
          : nextDirectory[0]?.key || "",
      );
      return nextAppointments;
    } catch (loadError) {
      setError(loadError.message || "Could not load staff workspace.");
      return [];
    } finally {
      if (initialLoad) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const checkForDueNoShows = () => {
      if (
        !isStaffRole(customer?.role) ||
        tab !== "appointments" ||
        statusConfirm ||
        reschedule ||
        notificationAppointmentModal ||
        selectedVisibleAppointment
      ) {
        if (noShowConfirm) {
          setNoShowConfirm(null);
          setNoShowDialogError("");
        }
        return;
      }
      if (noShowConfirm) {
        const latest = appointments.find(
          (appointment) => String(appointment?.id) === noShowConfirm.id,
        );
        const stillDue = latest && findDueNoShowAppointment([latest]);
        if (!stillDue) {
          setNoShowConfirm(null);
          setNoShowDialogError("");
          return;
        }
        const details = noShowPromptDetails(latest);
        const changed = Object.keys(details).some(
          (key) => details[key] !== noShowConfirm[key],
        );
        if (changed) {
          setNoShowConfirm(details);
          setNoShowDialogError("");
        }
        return;
      }
      const visibleCandidates = appointments.filter(
        (appointment) =>
          !noShowDismissedIdsRef.current.has(String(appointment?.id)),
      );
      const dueAppointment = findDueNoShowAppointment(visibleCandidates);
      if (dueAppointment) {
        setNoShowDialogError("");
        setNoShowConfirm(noShowPromptDetails(dueAppointment));
      }
    };
    const initialCheck = window.setTimeout(checkForDueNoShows, 0);
    const timer = window.setInterval(checkForDueNoShows, 30_000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
    };
  }, [appointments, customer?.role, selectedVisibleAppointment, noShowConfirm, notificationAppointmentModal, reschedule, statusConfirm, tab]);

  const closeNoShowPrompt = () => {
    if (noShowConfirm?.id) {
      noShowDismissedIdsRef.current.add(noShowConfirm.id);
    }
    setNoShowConfirm(null);
    setNoShowDialogError("");
  };

  const recordAppointmentArrival = async (appointment) => {
    const current = appointments.find(
      (item) => String(item.id) === String(appointment?.id),
    );
    if (
      !isStaffRole(customer?.role) ||
      !current ||
      current.status !== "Confirmed" ||
      current.arrived_at ||
      arrivalBusyId
    ) return;
    setArrivalBusyId(String(current.id));
    setArrivalError(null);
    setError("");
    try {
      const result = await markAppointmentArrived(current.id);
      if (!result.success) throw new Error(result.error);
      await load();
      setNotice(`Arrival recorded for ${current.reference_no}.`);
    } catch (arrivalActionError) {
      const message =
        arrivalActionError?.message || "Could not record the arrival.";
      setArrivalError({ id: String(current.id), message });
      setError(message);
    } finally {
      setArrivalBusyId(null);
    }
  };

  const respondToNoShowPrompt = async () => {
    if (!isStaffRole(customer?.role) || !noShowConfirm || noShowBusy) return;
    setNoShowBusy(true);
    setNoShowDialogError("");
    setError("");
    try {
      const result = await respondToNoShow(noShowConfirm.id, false);
      if (!result.success) throw new Error(result.error);
      if (result.outcome === "not_due") {
        setNoShowDialogError(
          "The appointment has not yet reached 15 minutes past its scheduled start according to the server clock. Try again shortly.",
        );
        return;
      }
      noShowDismissedIdsRef.current.add(noShowConfirm.id);
      await load();
      if (result.outcome === "cancelled") {
        setNotice(`Appointment ${noShowConfirm.reference} was cancelled.`);
      } else if (result.outcome === "kept") {
        setNotice(
          `No-show acknowledged for ${noShowConfirm.reference}. If no arrival is recorded, it will be cancelled automatically 24 hours after its scheduled start.`,
        );
      } else if (result.outcome === "arrived") {
        setNotice(
          `Arrival was recorded for appointment ${noShowConfirm.reference}; it remains confirmed.`,
        );
      } else if (result.outcome === "already_reviewed") {
        setNotice(
          `The no-show for ${noShowConfirm.reference} was already acknowledged by another staff member.`,
        );
      } else {
        setNotice(
          `Appointment ${noShowConfirm.reference} changed before the no-show decision was saved.`,
        );
      }
      setNoShowConfirm(null);
      setNoShowDialogError("");
    } catch (noShowActionError) {
      const message =
        noShowActionError?.message ||
        "Could not update the no-show appointment.";
      setNoShowDialogError(message);
      setError(message);
    } finally {
      setNoShowBusy(false);
    }
  };

  const closeNotificationAppointment = useCallback((preserveSelection = false) => {
    notificationAppointmentRequestRef.current += 1;
    setNotificationAppointmentModal(null);
    if (preserveSelection !== true) setSelectedAppointment(null);
  }, []);

  const openNotificationAppointment = useCallback(
    async (notification) => {
      setNoShowConfirm(null);
      setNoShowDialogError("");
      const appointmentId = String(notification?.appointment_id || "").trim();
      const requestId = notificationAppointmentRequestRef.current + 1;
      notificationAppointmentRequestRef.current = requestId;
      const currentAppointment =
        appointments.find(
          (appointment) => String(appointment.id) === appointmentId,
        ) || null;
      openAppointments("appointment", currentAppointment);
      setNotificationAppointmentModal({
        appointmentId,
        appointment: currentAppointment,
        loading: true,
        error: "",
      });
      if (!appointmentId) {
        setNotificationAppointmentModal({
          appointmentId,
          appointment: null,
          loading: false,
          error: "This notification is not linked to an appointment.",
        });
        return;
      }
      try {
        const nextAppointments = await listAdminAppointments();
        if (notificationAppointmentRequestRef.current !== requestId) return;
        const refreshedAppointments = Array.isArray(nextAppointments)
          ? nextAppointments
          : [];
        setAppointments(refreshedAppointments);
        const refreshedAppointment =
          refreshedAppointments.find(
            (appointment) => String(appointment.id) === appointmentId,
          ) || null;
        openAppointments("appointment", refreshedAppointment);
        setNotificationAppointmentModal({
          appointmentId,
          appointment: refreshedAppointment,
          loading: false,
          error: refreshedAppointment
            ? ""
            : "This appointment is no longer available. It may have been deleted or you may no longer have access.",
        });
      } catch (appointmentError) {
        if (notificationAppointmentRequestRef.current !== requestId) return;
        setNotificationAppointmentModal({
          appointmentId,
          appointment: currentAppointment,
          loading: false,
          error: currentAppointment
            ? `Could not refresh this appointment. Showing the last loaded details. ${appointmentError?.message || ""}`.trim()
            : appointmentError?.message ||
              "Could not load this appointment. It may have been deleted or you may no longer have access.",
        });
      }
    },
    [appointments, openAppointments],
  );

  const staffDirectory = useMemo(
    () => createStaffDirectory(teamRoster, staff),
    [teamRoster, staff],
  );
  const selectedStaffEntry = useMemo(
    () => staffDirectory.find((entry) => entry.key === selectedStaffKey) || null,
    [staffDirectory, selectedStaffKey],
  );
  const selectedStaff = selectedStaffEntry?.kind === "account"
    ? selectedStaffEntry.account
    : null;
  const selectedTeamMember = selectedStaffEntry?.kind === "member"
    ? selectedStaffEntry.member
    : null;

  const requestStatus = (appointment, nextStatus) => {
    const current = appointments.find((item) => item.id === appointment?.id);
    if (
      !isStaffRole(customer?.role) ||
      !current ||
      isTerminalAppointment(current) ||
      !getAdminAppointmentActions(current.status, customer?.role).some(
        (action) => action.status === nextStatus,
      )
    )
      return;
    setError("");
    setStatusDialogError("");
    setNoShowConfirm(null);
    setNoShowDialogError("");
    setStatusConfirm({
      id: current.id,
      reference: current.reference_no,
      from: current.status,
      to: nextStatus,
    });
  };

  const closeStatusDialog = () => {
    closeAdminStatusConfirmation({
      isBusy: statusBusy,
      busyRef: statusBusyRef,
      setPendingStatus: setStatusConfirm,
      setDialogError: setStatusDialogError,
    });
  };

  const confirmStatus = () => {
    void runAdminStatusConfirmation({
      pendingStatus: statusConfirm,
      appointments,
      busyRef: statusBusyRef,
      isTransitionAllowed: (current, nextStatus) =>
        !isTerminalAppointment(current) &&
        getAdminAppointmentActions(current.status, customer?.role).some(
          (action) => action.status === nextStatus,
        ),
      updateStatus: updateAppointmentStatus,
      loadAppointments: load,
      setBusy: setStatusBusy,
      setPageError: setError,
      setDialogError: setStatusDialogError,
      setSelectedAppointment,
      setPendingStatus: setStatusConfirm,
      setNotice,
    });
  };

  const resetServiceForm = () => {
    setServiceForm(createServiceDraft());
    setEditingServiceId(null);
    setError("");
    setNotice("");
  };
  const openNewService = () => {
    resetServiceForm();
    setServiceDialogOpen(true);
  };
  const editService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      id: service.id,
      name: service.name || "",
      category: service.category || "",
      subcategory: service.subcategory || "",
      item_type: service.item_type ?? "",
      price: service.price ?? "",
      duration_minutes: service.duration_minutes || 60,
      description: service.description || "",
      is_active: service.is_active !== false,
    });
    setError("");
    setNotice("");
    setServiceDialogOpen(true);
  };
  const save = async (event) => {
    event.preventDefault();
    if (serviceSaveBusyRef.current) return;
    serviceSaveBusyRef.current = true;
    setServiceBusy(true);
    setNotice("");
    try {
      const result = await saveService(
        serviceForm,
        editingServiceId ? { existingId: editingServiceId } : undefined,
      );
      if (!result.success) throw new Error(result.error);
      resetServiceForm();
      setServiceDialogOpen(false);
      setNotice("Service saved.");
      await load();
    } catch (saveError) {
      setError(saveError?.message || "Could not save this service. Try again.");
    } finally {
      serviceSaveBusyRef.current = false;
      setServiceBusy(false);
    }
  };
  const resetInviteForm = () =>
    setInviteForm({ email: "", first_name: "", last_name: "", role: "head" });
  const openInvite = () => {
    if (customer?.role !== "admin") return;
    setInviteDialogError("");
    setInviteDialogOpen(true);
  };
  const closeInvite = () => {
    if (inviteBusy) return;
    setInviteDialogOpen(false);
    setInviteDialogError("");
    resetInviteForm();
  };
  const invite = async (event) => {
    event.preventDefault();
    if (customer?.role !== "admin" || inviteBusy) return;
    setNotice("");
    setInviteDialogError("");
    setInviteBusy(true);
    try {
      const result = await inviteStaff(inviteForm);
      if (!result.success) throw new Error(result.error);
      resetInviteForm();
      setInviteDialogOpen(false);
      setNotice("Account added. Setup email sent.");
      await load();
    } catch (inviteError) {
      setInviteDialogError(
        inviteError?.message ||
          "Could not add the account or send its setup email. Check the details and try again.",
      );
    } finally {
      setInviteBusy(false);
    }
  };
  const selectCustomer = async (profile) => {
    const requestId = historyRequestRef.current + 1;
    historyRequestRef.current = requestId;
    setSelectedCustomer(profile);
    setCustomerHistory([]);
    setCustomerHistoryPage(1);
    setCustomerHistoryLoading(true);
    setError("");
    setCustomerDialogError("");
    try {
      const history = await getCustomerHistory(profile.id);
      if (historyRequestRef.current === requestId) setCustomerHistory(history);
    } catch (historyError) {
      const message =
        historyError?.message || "Could not load appointment history.";
      if (historyRequestRef.current === requestId) {
        setError(message);
        setCustomerDialogError(message);
      }
    } finally {
      if (historyRequestRef.current === requestId)
        setCustomerHistoryLoading(false);
    }
  };
  const closeCustomer = () => {
    historyRequestRef.current += 1;
    setSelectedCustomer(null);
    setCustomerHistory([]);
    setCustomerDialogError("");
  };
  const saveAbout = async (event) => {
    event.preventDefault();
    try {
      await updateAdminAbout(aboutForm);
      setNotice("Business information saved.");
      await load();
    } catch (aboutError) {
      setError(aboutError.message);
    }
  };
  const addFaq = async (event) => {
    event.preventDefault();
    try {
      const result = await saveFaq(newFaq);
      if (!result.success) throw new Error(result.error);
      setNewFaq({ question: "", answer: "", display_order: 0 });
      setNotice("FAQ saved.");
      await load();
    } catch (faqError) {
      setError(faqError.message);
    }
  };
  const saveReschedule = async (approve) => {
    if (!reschedule || rescheduleBusy || rescheduleSubmitRef.current) return;
    rescheduleSubmitRef.current = true;
    setRescheduleBusy(true);
    setRescheduleDialogError("");
    try {
      const result = await reviewRescheduleRequest(reschedule.request.id, approve, reschedule.reason || "");
      if (!result.success) throw new Error(result.error);
      const outcome = rescheduleOutcome(result.request);
      await load();
      if (!outcome.success) {
        setRescheduleDialogError(outcome.message);
        setReschedule((current) => current ? { ...current, resolved: true } : null);
        return;
      }
      setNotice(outcome.message);
      setReschedule(null);
    } catch (failure) {
      setRescheduleDialogError(failure.message || "Could not review the request. Refresh before retrying.");
    } finally {
      rescheduleSubmitRef.current = false;
      setRescheduleBusy(false);
    }
  };
  const openReschedule = (appointment) => {
    const request = pendingReschedule(appointment);
    if (!isStaffRole(customer?.role) || !request || isTerminalAppointment(appointment) || appointment.arrived_at) return;
    setError("");
    setRescheduleDialogError("");
    setNoShowConfirm(null);
    setNoShowDialogError("");
    setReschedule({ id: appointment.id, reference: appointment.reference_no, request, reason: "" });
  };
  const closeReschedule = () => {
    if (rescheduleBusy) return;
    setReschedule(null);
    setRescheduleDialogError("");
  };
  const requestNotificationStatus = (appointment, nextStatus) => {
    closeNotificationAppointment(true);
    requestStatus(appointment, nextStatus);
  };
  const rescheduleNotificationAppointment = (appointment) => {
    closeNotificationAppointment(true);
    openReschedule(appointment);
  };
  const updateRosterMember = async (member, fields) => {
    const id = String(member?.id || "");
    if (
      customer?.role !== "admin" ||
      !id ||
      rosterBusyRef.current !== null
    ) return;
    const targetName = String(member.full_name || "Team member");
    rosterBusyRef.current = id;
    setRosterBusyId(id);
    setRosterFeedback({ id, kind: "busy", message: `Saving ${targetName}…` });
    try {
      const result = await updateAdminStaffMember(id, fields);
      if (!result.success) throw new Error(result.error || "Could not update staff details.");
      setTeamRoster((current) =>
        current.map((item) =>
          String(item.id) === id ? { ...item, ...result } : item,
        ),
      );
      const message = fields.is_active !== undefined
        ? `${targetName} ${fields.is_active ? "activated" : "deactivated"}.`
        : fields.is_bookable !== undefined
          ? `${targetName} ${fields.is_bookable ? "added to" : "removed from"} booking choices.`
          : `${targetName}'s details saved.`;
      setRosterFeedback({ id, kind: "success", message });
    } catch (rosterError) {
      setRosterFeedback({
        id,
        kind: "error",
        message: rosterError?.message || "Could not update staff details.",
      });
    } finally {
      rosterBusyRef.current = null;
      setRosterBusyId(null);
    }
  };
  const saveRosterTitle = async (id, positionTitle) => {
    const targetId = String(id || "");
    if (customer?.role !== "admin" || !targetId || rosterBusyRef.current !== null) {
      return { success: false, error: "Another staff update is in progress." };
    }
    const member = teamRoster.find((item) => String(item.id) === targetId);
    if (!member || member.record_kind !== "staff") {
      return { success: false, error: "Staff member not found." };
    }
    rosterBusyRef.current = targetId;
    setRosterBusyId(targetId);
    setRosterFeedback({ id: targetId, kind: "busy", message: `Saving ${member.full_name}…` });
    try {
      const result = await updateAdminStaffMember(targetId, { position_title: positionTitle });
      if (!result.success) throw new Error(result.error || "Could not save position title.");
      const savedTitle = normalizeStaffPositionTitle(result.position_title);
      setTeamRoster((current) => current.map((item) =>
        String(item.id) === targetId ? { ...item, position_title: savedTitle } : item,
      ));
      setRosterFeedback({ id: targetId, kind: "success", message: `${member.full_name}'s position title saved.` });
      return { ...result, position_title: savedTitle };
    } catch (rosterError) {
      const error = rosterError?.message || "Could not save position title.";
      setRosterFeedback({ id: targetId, kind: "error", message: error });
      return { success: false, error };
    } finally {
      rosterBusyRef.current = null;
      setRosterBusyId(null);
    }
  };
  const requestStaffAction = (action) => {
    if (!selectedStaff || customer?.role !== "admin" || staffActionBusy) return;
    const name = staffDisplayName(selectedStaff);
    if (action.type === "active" && action.enabled === true) {
      const target = {
        id: String(selectedStaff.id),
        name,
        is_active: selectedStaff.is_active,
      };
      void activateStaffAccountImmediately({
        target,
        isAdmin: customer?.role === "admin",
        busyRef: staffActivationBusyRef,
        setBusyId: setStaffActivationBusyId,
        setFeedback: (feedback) => {
          setStaffActivationFeedback(feedback);
          if (feedback.kind === "busy") {
            setError("");
            setNotice("");
          }
          if (feedback.kind === "error") setError(feedback.message);
        },
        updateAccount: updateAdminProfile,
        onSaved: (targetId) => {
          setStaff((current) =>
            current.map((profile) =>
              String(profile.id) === targetId
                ? { ...profile, is_active: true }
                : profile,
            ),
          );
          setNotice(`${name} activated.`);
        },
      });
      return;
    }
    if (staffActivationBusyRef.current) return;
    let nextAction = null;
    if (
      action.type === "role" &&
      isStaffRole(action.nextRole) &&
      action.nextRole !== selectedStaff.role
    ) {
      nextAction = {
        type: "role",
        fields: { role: action.nextRole },
        title: `Change ${name} to ${action.nextRole === "admin" ? "admin" : "head"}?`,
        description: `This changes the account role after confirmation. The selector will keep ${selectedStaff.role} until the update succeeds.`,
        confirmLabel: `Change to ${action.nextRole === "admin" ? "admin" : "head"}`,
        variant: "primary",
      };
    } else if (action.type === "active") {
      nextAction = {
        type: "active",
        fields: { is_active: action.enabled === true },
        title: `${action.enabled ? "Activate" : "Deactivate"} ${name}?`,
        description: action.enabled
          ? "This account will be able to sign in again, subject to its role."
          : "This prevents the account from signing in. Existing assigned appointments remain in its history.",
        confirmLabel: action.enabled
          ? "Activate account"
          : "Deactivate account",
        variant: action.enabled ? "primary" : "danger",
      };
    } else if (action.type === "reset") {
      nextAction = {
        type: "reset",
        title: `Send a password reset to ${name}?`,
        description: `A recovery email will be sent to ${selectedStaff.email}. The account will not be changed until the recipient uses that link.`,
        confirmLabel: "Send reset email",
        variant: "primary",
      };
    }
    if (!nextAction) return;
    setStaffAction({
      id: selectedStaff.id,
      email: selectedStaff.email,
      name,
      ...nextAction,
    });
    setStaffActionError("");
    setError("");
  };
  const closeStaffAction = () => {
    if (staffActionBusy) return;
    setStaffAction(null);
    setStaffActionError("");
  };
  const confirmStaffAction = async () => {
    if (!staffAction || staffActionBusy) return;
    setStaffActionBusy(true);
    setStaffActionError("");
    setError("");
    try {
      if (staffAction.type === "reset") {
        const result = await resetStaffPassword(staffAction.id);
        if (!result.success) throw new Error(result.error);
        setNotice(`Password reset sent to ${staffAction.email}.`);
      } else {
        const result = await updateAdminProfile(
          staffAction.id,
          staffAction.fields,
        );
        if (!result.success) throw new Error(result.error);
        setNotice("Account updated.");
        await load();
      }
      setStaffAction(null);
      setStaffActionError("");
    } catch (staffError) {
      const message = staffError?.message || "Could not update this account.";
      setError(message);
      setStaffActionError(message);
    } finally {
      setStaffActionBusy(false);
    }
  };

  const serviceCategories = useMemo(
    () => [
      "All categories",
      ...new Set(services.map((service) => service.category || "Other")),
    ],
    [services],
  );
  const homepageCurationSupported = supportsHomepageCuration(services);
  const homepagePreviewServices = useMemo(
    () => curateHomepageServices(services, 6),
    [services],
  );
  const homepagePreviewIds = useMemo(
    () => new Set(homepagePreviewServices.map((service) => service.id)),
    [homepagePreviewServices],
  );
  const servicesInView = useMemo(
    () =>
      serviceView === "homepage"
        ? services.filter((service) => homepagePreviewIds.has(service.id))
        : services,
    [services, serviceView, homepagePreviewIds],
  );
  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLocaleLowerCase();
    return servicesInView.filter((service) => {
      const categoryMatches =
        serviceCategory === "All categories" ||
        (service.category || "Other") === serviceCategory;
      const visibilityMatches =
        serviceVisibility === "all" ||
        (serviceVisibility === "active"
          ? service.is_active
          : !service.is_active);
      const searchable = [
        service.name,
        service.category,
        service.subcategory,
        service.item_type,
        service.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        categoryMatches &&
        visibilityMatches &&
        (!term || searchable.includes(term))
      );
    });
  }, [servicesInView, serviceSearch, serviceCategory, serviceVisibility]);
  const servicePageCount = Math.max(
    1,
    Math.ceil(filteredServices.length / SERVICE_PAGE_SIZE),
  );
  useEffect(() => {
    setServicePage(1);
  }, [serviceSearch, serviceCategory, serviceVisibility, serviceView]);
  useEffect(() => {
    setServicePage((current) => Math.min(current, servicePageCount));
  }, [servicePageCount]);
  const visibleServicePage = Math.min(servicePage, servicePageCount);
  const visibleServices = filteredServices.slice(
    (visibleServicePage - 1) * SERVICE_PAGE_SIZE,
    visibleServicePage * SERVICE_PAGE_SIZE,
  );

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLocaleLowerCase();
    return customers.filter((profile) =>
      [profile.first_name, profile.last_name, profile.email, profile.phone]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [customers, customerSearch]);
  const customerPageCount = Math.max(
    1,
    Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE),
  );
  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);
  useEffect(() => {
    setCustomerPage((current) => Math.min(current, customerPageCount));
  }, [customerPageCount]);
  const visibleCustomerPage = Math.min(customerPage, customerPageCount);
  const visibleCustomers = filteredCustomers.slice(
    (visibleCustomerPage - 1) * CUSTOMER_PAGE_SIZE,
    visibleCustomerPage * CUSTOMER_PAGE_SIZE,
  );
  const customerHistoryPageCount = Math.max(
    1,
    Math.ceil(customerHistory.length / HISTORY_PAGE_SIZE),
  );
  useEffect(() => {
    setCustomerHistoryPage((current) =>
      Math.min(current, customerHistoryPageCount),
    );
  }, [customerHistoryPageCount]);
  const visibleHistoryPage = Math.min(
    customerHistoryPage,
    customerHistoryPageCount,
  );
  const visibleHistory = customerHistory.slice(
    (visibleHistoryPage - 1) * HISTORY_PAGE_SIZE,
    visibleHistoryPage * HISTORY_PAGE_SIZE,
  );
  const rescheduleTarget = reschedule
    ? appointments.find((appointment) => appointment.id === reschedule.id)
    : null;
  const notificationModalAppointment = notificationAppointmentModal
    ? appointments.find(
        (appointment) =>
          String(appointment.id) === notificationAppointmentModal.appointmentId,
      ) || notificationAppointmentModal.appointment
    : null;
  const viewNotificationAppointment = () => {
    if (!notificationModalAppointment) return;
    openAppointments("appointment", notificationModalAppointment);
    closeNotificationAppointment(true);
  };
  const pageTitle =
    NAV_ITEMS.find(([key]) => key === tab)?.[1] ||
    (tab === "staff" ? "Accounts" : "Appointments");
  const statusCopy = statusConfirmationCopy(statusConfirm?.to);
  const appointmentQueue = (
    <div className="space-y-5">
      {tab === "appointments" && <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="reschedule-queue-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="reschedule-queue-heading" className="font-semibold text-ink-900">Reschedule requests ({appointments.filter((appointment) => pendingReschedule(appointment)).length})</h2><Button type="button" variant="soft" size="sm" onClick={() => load()}>Refresh requests</Button></div>
        <p className="mt-2 text-sm text-ink-600">Current appointments stay scheduled while requests await review.</p>
        {!appointments.some((appointment) => pendingReschedule(appointment)) && <p className="mt-3 text-sm text-ink-600" role="status">No reschedule requests awaiting review.</p>}
        <ul className="mt-3 divide-y divide-line">{appointments.filter((appointment) => pendingReschedule(appointment)).map((appointment) => <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="break-words text-sm text-ink-800">{appointment.reference_no} · {requestedTimeLabel(pendingReschedule(appointment))}</span><Button type="button" variant="soft" size="sm" onClick={() => openReschedule(appointment)}>Review request</Button></li>)}</ul>
      </section>}
    <AppointmentQueue
      appointments={visibleAppointments}
      filters={appointmentFilters}
      section={tab === "history" ? "history" : "appointments"}
      totalAppointments={appointments.length}
      selectedAppointment={selectedVisibleAppointment}
      filtersExpanded={appointmentFiltersExpanded}
      headingRef={appointmentQueueHeadingRef}
      onToggleFilters={() => setAppointmentFiltersExpanded((open) => !open)}
      onFilterChange={(key, value) =>
        setAppointmentFilters((current) => ({
          ...current,
          [key]: value,
        }))
      }
      onAllDates={() =>
        setAppointmentFilters((current) => ({
          ...current,
          date: "",
        }))
      }
      onToday={() => setAppointmentFilters((current) => ({ ...current, date: manilaDateKey() }))}
      onReset={() =>
        setAppointmentFilters(createInitialAppointmentFilters(tab === "history" ? "Completed" : "Pending"))
      }
      onSelectAppointment={(appointment, trigger) => {
        appointmentReturnFocusRef.current = trigger;
        setSelectedAppointment(appointment);
      }}
    />
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[210px_1fr]">
      <AdminRail
        tab={tab}
        setTab={setNavigationTab}
        isAdmin={customer?.role === "admin"}
        onLogout={handleLogout}
      />
      <AdminMobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        tab={tab}
        setTab={setNavigationTab}
        isAdmin={customer?.role === "admin"}
        onLogout={handleLogout}
        pageTitle={pageTitle}
      />
      <main className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-20 max-w-[1500px] items-center justify-between gap-5 px-4 sm:px-7 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={mobileMenuTriggerRef}
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileMenuOpen}
                aria-controls={ADMIN_MOBILE_MENU_ID}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-700 lg:hidden"
              >
                <IconMenu />
              </button>
              <div className="min-w-0">
                <p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-ink-400 sm:block">
                  Workspace
                </p>
                <h1 className="font-display text-xl font-medium text-ink-900 sm:text-2xl">
                  {pageTitle}
                </h1>
                <p className="mt-0.5 truncate text-xs text-ink-500 sm:hidden">
                  {customer?.first_name || "Account"} ·{" "}
                  {customer?.role === "admin" ? "Administrator" : "Staff"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-ink-500 sm:block">
                {[customer?.first_name, customer?.last_name]
                  .filter(Boolean)
                  .join(" ") || "Account"}{" "}
                · {customer?.role === "admin" ? "Administrator" : "Staff"}
              </span>
              <StaffNotificationBell
                onOpenAppointments={() => openAppointments("pending")}
                onOpenAppointment={openNotificationAppointment}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 lg:hidden"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 px-4 pb-16 pt-6 sm:px-7 lg:px-10">
          {error && (
            <p
              className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
          {loading ? (
            <Card className="p-8">
              <div className="flex items-center gap-3 text-sm text-ink-500">
                <span className="h-4 w-4 animate-pulse rounded-full bg-brand-300" />
                Loading workspace…
              </div>
            </Card>
          ) : tab === "appointments" || tab === "history" || !NAV_ITEMS.some(([key]) => key === tab) ? (
            appointmentQueue
          ) : tab === "catalog" ? (
            <Card className="p-5 sm:p-7">
              <CardHeader
                title="Service menu"
                subtitle="Uploaded images appear in the homepage and compact admin, public-menu, and booking previews; the menu stays easy to scan."
                action={
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    onClick={openNewService}
                  >
                    Add service
                  </Button>
                }
              />
              <ServiceViewTabs
                view={serviceView}
                count={homepagePreviewIds.size}
                onChange={setServiceView}
              />
              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_minmax(10rem,13rem)]">
                <label className="text-sm font-semibold text-ink-900">
                  <span className="sr-only">Search services</span>
                  <span className="relative block">
                    <IconSearch
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
                    />
                    <input
                      type="search"
                      value={serviceSearch}
                      onChange={(event) => setServiceSearch(event.target.value)}
                      placeholder="Search services"
                      className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 pl-11 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                    />
                  </span>
                </label>
                <label className="text-sm font-semibold text-ink-900">
                  <span className="sr-only">Filter by category</span>
                  <select
                    value={serviceCategory}
                    onChange={(event) => setServiceCategory(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  >
                    {serviceCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-ink-900">
                  <span className="sr-only">Filter by service status</span>
                  <select
                    value={serviceVisibility}
                    onChange={(event) =>
                      setServiceVisibility(event.target.value)
                    }
                    className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  >
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                    <option value="all">All statuses</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-500">
                  {filteredServices.length} matching service
                  {filteredServices.length === 1 ? "" : "s"}
                </p>
                {(serviceSearch ||
                  serviceCategory !== "All categories" ||
                  serviceVisibility !== "active") && (
                  <button
                    type="button"
                    className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4 hover:text-brand-900"
                    onClick={() => {
                      setServiceSearch("");
                      setServiceCategory("All categories");
                      setServiceVisibility("active");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <ul
                id="service-list-panel"
                role="tabpanel"
                aria-label={
                  serviceView === "homepage"
                    ? "Homepage preview services"
                    : "All services"
                }
                className="mt-2"
              >
                {visibleServices.length ? (
                  visibleServices.map((service) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      onSaved={load}
                      onEdit={editService}
                      homepageCurated={homepagePreviewIds.has(service.id)}
                      homepageCurationSupported={homepageCurationSupported}
                      onToggleHomepage={setServiceHomepageFeatured}
                    />
                  ))
                ) : (
                  <ServiceListEmpty
                    homepageView={serviceView === "homepage"}
                    onViewAll={() => setServiceView("all")}
                  />
                )}
              </ul>
              <PaginationControls
                page={servicePage}
                pageCount={servicePageCount}
                total={filteredServices.length}
                pageSize={SERVICE_PAGE_SIZE}
                label="Service"
                onPageChange={setServicePage}
              />
            </Card>
          ) : tab === "reviews" && customer?.role === "admin" ? (
            <ReviewModerationPanel />
          ) : tab === "customers" ? (
            <Card className="p-5 sm:p-7">
              <CardHeader
                title="Customers"
                subtitle={`${customers.length} customer account${customers.length === 1 ? "" : "s"}`}
              />
              <div className="mt-5">
                <label htmlFor="admin-customer-search" className="sr-only">
                  Search customers
                </label>
                <div className="relative">
                  <IconSearch
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
                  />
                  <input
                    id="admin-customer-search"
                    type="search"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search by name, email, or phone"
                    className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 pl-11 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </div>
              <ul className="mt-3">
                {visibleCustomers.length ? (
                  visibleCustomers.map((profile) => (
                    <li
                      key={profile.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-900">
                            {customerDisplayName(profile)}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {profile.email} · {profile.phone || "No phone"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="soft"
                          className="min-h-11 shrink-0"
                          onClick={() => selectCustomer(profile)}
                        >
                          View
                        </Button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="py-10 text-center text-sm text-ink-500">
                    {customers.length
                      ? "No customers match this search."
                      : "No customer accounts yet."}
                  </li>
                )}
              </ul>
              <PaginationControls
                page={customerPage}
                pageCount={customerPageCount}
                total={filteredCustomers.length}
                pageSize={CUSTOMER_PAGE_SIZE}
                label="Customer"
                onPageChange={setCustomerPage}
              />
            </Card>
          ) : tab === "faqs" ? (
            <Card className="p-5 sm:p-7">
              <CardHeader
                title="FAQs"
                subtitle="Edit or remove the questions shown on the public site."
              />
              <ul className="mt-2">
                {faqs.map((faq) => (
                  <FaqRow
                    key={faq.id}
                    faq={faq}
                    onSaved={(message) => {
                      if (message) setError(message);
                      else load();
                    }}
                  />
                ))}
              </ul>
              <form
                onSubmit={addFaq}
                className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1.4fr_auto]"
              >
                <input
                  required
                  placeholder="Question"
                  aria-label="New FAQ question"
                  value={newFaq.question}
                  onChange={(event) =>
                    setNewFaq((form) => ({
                      ...form,
                      question: event.target.value,
                    }))
                  }
                  className="min-h-11 rounded-lg border border-line px-3 text-sm"
                />
                <textarea
                  required
                  placeholder="Answer"
                  aria-label="New FAQ answer"
                  value={newFaq.answer}
                  onChange={(event) =>
                    setNewFaq((form) => ({
                      ...form,
                      answer: event.target.value,
                    }))
                  }
                  className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm"
                />
                <Button type="submit">Add FAQ</Button>
              </form>
            </Card>
          ) : tab === "about" ? (
            <Card className="p-5 sm:p-7">
              <CardHeader
                title="Business information"
                subtitle="This content is visible on the public site."
              />
              <form
                onSubmit={saveAbout}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                {[
                  ["business_name", "Business name"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["address", "Address"],
                  ["description", "Description"],
                  ["mission_statement", "Mission statement"],
                  ["salon_policies", "Salon policies"],
                  ["map_embed_url", "Google Maps Embed URL"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="text-sm font-semibold text-ink-900"
                  >
                    {label}
                    {[
                      "description",
                      "mission_statement",
                      "business_hours",
                      "salon_policies",
                      "map_embed_url",
                    ].includes(key) ? (
                      <textarea
                        value={aboutForm[key] || ""}
                        onChange={(event) =>
                          setAboutForm((form) => ({
                            ...form,
                            [key]: event.target.value,
                          }))
                        }
                        className="mt-1 block min-h-24 w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                    ) : (
                      <input
                        required={key === "business_name"}
                        type={key === "email" ? "email" : "text"}
                        value={aboutForm[key] || ""}
                        onChange={(event) =>
                          setAboutForm((form) => ({
                            ...form,
                            [key]: event.target.value,
                          }))
                        }
                        className="mt-1 block min-h-11 w-full rounded-lg border border-line px-3 text-sm"
                      />
                    )}
                  </label>
                ))}
                <Button type="submit">Save business info</Button>
              </form>
            </Card>
          ) : tab === "schedule" ? (
            <ScheduleSettings
              onOpenAppointments={() => openAppointments("pending")}
              onOpenConflict={(conflict) => openAppointments("conflict", conflict)}
            />
          ) : tab === "staff" ? (
            <div className="space-y-6">
              {teamRosterError && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">
                  Could not load staff details. Try again in a moment.
                </p>
              )}
              <StaffDirectory
                entries={staffDirectory}
                selectedKey={selectedStaffKey}
                onSelect={setSelectedStaffKey}
                action={customer?.role === "admin" ? (
                  <Button type="button" size="sm" className="min-h-11" onClick={openInvite}>
                    Add account
                  </Button>
                ) : null}
              >
                {selectedStaffEntry?.kind === "account" ? (
                  <StaffAccountPanel
                    staffMember={selectedStaff}
                    appointments={appointments}
                    onRequestAction={requestStaffAction}
                    actionBusy={staffActionBusy || staffActivationBusyId !== null}
                    actionBusyLabel={
                      staffActivationFeedback?.kind === "busy"
                        ? staffActivationFeedback.message
                        : "Saving account change…"
                    }
                    actionFeedback={
                      staffActivationFeedback?.id === String(selectedStaff?.id || "")
                        ? staffActivationFeedback
                        : null
                    }
                    canManage={customer?.role === "admin"}
                  />
                ) : (
                  <TeamMemberDetailsPanel
                    staffMember={selectedTeamMember}
                    appointments={appointments}
                    busyId={rosterBusyId}
                    feedback={rosterFeedback}
                    onChange={updateRosterMember}
                    onSaveTitle={saveRosterTitle}
                    canManage={customer?.role === "admin"}
                  />
                )}
              </StaffDirectory>
            </div>
          ) : appointmentQueue}
        </div>
      </main>
      <NotificationAppointmentDialog
        state={notificationAppointmentModal}
        appointment={notificationModalAppointment}
        role={customer?.role}
        onClose={closeNotificationAppointment}
        onRequestStatus={requestNotificationStatus}
        onReschedule={rescheduleNotificationAppointment}
        onMarkArrived={recordAppointmentArrival}
        arrivalBusy={arrivalBusyId === String(notificationModalAppointment?.id)}
        arrivalError={
          arrivalError?.id === String(notificationModalAppointment?.id)
            ? arrivalError.message
            : ""
        }
        onViewInAppointments={viewNotificationAppointment}
      />
      <AdminDialog
        open={appointmentDetailsOpen}
        title="Appointment details"
        description="Review the booking and take the next appointment action. Times use Asia/Manila."
        size="wide"
        onClose={() => setSelectedAppointment(null)}
        returnFocusRef={appointmentReturnFocusRef}
        fallbackFocusRef={appointmentQueueHeadingRef}
        footer={selectedVisibleAppointment && !isTerminalAppointment(selectedVisibleAppointment) ? (
          <AppointmentDetailsActions
            appointment={selectedVisibleAppointment}
            role={customer?.role}
            onRequestStatus={requestStatus}
            onReschedule={openReschedule}
            onMarkArrived={recordAppointmentArrival}
            arrivalBusy={arrivalBusyId === String(selectedVisibleAppointment.id)}
            arrivalError={
              arrivalError?.id === String(selectedVisibleAppointment.id)
                ? arrivalError.message
                : ""
            }
          />
        ) : null}
      >
        {selectedVisibleAppointment && <RescheduleRequestHistory requests={selectedVisibleAppointment.reschedule_requests} />}
        {selectedVisibleAppointment && (
          <AppointmentDetails
            appointment={selectedVisibleAppointment}
          />
        )}
      </AdminDialog>
      <AdminDialog
        open={!!noShowConfirm}
        title="No arrival recorded"
        description={`No arrival is recorded for ${noShowConfirm?.reference || "this appointment"}.`}
        closeDisabled={noShowBusy}
        onClose={closeNoShowPrompt}
      >
        <dl className="divide-y divide-line rounded-xl border border-line bg-canvas px-4">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-sm text-ink-500">Customer</dt>
            <dd className="text-right text-sm font-semibold text-ink-900">{noShowConfirm?.customerName}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-sm text-ink-500">Phone</dt>
            <dd className="text-right text-sm font-semibold text-ink-900">{noShowConfirm?.customerPhone || "No phone recorded"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-sm text-ink-500">Reference</dt>
            <dd className="text-right text-sm font-semibold text-ink-900">{noShowConfirm?.reference}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-sm text-ink-500">Scheduled</dt>
            <dd className="text-right text-sm font-semibold text-ink-900">
              {noShowConfirm?.date} · {noShowConfirm?.time} (Manila)
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          The scheduled start was at least 15 minutes ago. Acknowledge this notice to record your review and dismiss repeat prompts. If no arrival is recorded, the appointment will still be cancelled automatically 24 hours after its scheduled start. Acknowledging does not prevent cancellation.
        </p>
        {noShowDialogError && (
          <p
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
            role="alert"
          >
            {noShowDialogError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="soft"
            className="min-h-11"
            disabled={noShowBusy}
            loading={noShowBusy}
            onClick={respondToNoShowPrompt}
          >
            {noShowBusy ? "Acknowledging…" : "Acknowledge"}
          </Button>
        </div>
      </AdminDialog>
      <AdminDialog
        open={!!statusConfirm}
        title={statusCopy.title}
        description={`${statusConfirm?.reference || "This appointment"} will move from ${statusConfirm?.from || "its current status"} to ${statusConfirm?.to || "the next status"}.`}
        closeDisabled={statusBusy}
        onClose={closeStatusDialog}
        returnFocusRef={appointmentReturnFocusRef}
        fallbackFocusRef={appointmentQueueHeadingRef}
      >
        <p className="text-sm leading-relaxed text-ink-600">
          Confirm this transition after checking the appointment details.
        </p>
        {statusDialogError && (
          <p
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
            role="alert"
          >
            {statusDialogError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="soft"
            className="min-h-11"
            disabled={statusBusy}
            onClick={closeStatusDialog}
          >
            Back to details
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-11"
            loading={statusBusy}
            disabled={statusBusy}
            onClick={confirmStatus}
          >
            {statusCopy.button}
          </Button>
        </div>
      </AdminDialog>
      <AdminDialog
        open={!!reschedule}
        title={`Review reschedule ${reschedule?.reference || "request"}`}
        description="Approve only the time requested by the customer. Availability is checked again on approval."
        closeDisabled={rescheduleBusy}
        onClose={closeReschedule}
        returnFocusRef={appointmentReturnFocusRef}
        fallbackFocusRef={appointmentQueueHeadingRef}
      >
        {reschedule && <div className="space-y-4">
          <p className="text-sm text-ink-800">Current appointment: {rescheduleTarget?.local_date || "—"} · {rescheduleTarget?.local_time?.slice(0, 5) || "—"} (Manila)</p>
          <p className="break-words font-semibold text-ink-900">Requested: {requestedTimeLabel(reschedule.request)}</p>
          <p className="whitespace-pre-wrap break-words text-sm text-ink-800">Customer reason: {reschedule.request.reason}</p>
          <p className="text-sm text-ink-600">The current time stays scheduled until approval. Approval keeps the booking status and assigned team member.</p>
          {rescheduleDialogError && <p ref={rescheduleOutcomeRef} tabIndex={-1} className="break-words text-sm font-semibold text-danger" role="alert">{rescheduleDialogError}</p>}
          {!reschedule.resolved && <>
            <label className="block text-sm font-semibold text-ink-900">Reason for rejection
              <textarea rows={3} maxLength={500} disabled={rescheduleBusy} value={reschedule.reason} onChange={(event) => setReschedule((current) => ({ ...current, reason: event.target.value }))} className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-3" />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="soft" disabled={rescheduleBusy || !reschedule.reason.trim()} onClick={() => saveReschedule(false)}>Reject request</Button>
              <Button type="button" loading={rescheduleBusy} disabled={rescheduleBusy} onClick={() => saveReschedule(true)}>Approve requested time</Button>
            </div>
          </>}
          <Button type="button" variant="soft" disabled={rescheduleBusy} onClick={closeReschedule}>Close</Button>
        </div>}
      </AdminDialog>
      <AdminDialog
        size="wide"
        open={serviceDialogOpen}
        title={
          editingServiceId
            ? `Edit ${serviceForm.name || "service"}`
            : "Add service"
        }
        description="Add or update the service name, price, timing, and menu details."
        closeDisabled={serviceBusy}
        onClose={() => {
          if (serviceBusy) return;
          resetServiceForm();
          setServiceDialogOpen(false);
        }}
      >
        <form onSubmit={save} className="admin-service-form grid gap-4" aria-busy={serviceBusy}>
          {[
            ["name", "Service name"],
            ["price", "Price (₱)"],
            ["duration_minutes", "Duration (minutes)"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm font-semibold text-ink-900">
              {label}
              <input
                required
                value={serviceForm[key]}
                disabled={serviceBusy}
                type={
                  key === "price" || key === "duration_minutes"
                    ? "number"
                    : "text"
                }
                min={key === "price" ? "0" : key === "duration_minutes" ? "5" : undefined}
                step={key === "price" ? "0.01" : undefined}
                onChange={(event) =>
                  setServiceForm((form) => ({
                    ...form,
                    [key]: event.target.value,
                  }))
                }
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </label>
          ))}
          <ServiceMetadataFields
            form={serviceForm}
            setForm={setServiceForm}
            disabled={serviceBusy}
            isEditing={Boolean(editingServiceId)}
          />
          <label className="admin-service-form__description text-sm font-semibold text-ink-900">
            Description
            <textarea
              disabled={serviceBusy}
              value={serviceForm.description}
              onChange={(event) =>
                setServiceForm((form) => ({
                  ...form,
                  description: event.target.value,
                }))
              }
              className="mt-1 block min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <label className="admin-service-form__published flex items-center gap-3 text-sm font-semibold text-ink-900">
            <input
              type="checkbox"
              disabled={serviceBusy}
              checked={serviceForm.is_active}
              onChange={(event) =>
                setServiceForm((form) => ({
                  ...form,
                  is_active: event.target.checked,
                }))
              }
              className="h-5 w-5 accent-brand-800"
            />
            Published in booking menu
          </label>
          {error && (
            <p
              className="admin-service-form__error rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="admin-service-form__actions flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="soft"
              className="min-h-11"
              disabled={serviceBusy}
              onClick={() => {
                if (serviceBusy) return;
                resetServiceForm();
                setServiceDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" loading={serviceBusy}>
              Save service
            </Button>
          </div>
        </form>
      </AdminDialog>
      <AdminDialog
        open={!!selectedCustomer}
        title={customerDisplayName(selectedCustomer)}
        description="Contact details and bounded appointment history."
        closeDisabled={false}
        onClose={closeCustomer}
      >
        {customerDialogError && (
          <p
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
            role="alert"
          >
            {customerDialogError}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="text-sm">
            <p className="font-semibold text-ink-500">First name</p>
            <p className="mt-1 text-ink-900">
              {selectedCustomer?.first_name || "—"}
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-ink-500">Last name</p>
            <p className="mt-1 text-ink-900">
              {selectedCustomer?.last_name || "—"}
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-ink-500">Phone</p>
            <p className="mt-1 text-ink-900">
              {selectedCustomer?.phone || "—"}
            </p>
          </div>
          <div className="text-sm sm:col-span-3">
            <p className="font-semibold text-ink-500">Email</p>
            <p className="mt-1 break-all text-ink-900">
              {selectedCustomer?.email || "—"}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-3">
            <Button
              type="button"
              variant="soft"
              className="min-h-11"
              onClick={closeCustomer}
            >
              Close
            </Button>
          </div>
        </div>
        <div className="mt-7 border-t border-line pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-medium text-ink-900">
              Appointment history
            </h3>
            {customerHistory.length > 0 && (
              <span className="text-xs text-ink-500">
                {customerHistory.length} record
                {customerHistory.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {customerHistoryLoading ? (
            <p className="py-7 text-sm text-ink-500">
              Loading appointment history…
            </p>
          ) : visibleHistory.length ? (
            <ul className="mt-3 divide-y divide-line">
              {visibleHistory.map((row) => (
                <li key={row.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold text-ink-900">
                      {row.reference_no}
                    </span>
                    <span className="font-semibold text-ink-700">
                      {localDateLabel(row.local_date)} ·{" "}
                      {row.local_time?.slice(0, 5) || "Time unavailable"}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-ink-500">
                    {serviceNames(row).join(", ") || "No services"} ·{" "}
                    {row.status} · {formatPeso(row.total_price)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-7 text-sm text-ink-500">No appointment history.</p>
          )}
          {!customerHistoryLoading && (
            <PaginationControls
              page={customerHistoryPage}
              pageCount={customerHistoryPageCount}
              total={customerHistory.length}
              pageSize={HISTORY_PAGE_SIZE}
              label="Appointment history"
              onPageChange={setCustomerHistoryPage}
            />
          )}
        </div>
      </AdminDialog>
      <AdminDialog
        open={inviteDialogOpen}
        title="Add account"
        description="Send a secure setup email so the new Head can choose a password and access the staff workspace."
        closeDisabled={inviteBusy}
        onClose={closeInvite}
      >
        <form onSubmit={invite} className="grid gap-4">
          {inviteDialogError && (
            <p
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
              role="alert"
            >
              {inviteDialogError}
            </p>
          )}
          <label className="text-sm font-semibold text-ink-900">
            Account email
            <input
              required
              type="email"
              value={inviteForm.email}
              onChange={(event) =>
                setInviteForm((form) => ({
                  ...form,
                  email: event.target.value,
                }))
              }
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-ink-900">
              First name
              <input
                required
                value={inviteForm.first_name}
                onChange={(event) =>
                  setInviteForm((form) => ({
                    ...form,
                    first_name: event.target.value,
                  }))
                }
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-ink-900">
              Last name
              <input
                required
                value={inviteForm.last_name}
                onChange={(event) =>
                  setInviteForm((form) => ({
                    ...form,
                    last_name: event.target.value,
                  }))
                }
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="text-sm font-semibold text-ink-900">
            Role
            <select
              value={inviteForm.role}
              onChange={(event) =>
                setInviteForm((form) => ({ ...form, role: event.target.value }))
              }
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="head">Head</option>
            </select>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="soft"
              className="min-h-11"
              disabled={inviteBusy}
              onClick={closeInvite}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" loading={inviteBusy} disabled={inviteBusy || inviteRoleDisabled}>
              {inviteRoleDisabled ? "A Head is already assigned" : inviteBusy ? "Adding account…" : "Add account"}
            </Button>
          </div>
        </form>
      </AdminDialog>
      <AdminDialog
        open={!!staffAction}
        title={staffAction?.title || "Confirm account change"}
        description={staffAction?.description || ""}
        closeDisabled={staffActionBusy}
        onClose={closeStaffAction}
      >
        {staffActionError && (
          <p
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
            role="alert"
          >
            {staffActionError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="soft"
            className="min-h-11"
            disabled={staffActionBusy}
            onClick={closeStaffAction}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={staffAction?.variant === "danger" ? "danger" : "primary"}
            className="min-h-11"
            loading={staffActionBusy}
            onClick={confirmStaffAction}
          >
            {staffAction?.confirmLabel || "Confirm change"}
          </Button>
        </div>
      </AdminDialog>
    </div>
  );
}
