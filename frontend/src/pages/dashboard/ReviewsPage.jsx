import { useMemo, useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { Card } from '../../components/ui/Card';
import { EmptyState, SkeletonRows } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { RateVisitModal, StarPicker } from '../../components/dashboard/RateVisitModal';
import { IconStar } from '../../components/icons';
import { averageReviewRating } from '../../utils/reviewRatings';

function ReviewRow({ review }) { return <li className="grid gap-3 border-b border-line py-5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:items-start"><div><StarPicker value={review.rating} readOnly size={16} /><p className="mt-1 text-xs text-ink-500">Visit rating</p>{review.staff_rating != null && <p className="mt-1 text-xs text-ink-500">Staff rating: {review.staff_rating}/5 · {review.staff_name || 'Team member'}</p>}<p className="mt-2 text-xs text-ink-400">{review.created_at}</p></div><div><p className="text-sm leading-relaxed text-ink-700">{review.review_text || 'Rated without a written review.'}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-500">{review.service_names}</p></div></li>; }
export function ReviewsPage() {
  const { reviews, loading } = useDashboard(); const [ratingOpen, setRatingOpen] = useState(false);
  const average = useMemo(() => averageReviewRating(reviews), [reviews]);
  return <div className="mx-auto max-w-[1000px]"><div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-display text-3xl font-medium text-ink-900">Ratings &amp; reviews</h2><p className="mt-2 text-sm text-ink-500">Share feedback about completed visits.</p></div><Button type="button" onClick={() => setRatingOpen(true)}><IconStar size={16} filled />Rate a visit</Button></div>{!loading && reviews.length > 0 && <div className="mb-5 flex items-center gap-6 border-y border-line py-5"><div><p className="font-display text-4xl font-semibold text-brand-800">{average.toFixed(1)}</p><p className="text-xs text-ink-500">Your average rating</p></div><div className="h-10 w-px bg-line" /><p className="text-sm text-ink-500">{reviews.length} review{reviews.length === 1 ? '' : 's'} submitted</p></div>}<Card className="p-5 sm:p-7">{loading && <SkeletonRows rows={3} />}{!loading && !reviews.length && <EmptyState icon={IconStar} title="No reviews yet" description="After a completed visit, share your experience." action={<Button type="button" variant="soft" onClick={() => setRatingOpen(true)}>Rate your first visit</Button>} />}{!loading && reviews.length > 0 && <ul>{reviews.map((review) => <ReviewRow key={review.review_id} review={review} />)}</ul>}</Card>{ratingOpen && <RateVisitModal onClose={() => setRatingOpen(false)} />}</div>;
}
