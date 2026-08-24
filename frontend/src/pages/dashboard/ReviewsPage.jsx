import { useMemo, useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { Card } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { RateVisitModal, StarPicker } from '../../components/dashboard/RateVisitModal';

function ReviewCard({ review }) {
  return (
    <Card hoverable className="flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-3">
        <StarPicker value={review.rating} onChange={() => {}} size={16} />
        <span className="text-xs text-ink-300">{review.created_at}</span>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-ink-700">
        {review.review_text || 'Rated without a written review.'}
      </p>
      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{review.service_names}</span>
        <span className="text-xs font-bold text-brand-800">#{review.appointment_id}</span>
      </div>
    </Card>
  );
}

export function ReviewsPage() {
  const { reviews, loading } = useDashboard();
  const [ratingOpen, setRatingOpen] = useState(false);

  const average = useMemo(
    () => (reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0),
    [reviews]
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Ratings &amp; Reviews</h2>
          <p className="mt-1 text-sm text-ink-500">Rate your completed visits and revisit past feedback.</p>
        </div>
        <Button onClick={() => setRatingOpen(true)}>⭐ Rate a Visit</Button>
      </div>

      {/* Summary band */}
      {!loading && reviews.length > 0 && (
        <Card className="mb-6 flex flex-wrap items-center gap-x-10 gap-y-4 px-8 py-5">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-brand-800">{average.toFixed(1)}</span>
            <span className="text-sm text-ink-400">your avg. rating</span>
          </div>
          <div className="h-8 w-px bg-line" />
          <p className="text-sm text-ink-500">
            <span className="font-bold text-ink-900">{reviews.length}</span> review{reviews.length > 1 ? 's' : ''} submitted
          </p>
        </Card>
      )}

      {/* Grid */}
      {loading && <SkeletonRows rows={3} />}
      {!loading && reviews.length === 0 && (
        <Card className="border-dashed">
          <EmptyState
            icon="⭐"
            title="No reviews yet"
            description="After a completed visit, share your experience — it takes less than a minute."
            action={<Button variant="soft" onClick={() => setRatingOpen(true)}>Rate your first visit</Button>}
          />
        </Card>
      )}
      {!loading && reviews.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((r) => (
            <ReviewCard key={r.review_id} review={r} />
          ))}
        </div>
      )}

      {ratingOpen && <RateVisitModal onClose={() => setRatingOpen(false)} />}
    </div>
  );
}
