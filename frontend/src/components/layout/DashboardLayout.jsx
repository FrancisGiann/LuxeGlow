import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { NotificationBell } from '../dashboard/NotificationBell';
import { IconBell, IconCalendar, IconGrid, IconLogout, IconMenu, IconSparkle, IconStar, IconUser, IconX } from '../icons';

const NAV_ITEMS = [
  { to: '/dashboard/overview', label: 'Overview', icon: IconGrid },
  { to: '/dashboard/book', label: 'Book Appointment', icon: IconSparkle },
  { to: '/dashboard/appointments', label: 'My Appointments', icon: IconCalendar },
  { to: '/dashboard/notifications', label: 'Notifications', icon: IconBell, badgeKey: 'unread_notifications' },
  { to: '/dashboard/reviews', label: 'Ratings & Reviews', icon: IconStar },
  { to: '/dashboard/profile', label: 'My Profile', icon: IconUser },
];

const PAGE_TITLES = {
  '/dashboard/overview': 'Dashboard Overview',
  '/dashboard/book': 'Book an Appointment',
  '/dashboard/appointments': 'My Appointments',
  '/dashboard/notifications': 'Notifications Center',
  '/dashboard/reviews': 'Ratings & Reviews',
  '/dashboard/profile': 'My Profile',
};

function SidebarContent({ onNavigate }) {
  const { customer, logout } = useAuth();
  const { summary } = useDashboard();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Profile block */}
        <div className="flex flex-col items-center px-4 pb-6 pt-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-100 font-display text-2xl font-extrabold text-brand-800 shadow-float">
            {(customer?.first_name || 'A').trim().charAt(0).toUpperCase()}
          </span>
          <p className="mt-3 text-base font-bold text-white">{customer?.first_name || 'Client'}</p>
          <p className="mt-0.5 w-full truncate text-xs text-blush-300">{customer?.email}</p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, badgeKey }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all ${
                  isActive
                    ? 'bg-surface font-bold text-brand-800 shadow-float'
                    : 'font-medium text-blush-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={19} />
              <span className="flex-1">{label}</span>
              {badgeKey && summary[badgeKey] > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-600 px-1.5 text-[10px] font-bold leading-none text-white">
                  {summary[badgeKey] > 9 ? '9+' : summary[badgeKey]}
                </span>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-danger/90 transition-colors hover:bg-white/10"
          >
            <IconLogout size={19} />
            Logout
          </button>
        </nav>
      </div>

      {/* Help card */}
      <div className="m-4 rounded-2xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur-sm">
        <p className="text-sm font-bold text-white">Need help?</p>
        <p className="mb-3 mt-0.5 text-xs text-blush-100">We're here for you!</p>
        <a
          href={`${import.meta.env.BASE_URL}#faqs`}
          className="block rounded-xl bg-black/25 py-2 text-xs font-bold text-white transition-colors hover:bg-black/40"
        >
          Contact Us
        </a>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Dashboard';

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-[950] hidden w-[280px] bg-gradient-to-b from-brand-800 to-brand-900 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[1050] lg:hidden">
          <div className="absolute inset-0 bg-ink-900/55 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] overflow-y-auto bg-gradient-to-b from-brand-800 to-brand-900 shadow-pop">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
            >
              <IconX />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-[280px]">
        {/* Top bar — the app-shell counterpart of the marketing navbar */}
        <header className="sticky top-0 z-[900] border-b border-line bg-canvas/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-10">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-700 lg:hidden"
            >
              <IconMenu />
            </button>

            <h1 className="flex-1 truncate font-display text-lg font-bold">{title}</h1>

            <NotificationBell />

            <NavLink
              to="/dashboard/profile"
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface py-1.5 pl-1.5 pr-3 transition-colors hover:border-brand-200"
            >
              <TopbarAvatar />
              <span className="hidden text-sm font-semibold text-ink-900 sm:block">Account</span>
            </NavLink>
          </div>
        </header>

        <main className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopbarAvatar() {
  const { customer } = useAuth();
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-800">
      {(customer?.first_name || 'A').trim().charAt(0).toUpperCase()}
    </span>
  );
}
