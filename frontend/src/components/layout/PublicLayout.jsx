import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAbout } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { AuthModal } from '../auth/AuthModal';
import { getInitials } from '../../utils/format';
import { IconClock, IconMail, IconMapPin, IconMenu, IconPhone, IconX } from '../icons';

const NAV_LINKS = [
  ['Services', '#services'],
  ['Reviews', '#reviews'],
  ['About', '#about'],
  ['FAQs', '#faqs'],
];

function SalonWordmark({ compact = false }) {
  return (
    <span className="flex flex-col text-left leading-[0.9]">
      <span className={`${compact ? 'text-base' : 'text-lg'} font-display font-semibold tracking-[-0.03em] text-ink-900`}>Astrid Nails</span>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-ink-500">&amp; Beauty Bar</span>
    </span>
  );
}

function Navbar() {
  const { isAuthenticated, customer, openAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isStaff = ['staff', 'admin'].includes(customer?.role);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location]);

  const goHome = () => {
    if (location.pathname !== '/') navigate('/');
    else document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
  };

  const hrefFor = (hash) => (location.pathname === '/' ? hash : `/${hash}`);

  return (
    <header className={`fixed inset-x-0 top-0 z-[900] border-b border-line bg-canvas/95 transition-shadow duration-300 ${scrolled ? 'shadow-card backdrop-blur-sm' : ''}`}>
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-14">
        <button type="button" onClick={goHome} aria-label="Astrid Nails and Beauty Bar home" className="rounded-lg">
          <SalonWordmark />
        </button>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 xl:flex">
          {NAV_LINKS.map(([label, hash]) => (
            <a key={hash} href={hrefFor(hash)} className="text-sm font-semibold text-ink-700 transition-colors hover:text-brand-800">
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          {isAuthenticated ? (
            <>
              <Link to={isStaff ? '/admin' : '/dashboard'} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink-900 hover:border-brand-300">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blush-100 text-[11px] font-bold text-brand-800">{getInitials(customer?.first_name, customer?.last_name)}</span>
                {isStaff ? 'Admin dashboard' : 'My dashboard'}
              </Link>
            </>
          ) : (
            <button type="button" onClick={() => openAuth('login')} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-900 hover:border-brand-300">Log in</button>
          )}
          {!isStaff && <button type="button" onClick={isAuthenticated ? () => navigate('/dashboard/book') : () => openAuth('login')} className="min-h-11 rounded-xl bg-brand-800 px-5 text-sm font-bold text-white shadow-card hover:bg-brand-900">Book</button>}
        </div>

        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-700 xl:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="mobile-navigation">
          {menuOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-navigation" className="border-t border-line bg-surface px-5 pb-5 pt-3 shadow-card xl:hidden">
          <nav aria-label="Mobile navigation" className="flex flex-col">
            <a href={location.pathname === '/' ? '#home' : '/'} className="border-b border-line py-3 text-sm font-semibold text-ink-700">Home</a>
            {NAV_LINKS.map(([label, hash]) => <a key={hash} href={hrefFor(hash)} className="border-b border-line py-3 text-sm font-semibold text-ink-700">{label}</a>)}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                {!isStaff && <Link to="/dashboard/book" className="rounded-xl bg-brand-800 px-4 py-3 text-center text-sm font-bold text-white">Book an appointment</Link>}
                <Link to={isStaff ? '/admin' : '/dashboard'} className="rounded-xl border border-line px-4 py-3 text-center text-sm font-bold text-ink-900">{isStaff ? 'Admin dashboard' : 'My dashboard'}</Link>
              </>
            ) : <button type="button" onClick={() => openAuth('login')} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900">Log in / Register</button>}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { data: about } = useFetch(getAbout);
  const hours = (about?.business_hours || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const salonName = about?.salon_name || 'Astrid Nails & Beauty Bar';

  return (
    <footer id="contact" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.3fr_0.7fr_1fr] lg:px-14">
        <div>
          <SalonWordmark />
          <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-ink-500">{about?.description || 'A considered menu of nail, lash, and spa treatments in Lucena City.'}</p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-ink-400">LuxeGlow experience</p>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Explore</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-ink-500">
            {NAV_LINKS.map(([label, hash]) => <li key={hash}><a href={`/${hash}`} className="hover:text-brand-800">{label}</a></li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Visit</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-ink-500">
            {hours.map((line) => <li key={line} className="flex items-start gap-2"><IconClock size={15} className="mt-0.5 shrink-0 text-gold-500" />{line}</li>)}
            {about?.address && <li className="flex items-start gap-2"><IconMapPin size={15} className="mt-0.5 shrink-0 text-gold-500" />{about.address}</li>}
            {about?.phone && <li className="flex items-start gap-2"><IconPhone size={15} className="mt-0.5 shrink-0 text-gold-500" /><a href={`tel:${about.phone.replace(/\s/g, '')}`} className="hover:text-brand-800">{about.phone}</a></li>}
            {about?.email && <li className="flex items-start gap-2"><IconMail size={15} className="mt-0.5 shrink-0 text-gold-500" /><a href={`mailto:${about.email}`} className="break-all hover:text-brand-800">{about.email}</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-5 py-5 text-center text-xs text-ink-400">© {new Date().getFullYear()} {salonName}. All rights reserved.</div>
    </footer>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openAuth, status } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedView = params.get('openAuth');
    if (!['login', 'admin'].includes(requestedView) || status === 'loading') return;
    if (status === 'guest') openAuth(requestedView);
    if (status !== 'loading') {
      params.delete('openAuth');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, openAuth, status]);

  return <div className="flex min-h-screen flex-col"><Navbar /><main className="flex-1 pt-20"><Outlet /></main><Footer /><AuthModal /></div>;
}
