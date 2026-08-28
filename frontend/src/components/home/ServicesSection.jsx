import { getServices } from '../../api/endpoints';
import { assetUrl } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { EmptyState, SkeletonRows } from '../ui/EmptyState';
import { IconAlertCircle, IconClock, IconSparkle, IconStar } from '../icons';

function ServiceCard({ service }) {
  const image = assetUrl(service.image_path);
  return (
    <Card as="article" hoverable className="overflow-hidden rounded-2xl">
      <div className="grid min-h-[190px] grid-cols-[0.85fr_1.15fr]">
        <div className="relative overflow-hidden bg-blush-100">
          {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-brand-600"><IconSparkle size={24} /></div>}
        </div>
        <div className="flex flex-col justify-center p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-medium leading-tight text-ink-900">{service.name}</h3>
            {service.rating > 0 && <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-gold-600"><IconStar size={12} filled />{Number(service.rating).toFixed(1)}</span>}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{service.description || 'A treatment from the Astrid Nails & Beauty Bar menu.'}</p>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="font-display text-lg font-semibold text-brand-800">₱{Number(service.price).toLocaleString('en-PH')}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500"><IconClock size={14} />{service.duration}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ServicesSection() {
  const { data: services, loading, error, reload } = useFetch(getServices);
  return (
    <section id="services" className="scroll-mt-20 bg-surface py-24 sm:py-28">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title="Treatments, clearly chosen." subtitle="Browse the live treatment menu with price and time in view before you book." align="left" />
          <p className="max-w-[24ch] text-sm leading-relaxed text-ink-500">Select one to eight services when you are ready to choose a time.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="grid min-h-[190px] grid-cols-[0.85fr_1.15fr] overflow-hidden rounded-2xl border border-line bg-canvas"><div className="animate-pulse bg-blush-50" /><SkeletonRows rows={3} className="p-5" /></div>)}
          {!loading && error && <div className="col-span-full"><EmptyState icon={IconAlertCircle} title="Could not load services" description={error} action={<button type="button" onClick={reload} className="text-sm font-bold text-brand-800">Try again</button>} /></div>}
          {!loading && !error && services?.map((service) => <ServiceCard key={service.id} service={service} />)}
        </div>
        {!loading && !error && !services?.length && <EmptyState icon={IconSparkle} title="Services coming soon" description="The treatment menu will appear here when it is published." />}
      </div>
    </section>
  );
}
