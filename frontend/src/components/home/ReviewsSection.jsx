import { getReviews } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { IconStar } from '../icons';

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5 text-gold-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} size={15} filled={i < rating} />
      ))}
    </div>
  );
}

export function ReviewsSection() {
  const { data, loading } = useFetch(getReviews);
  const stats = data?.stats;
  const reviews = data?.reviews || [];

  return (
    <section id="reviews" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Testimonials"
          title="Loved by Our Clients"
          subtitle="Real feedback from real visits — unfiltered and straight from the chair."
        />

        {/* Aggregate stat band */}
        <Card className="mx-auto mt-12 flex max-w-xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-10 py-7">
          <div className="flex items-center gap-3">
            <span className="font-display text-4xl font-bold text-blush-600">
              {stats ? Number(stats.average_rating).toFixed(1) : '—'}
            </span>
            <Stars rating={Math.round(stats?.average_rating || 0)} />
          </div>
          <div className="h-10 w-px bg-line" />
          <p className="text-sm font-semibold text-ink-500">
            <span className="text-lg font-bold text-ink-900">{stats?.total_reviews ?? '—'}</span> verified reviews
          </p>
        </Card>

        {!loading && reviews.length === 0 && (
          <EmptyState icon="★" title="No reviews yet" description="Be the first to share your LuxeGlow experience." />
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(loading ? Array.from({ length: 3 }) : reviews.slice(0, 6)).map((r, i) =>
            r === null ? null : loading ? (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface border border-line" />
            ) : (
              <Card hoverable key={r.review_id} className="flex flex-col gap-4 p-6">
                <Stars rating={r.rating} />
                <p className="flex-1 text-sm leading-relaxed text-ink-700">
                  “{r.review_text || 'A wonderful experience from start to finish.'}”
                </p>
                <div className="flex items-center gap-3 border-t border-line pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-display text-xs font-bold text-brand-800">
                    {r.customer_name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink-900">{r.customer_name}</p>
                    <p className="text-xs text-ink-400">{r.service_names}</p>
                  </div>
                </div>
              </Card>
            )
          )}
        </div>
      </div>
    </section>
  );
}
