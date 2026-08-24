import { getServices } from '../../api/endpoints';
import { assetUrl } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { EmptyState, SkeletonRows } from '../ui/EmptyState';
import { IconClock, IconStar } from '../icons';

function ServiceCard({ service }) {
  const img = assetUrl(service.image_path);
  return (
    <Card hoverable className="overflow-hidden">
      <div className="relative h-44 bg-gradient-to-br from-brand-100 to-blush-100">
        {img && <img src={img} alt={service.name} loading="lazy" className="h-full w-full object-cover" />}
        {service.category && (
          <span className="absolute left-4 top-4 rounded-full bg-ink-900/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            {service.category}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-snug">{service.name}</h3>
          {service.rating > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-bold text-gold-600">
              <IconStar size={12} filled /> {Number(service.rating).toFixed(1)}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-500">{service.description || 'A signature LuxeGlow treatment.'}</p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
          <span className="font-display text-xl font-bold text-brand-800">
            ₱{service.price.toLocaleString('en-PH')}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
            <IconClock size={14} />
            {service.duration}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function ServicesSection() {
  const { data: services, loading, error, reload } = useFetch(getServices);

  return (
    <section id="services" className="scroll-mt-24 bg-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Menu"
          title="Our Services"
          subtitle="Premium beauty and wellness treatments, delivered by certified professionals."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line bg-canvas p-0">
                <SkeletonRows rows={3} className="p-5 [&>div]:h-6" />
                <div className="h-32 animate-pulse rounded-b-2xl bg-brand-50" />
              </div>
            ))}

          {!loading && error && (
            <div className="col-span-full">
              <EmptyState
                icon="⚠"
                title="Could not load services"
                description={error}
                action={<button onClick={reload} className="text-sm font-semibold text-brand-800 hover:text-brand-900">Try again</button>}
              />
            </div>
          )}

          {!loading && !error && (services?.length ? services : []).map((s) => <ServiceCard key={s.id} service={s} />)}
        </div>

        {!loading && !error && !services?.length && (
          <EmptyState icon="✦" title="Services coming soon" description="Check back shortly for our updated treatment menu." />
        )}
      </div>
    </section>
  );
}
