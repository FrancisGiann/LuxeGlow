export function normalizeReviewRating(value) {
  const rating = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[1-5]$/.test(value.trim())
      ? Number(value.trim())
      : null;
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

export function isRatableVisit(appointment) {
  const review = Array.isArray(appointment?.reviews) ? appointment.reviews[0] : appointment?.reviews;
  return appointment?.status === 'Completed' && !review;
}

export function averageReviewRating(reviews) {
  const ratings = (Array.isArray(reviews) ? reviews : [])
    .map((review) => normalizeReviewRating(review?.rating))
    .filter((rating) => rating !== null);
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
}
