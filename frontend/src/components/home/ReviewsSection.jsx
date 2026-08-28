import { getReviews } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { IconStar } from '../icons';

function Stars({ rating }) {
  return <span className="flex gap-0.5 text-gold-500" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, i) => <IconStar key={i} size={15} filled={i < rating} />)}</span>;
}

export function ReviewsSection() {
  const { data, loading } = useFetch(getReviews);
  const stats = data?.stats;
  const reviews = data?.reviews || [];
  return (
    <section id="reviews" className="scroll-mt-20 border-b border-line bg-canvas py-24 sm:py-28">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-14">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <SectionHeading align="left" title="Notes from completed visits." subtitle="Published feedback from customers who have shared their experience after an appointment." />
            <div className="mt-9 flex items-center gap-6 border-t border-line pt-6">
              <div><p className="font-display text-4xl font-semibold text-brand-800">{stats ? Number(stats.average_rating).toFixed(1) : '—'}</p><Stars rating={Math.round(stats?.average_rating || 0)} /></div>
              <div className="h-11 w-px bg-line" />
              <p className="max-w-[16ch] text-sm leading-relaxed text-ink-500">{stats?.total_reviews ?? '—'} published review{stats?.total_reviews === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-line bg-surface" />)}
            {!loading && reviews.slice(0, 4).map((review) => <Card as="article" hoverable key={review.review_id} className="flex flex-col gap-4 p-6"><Stars rating={review.rating} /><p className="flex-1 text-sm leading-relaxed text-ink-700">{review.review_text || 'Shared without a written note.'}</p><div className="border-t border-line pt-4"><p className="text-sm font-bold text-ink-900">{review.customer_name}</p><p className="mt-1 text-xs text-ink-500">{review.service_names}</p></div></Card>)}
            {!loading && reviews.length === 0 && <div className="md:col-span-2"><EmptyState icon={IconStar} title="No reviews published yet" description="Feedback from completed visits will appear here when shared." /></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
