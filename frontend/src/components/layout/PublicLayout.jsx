import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from '../auth/AuthModal';
import { getInitials } from '../../utils/format';
import { IconMenu, IconX } from '../icons';

const NAV_LINKS = [
  ['Home', '#home'],
  ['Services', '#services'],
  ['Reviews', '#reviews'],
  ['About', '#about'],
  ['FAQs', '#faqs'],
];

function Navbar() {
  const { isAuthenticated, customer, openAuth, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location]);

  const goHome = () => {
    if (location.pathname !== '/') navigate('/');
    else document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className={`fixed inset-x-0 top-0 z-[900] transition-all duration-300 ${scrolled ? 'border-b border-line bg-canvas/90 shadow-card backdrop-blur-md' : 'bg-transparent'}`}>
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <button onClick={goHome} className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-800 to-blush-600 font-display text-base font-bold text-white shadow-card">AN</span>
          <span className="flex flex-col leading-tight text-left">
            <span className="font-display text-lg font-bold text-ink-900">Astrid Nails</span>
            <span className="text-xs font-medium uppercase tracking-widest text-ink-400">&amp; Beauty Bar</span>
          </span>
        </button>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(([label, hash]) => (
            <a
              key={hash}
              href={location.pathname === '/' ? hash : `/${hash}`}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-900 transition-all hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">
                  {getInitials(customer?.first_name)}
                </span>
                My Dashboard
              </Link>
              <button onClick={logout} className="text-sm font-semibold text-ink-500 transition-colors hover:text-danger">
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth('login')} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-900 transition-all hover:border-brand-200 hover:bg-brand-50">
                Login / Register
              </button>
            </>
          )}
          <button
            onClick={isAuthenticated ? () => navigate('/dashboard/book') : () => openAuth('login')}
            className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:-translate-y-px hover:bg-brand-900"
          >
            Book Now
          </button>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-700 lg:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <IconX /> : <IconMenu />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-line bg-surface px-4 pb-6 pt-2 shadow-float lg:hidden">
          {NAV_LINKS.map(([label, hash]) => (
            <a key={hash} href={location.pathname === '/' ? hash : `/${hash}`} className="block rounded-lg px-3 py-3 text-sm font-semibold text-ink-700 hover:bg-brand-50">
              {label}
            </a>
          ))}
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard/book" className="rounded-xl bg-brand-800 px-4 py-3 text-center text-sm font-bold text-white shadow-card">
                  Book Now
                </Link>
                <Link to="/dashboard" className="rounded-xl bg-brand-50 px-4 py-3 text-center text-sm font-bold text-brand-800">My Dashboard</Link>
                <button onClick={logout} className="rounded-xl px-4 py-3 text-sm font-semibold text-danger">Logout</button>
              </>
            ) : (
              <button onClick={() => openAuth('login')} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900">Login / Register</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer id="contact" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-800 to-blush-600 font-display text-base font-bold text-white">AN</span>
            <div>
              <p className="font-display text-lg font-bold">Astrid Nails &amp; Beauty Bar</p>
              <p className="text-xs uppercase tracking-widest text-ink-400">LuxeGlow Experience</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm text-ink-500">
            Your premier destination for beauty and wellness across Metro Manila. Premium products, certified professionals, one relaxing space.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-ink-900">Explore</h4>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-ink-500">
            {NAV_LINKS.slice(1).map(([label, hash]) => (
              <li key={hash}><a href={`/${hash}`} className="transition-colors hover:text-brand-800">{label}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-ink-900">Visit us</h4>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-ink-500">
            <li>Open daily · 9:00 AM – 8:00 PM</li>
            <li>Metro Manila, Philippines</li>
            <li>hello@astridnails.ph</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-ink-400">
        © {new Date().getFullYear()} Astrid Nails &amp; Beauty Bar. All rights reserved.
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openAuth } = useAuth();

  /* Parity with legacy deep-links: index.php?openAuth=login opened the modal. */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openAuth') === 'login') {
      openAuth('login');
      params.delete('openAuth');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <Outlet />
      </main>
      <Footer />
      <AuthModal />
    </div>
  );
}
