import { Link } from 'react-router-dom';
import { getServices } from '../../api/endpoints';
import { assetUrl } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { EmptyState, SkeletonRows } from '../ui/EmptyState';
import { IconAlertCircle, IconClock, IconSparkle, IconStar } from '../icons';

const fallbackImages = {
  lash: 'lashes_hero.jpg',
  spa: 'homepage_hero.jpg',
  massage: 'homepage_hero.jpg',
  nail: 'nails_hero.jpg',
};

function previewImage(service) {
  if (service.image_path) return assetUrl(service.image_path);
  const category = String(service.category || '').toLocaleLowerCase();
  const fallback = Object.keys(fallbackImages).find((key) => category.includes(key));
  return `${import.meta.env.BASE_URL}${fallbackImages[fallback || 'nail']}`;
}

function curateServices(services) {
  const curated = [];
  const categories = new Set();
  services.forEach((service) => {
    if (curated.length < 6 && !categories.has(service.category)) {
      curated.push(service);
      categories.add(service.category);
    }
  });
  services.forEach((service) => {
    if (curated.length < 6 && !curated.includes(service)) curated.push(service);
  });
  return curated;
}

function ServiceCard({ service }) {
  return (
    <Card as="article" hoverable className="overflow-hidden rounded-2xl">
      <div className="grid min-h-[190px] grid-cols-[0.85fr_1.15fr]">
        <div className="relative overflow-hidden bg-blush-100">
          <img src={previewImage(service)} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col justify-center p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-medium leading-tight text-ink-900">{service.name}</h3>
            {service.rating > 0 && <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-gold-600"><IconStar size={12} filled />{Number(service.rating).toFixed(1)}</span>}
          </div>
          {service.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{service.description}</p>}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="font-display text-lg font-semibold text-brand-800">₱{Number(service.price).toLocaleString('en-PH')}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500"><IconClock size={14} />{service.duration || '—'}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ServicesSection() {
  const { data: services, loading, error, reload } = useFetch(getServices);
  const curated = services ? curateServices(services) : [];

  return (
    <section id="services" className="scroll-mt-20 bg-surface py-24 sm:py-28">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title="Treatments, clearly chosen." subtitle="A small look at the live menu, with price and time in view before you book." align="left" />
          <Link to="/services" className="inline-flex min-h-11 items-center rounded-xl border border-brand-300 px-4 text-sm font-bold text-brand-800 transition-colors hover:border-brand-500 hover:bg-brand-50">View full menu</Link>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="grid min-h-[190px] grid-cols-[0.85fr_1.15fr] overflow-hidden rounded-2xl border border-line bg-canvas"><div className="animate-pulse bg-blush-50" /><SkeletonRows rows={3} className="p-5" /></div>)}
          {!loading && error && <div className="col-span-full"><EmptyState icon={IconAlertCircle} title="Could not load services" description={error} action={<button type="button" onClick={reload} className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4">Try again</button>} /></div>}
          {!loading && !error && curated.map((service) => <ServiceCard key={service.id} service={service} />)}
        </div>
        {!loading && !error && !services?.length && <EmptyState icon={IconSparkle} title="Services coming soon" description="The treatment menu will appear here when it is published." />}
      </div>
    </section>
  );
}
