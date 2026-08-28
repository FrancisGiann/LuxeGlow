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

const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(({ to, label }) => [to, label]));

function Brand() {
  return <div className="flex items-center gap-3 px-5 pb-8 pt-7"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500 font-display text-xl font-medium text-gold-600">A</span><span className="font-display text-[15px] font-semibold leading-[0.95] tracking-[-0.03em] text-ink-900">Astrid Nails<br /><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-500">&amp; Beauty Bar</span></span></div>;
}

function SidebarContent({ onNavigate }) {
  const { customer, logout } = useAuth();
  const { summary } = useDashboard();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/'); };
  return <div className="flex h-full flex-col border-r border-line bg-surface"><Brand /><nav aria-label="Dashboard navigation" className="flex flex-col gap-1 px-3">{NAV_ITEMS.map(({ to, label, icon: Icon, badgeKey }) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive ? 'bg-blush-100 font-bold text-brand-800 before:absolute before:inset-y-2 before:-left-3 before:w-1 before:bg-brand-800 before:content-[""]' : 'font-medium text-ink-600 hover:bg-canvas hover:text-ink-900'}`}><Icon size={18} /><span className="flex-1">{label}</span>{badgeKey && summary[badgeKey] > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-600 px-1.5 text-[10px] font-bold text-white">{summary[badgeKey] > 9 ? '9+' : summary[badgeKey]}</span>}</NavLink>)}</nav><div className="mt-auto border-t border-line p-4"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{(customer?.first_name || 'A').charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-ink-900">{customer?.first_name || 'Client'}</p><p className="truncate text-xs text-ink-500">{customer?.email}</p></div></div><button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-500 hover:bg-blush-50 hover:text-danger"><IconLogout size={17} />Log out</button></div></div>;
}

export function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Dashboard';
  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => { if (!drawerOpen) return undefined; const close = (event) => event.key === 'Escape' && setDrawerOpen(false); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; window.addEventListener('keydown', close); return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); }; }, [drawerOpen]);
  return <div className="min-h-screen bg-canvas"><aside className="fixed inset-y-0 left-0 z-[950] hidden w-[224px] lg:block"><SidebarContent /></aside>{drawerOpen && <div id="dashboard-mobile-menu" className="fixed inset-0 z-[1050] lg:hidden"><button type="button" className="absolute inset-0 h-full w-full cursor-default border-0 bg-ink-900/50" onClick={() => setDrawerOpen(false)} aria-label="Close dashboard menu" /><aside role="dialog" aria-modal="true" aria-label="Dashboard menu" className="absolute inset-y-0 left-0 w-[290px] max-w-[88vw] shadow-pop"><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-canvas"><IconX /></button><SidebarContent onNavigate={() => setDrawerOpen(false)} /></aside></div>}<div className="lg:pl-[224px]"><header className="sticky top-0 z-[900] border-b border-line bg-canvas/95 backdrop-blur-sm"><div className="flex min-h-16 items-center gap-4 px-4 sm:px-7 lg:px-10"><button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open dashboard menu" aria-expanded={drawerOpen} aria-controls="dashboard-mobile-menu" className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-700 lg:hidden"><IconMenu /></button><div className="flex-1"><p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-ink-400 sm:block">Customer workspace</p><h1 className="truncate font-display text-xl font-medium text-ink-900">{title}</h1></div><NotificationBell /><NavLink to="/dashboard/profile" className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pl-1.5 pr-3 hover:border-brand-300"><TopbarAvatar /><span className="hidden text-sm font-semibold text-ink-900 sm:block">Account</span></NavLink></div></header><main className="px-4 pb-16 pt-8 sm:px-7 lg:px-10"><Outlet /></main></div></div>;
}

function TopbarAvatar() {
  const { customer } = useAuth();
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-100 text-xs font-bold text-brand-800">{(customer?.first_name || 'A').charAt(0).toUpperCase()}</span>;
}
