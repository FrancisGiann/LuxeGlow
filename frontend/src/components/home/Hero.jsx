import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IconSparkle, IconStar } from '../icons';

export function Hero() {
  const { isAuthenticated, openAuth } = useAuth();
  const navigate = useNavigate();

  const handleBookCta = () => {
    if (isAuthenticated) navigate('/dashboard/book');
    else openAuth('login');
  };

  return (
    <section id="home" className="relative overflow-hidden">
      {/* Ambient brand glows — the only place gradients appear, keeping pages calm */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full bg-brand-100 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[-30%] left-[-8%] h-[420px] w-[420px] rounded-full bg-blush-50 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-32 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-800">
            <IconSparkle size={14} />
            LuxeGlow Experience
          </span>

          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] text-ink-900 sm:text-6xl">
            Astrid Nails
            <span className="block text-brand-800">&amp; Beauty Bar</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-500">
            Your premier destination for beauty and wellness — nails, lashes, and spa treatments by certified professionals in Metro Manila.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button
              onClick={handleBookCta}
              className="rounded-xl bg-brand-800 px-8 py-4 text-base font-semibold text-white shadow-float transition-all hover:-translate-y-0.5 hover:bg-brand-900"
            >
              Book an Appointment
            </button>
            <a
              href="#services"
              className="rounded-xl border border-line bg-surface px-8 py-4 text-base font-semibold text-ink-900 transition-all hover:border-brand-200 hover:bg-brand-50"
            >
              Explore Services
            </a>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
            {[
              ['10+', 'Years of craft'],
              ['15+', 'Expert beauticians'],
              ['4.9★', 'Average rating'],
            ].map(([num, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-2xl font-bold text-ink-900">{num}</dd>
                <dd className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Editorial collage */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-3 grid-rows-2 gap-4">
            <div className="col-span-2 row-span-2 relative flex min-h-[380px] items-end overflow-hidden rounded-3xl bg-cover bg-center p-7 shadow-float" style={{ backgroundImage: "url('/homepage_hero.jpg')" }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <p className="relative z-10 font-display text-2xl font-bold text-white">A sanctuary of style,<br />built around you.</p>
            </div>
            <div className="flex items-end rounded-3xl border border-line bg-surface p-5 shadow-card">
              <p className="text-sm font-semibold text-ink-900">Nail Art Studio</p>
            </div>
            <div className="flex items-end justify-between rounded-3xl border border-line bg-surface p-5 shadow-card">
              <p className="text-sm font-semibold text-ink-900">Lash &amp; Spa</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                <IconStar size={16} filled />
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-4 shadow-card">
            <span className="font-display text-3xl font-bold text-blush-600">4.9</span>
            <div>
              <div className="flex gap-0.5 text-gold-400">
                {Array.from({ length: 5 }).map((_, i) => <IconStar key={i} size={14} filled />)}
              </div>
              <p className="mt-0.5 text-xs text-ink-500">from 287 happy clients across Metro Manila</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
