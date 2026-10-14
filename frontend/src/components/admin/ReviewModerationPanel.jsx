import { useEffect, useRef, useState } from 'react';
import { listAdminReviewModeration, setAdminReviewPublication } from '../../api/admin';
import { StarPicker } from '../dashboard/RateVisitModal';
import { IconStar } from '../icons';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState, SkeletonRows } from '../ui/EmptyState';

const PAGE_SIZE = 25;

function dateLabel(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const date = new Date(`${value}T12:00:00+08:00`);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
  }).format(date);
}

function createdLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Submission date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
  }).format(date);
}

export function ReviewModerationPanel() {
  const [isPublished, setIsPublished] = useState(false);
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestRef = useRef(0);
  const actionBusyRef = useRef(false);

  useEffect(() => {
    let active = true;
    const requestId = ++requestRef.current;
    listAdminReviewModeration({ isPublished, page })
      .then((result) => {
        if (!active || requestRef.current !== requestId) return;
        setReviews(result.reviews);
        setTotal(result.total);
        setLoadError('');
      })
      .catch((error) => {
        if (!active || requestRef.current !== requestId) return;
        setLoadError(error?.message || 'Could not load review approvals.');
      })
      .finally(() => {
        if (!active || requestRef.current !== requestId) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [isPublished, page, refreshVersion]);

  const changeStatus = async (review, nextPublished) => {
    if (!review || actionBusyRef.current) return;
    actionBusyRef.current = true;
    const actionRequestId = ++requestRef.current;
    setBusyId(String(review.id));
    setActionError('');
    setAnnouncement('');
    try {
      const result = await setAdminReviewPublication(review.id, nextPublished);
      if (!result?.success) throw new Error(result?.error || 'Could not update this review.');
      if (requestRef.current !== actionRequestId) return;

      const nextTotal = Math.max(0, total - 1);
      const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setTotal(nextTotal);
      if (page > lastPage) setPage(lastPage);
      setAnnouncement(nextPublished
        ? 'Review approved and published on the homepage.'
        : 'Review removed from the homepage.');
      setRefreshing(true);
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      if (requestRef.current === actionRequestId) setActionError(error?.message || 'Could not update this review.');
    } finally {
      actionBusyRef.current = false;
      if (requestRef.current === actionRequestId) setBusyId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstResult = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-7">
        <CardHeader
          title="Review approvals"
          subtitle="Customer reviews appear on the homepage after an administrator approves them."
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="group" aria-label="Review approval status">
            <Button
              type="button"
              size="sm"
              variant={isPublished ? 'soft' : 'primary'}
              aria-pressed={!isPublished}
              disabled={busyId !== null}
              onClick={() => {
                if (actionBusyRef.current) return;
                if (isPublished) {
                  setIsPublished(false);
                  setPage(1);
                  setLoading(true);
                  setLoadError('');
                }
              }}
            >
              Pending
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isPublished ? 'primary' : 'soft'}
              aria-pressed={isPublished}
              disabled={busyId !== null}
              onClick={() => {
                if (actionBusyRef.current) return;
                if (!isPublished) {
                  setIsPublished(true);
                  setPage(1);
                  setLoading(true);
                  setLoadError('');
                }
              }}
            >
              Published
            </Button>
          </div>
          <p className="text-sm text-ink-500" aria-live="polite">
            {total ? `Showing ${firstResult}–${lastResult} of ${total}` : `${total} reviews`}
          </p>
        </div>
      </Card>

      {announcement && <p className="text-sm font-semibold text-brand-800" role="status" aria-live="polite">{announcement}</p>}
      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3" role="alert">
          <p className="text-sm font-semibold text-danger">{loadError}</p>
          <Button type="button" size="sm" variant="soft" onClick={() => { setLoading(true); setLoadError(''); setRefreshVersion((version) => version + 1); }}>Retry</Button>
        </div>
      )}
      {actionError && <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{actionError}</p>}
      {refreshing && <p className="text-xs text-ink-500" role="status">Refreshing reviews…</p>}

      <div className="space-y-4">
        {loading ? (
          <Card className="p-5"><SkeletonRows rows={3} /></Card>
        ) : reviews.length ? (
          reviews.map((review) => (
            <Card as="article" className="p-5 sm:p-6" key={review.id}>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <h2 className="font-semibold text-ink-900">{review.customer_name}</h2>
                  <p className="mt-1 text-xs text-ink-500">Submitted {createdLabel(review.created_at)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isPublished ? 'soft' : 'primary'}
                  loading={busyId === String(review.id)}
                  disabled={busyId !== null}
                  aria-label={`${isPublished ? 'Unpublish' : 'Approve'} review from ${review.customer_name}`}
                  onClick={() => changeStatus(review, !isPublished)}
                >
                  {isPublished ? 'Unpublish review' : 'Approve review'}
                </Button>
              </div>
              <div className="grid gap-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
                <div>
                  <StarPicker value={review.rating} readOnly size={18} />
                  <p className="mt-1 text-xs text-ink-500">Visit rating</p>
                  {review.staff_rating !== null && (
                    <p className="mt-3 text-sm font-medium text-ink-700">
                      Staff rating: {review.staff_rating}/5 · {review.staff_name}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-ink-500">
                    Visit: {dateLabel(review.appointment_date)}{review.appointment_time ? ` · ${review.appointment_time}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">Team member: {review.staff_name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">{review.service_names}</p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                  {review.review_text || 'Rated without a written note.'}
                </p>
              </div>
            </Card>
          ))
        ) : !loadError ? (
          <Card className="p-5">
            <EmptyState
              icon={IconStar}
              title={isPublished ? 'No published reviews yet' : 'No reviews are waiting for approval'}
              description={isPublished ? 'Approved customer feedback will appear here.' : 'New customer reviews will be listed here until an administrator approves them.'}
            />
          </Card>
        ) : null}
      </div>

      {!loading && total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-500">Page {page} of {pageCount}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="soft" disabled={page <= 1 || busyId !== null} onClick={() => { if (actionBusyRef.current) return; setPage((current) => current - 1); setLoading(true); }}>Previous</Button>
            <Button type="button" size="sm" variant="soft" disabled={page >= pageCount || busyId !== null} onClick={() => { if (actionBusyRef.current) return; setPage((current) => current + 1); setLoading(true); }}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
