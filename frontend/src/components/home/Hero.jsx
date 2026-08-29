import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IconMapPin } from '../icons';

const heroAsset = (name) => `${import.meta.env.BASE_URL}${name}`;

export function Hero() {
  const { isAuthenticated, openAuth } = useAuth();
  const navigate = useNavigate();

  const book = () => {
    if (isAuthenticated) navigate('/dashboard/book');
    else openAuth('login');
  };

  return (
    <section id="home" className="overflow-hidden border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-11">
        <div className="max-w-[540px] lg:pl-2">
          <h1 className="max-w-none font-display text-[clamp(3rem,4vw,4rem)] font-medium leading-[0.96] tracking-[-0.035em] text-ink-900">
            Beauty care,<br /><span className="lg:whitespace-nowrap">booked around you.</span>
          </h1>
          <div className="mt-10 h-[2px] w-12 bg-gold-500" aria-hidden="true" />
          <p className="mt-7 flex items-center gap-2 text-lg font-semibold text-blush-600">
            <IconMapPin size={19} />
            Lucena City
          </p>
          <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-ink-700 sm:text-lg">
            Nail, lash, and spa treatments designed for you. Book with ease and enjoy a beauty experience close to home in Lucena City.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button type="button" onClick={book} className="min-h-14 rounded-xl bg-brand-800 px-8 text-base font-bold text-white shadow-card transition-transform hover:-translate-y-0.5 hover:bg-brand-900">
              Book an appointment
            </button>
            <Link to="/services" className="inline-flex min-h-14 items-center rounded-xl border border-blush-500 bg-transparent px-8 text-base font-bold text-blush-600 transition-colors hover:bg-blush-50">
              Explore services
            </Link>
          </div>
        </div>

        <div className="grid h-[min(70vw,540px)] min-h-[430px] grid-cols-[1.7fr_0.8fr] grid-rows-2 gap-2.5 sm:gap-3 lg:h-[540px]">
          <figure className="relative row-span-2 overflow-hidden rounded-2xl bg-blush-100 shadow-float">
            <img src={heroAsset('homepage_hero.jpg')} alt="A bright salon interior with manicure and pedicure stations" className="h-full w-full origin-left scale-[1.65] object-cover object-left" fetchPriority="high" />
            <figcaption className="absolute inset-x-4 bottom-4 bg-ink-900/65 px-4 py-3 text-sm font-semibold text-white sm:inset-x-6 sm:bottom-6 sm:px-5 sm:py-4">
              A calm space for your next appointment.
            </figcaption>
          </figure>
          <figure className="relative overflow-hidden rounded-2xl bg-blush-100">
            <img src={heroAsset('nails_hero.jpg')} alt="A nail artist applying a soft pink finish" className="h-full w-full object-cover object-center" loading="lazy" />
          </figure>
          <figure className="relative overflow-hidden rounded-2xl bg-blush-100">
            <img src={heroAsset('lashes_hero.jpg')} alt="Close view of a lash treatment" className="h-full w-full object-cover object-center" loading="lazy" />
          </figure>
        </div>
      </div>
    </section>
  );
}
