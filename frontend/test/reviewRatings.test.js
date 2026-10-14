import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { averageReviewRating, isRatableVisit, normalizeReviewRating } from '../src/utils/reviewRatings.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const migration = read('supabase/migrations/20261014024404_optional_staff_review_rating.sql');
const mirror = read('database/supabase/migrations/20261014024404_optional_staff_review_rating.sql');
const approvalMigration = read('supabase/migrations/20261014025626_require_review_approval.sql');
const approvalMirror = read('database/supabase/migrations/20261014025626_require_review_approval.sql');
const endpoints = read('frontend/src/api/endpoints.js');
const reviewsPage = read('frontend/src/pages/dashboard/ReviewsPage.jsx');
const homepageReviews = read('frontend/src/components/home/ReviewsSection.jsx');
const servicesSection = read('frontend/src/components/home/ServicesSection.jsx');
const rateModal = read('frontend/src/components/dashboard/RateVisitModal.jsx');

test('rating inputs accept only integer numbers from one to five or one-digit strings', () => {
  for (const value of [1, 2, 3, 4, 5, '1', ' 5 ']) assert.equal(normalizeReviewRating(value), Number(value));
  for (const value of [true, false, [5], {}, null, '', '05', '5.0', 0, 6, 1.5, NaN]) {
    assert.equal(normalizeReviewRating(value), null);
  }
});

test('visit rating average uses the required main score and remains separate from optional staff score', () => {
  const reviews = [
    { rating: 5, staff_rating: null },
    { rating: 1, staff_rating: 4 },
    { rating: '3', staff_rating: 2 },
  ];
  assert.equal(averageReviewRating(reviews), 3);
  assert.equal(averageReviewRating([{ rating: 5, staff_rating: 1 }]), 5);
  assert.equal(averageReviewRating([{ rating: null, staff_rating: 5 }]), 0);
});

test('any completed unrated visit remains rateable, including visits without assigned staff', () => {
  assert.equal(isRatableVisit({ status: 'Completed', staff_id: 'staff-1', reviews: [] }), true);
  assert.equal(isRatableVisit({ status: 'Completed', staff_id: null, reviews: [] }), true);
  assert.equal(isRatableVisit({ status: 'Confirmed', staff_id: 'staff-1', reviews: [] }), false);
  assert.equal(isRatableVisit({ status: 'Completed', staff_id: null, reviews: [{ id: 1 }] }), false);
});

test('review insertion requires the visit score and stores staff score separately when provided', () => {
  assert.match(endpoints, /createReview\(appointmentId, visitRating, staffRating = null, reviewText = ''\)/);
  assert.match(endpoints, /const visitValue = normalizeReviewRating\(visitRating\)/);
  assert.match(endpoints, /const staffValue = hasStaffRating \? normalizeReviewRating\(staffRating\) : null/);
  assert.match(endpoints, /typeof appointmentId === 'string'/);
  assert.match(endpoints, /typeof reviewText === 'string'/);
  assert.match(endpoints, /rating: visitValue, staff_rating: staffValue/);
  assert.match(endpoints, /staff_rating: staffValue, review_text: normalizedReviewText, is_published: false/);
  assert.match(endpoints, /reviews\(id,rating,staff_rating,review_text,created_at\)/);
  assert.match(endpoints, /rating: Number\(review\.rating\), staff_rating:/);
  assert.match(endpoints, /review\?\.rating \? Number\(review\.rating\) : null/);
});

test('optional staff score starts collapsed, is labeled with the assigned member, and can be cleared', () => {
  assert.match(rateModal, /const \[rating, setRating\] = useState\(5\)/);
  assert.match(rateModal, /Your rating/);
  assert.match(rateModal, /<details[\s\S]*?<summary[\s\S]*?Rate your team member \(optional\)/);
  assert.match(rateModal, /<details key=\{appointmentId\}/);
  assert.match(rateModal, /selected\?\.staff_id/);
  assert.match(rateModal, /selected\.staff_name \|\| 'Assigned team member'/);
  assert.match(rateModal, /setStaffRating\(null\)[\s\S]*?Clear staff rating/);
  assert.match(rateModal, /createReview\(appointmentId, rating, staffRating, text\.trim\(\)\)/);
  assert.doesNotMatch(rateModal, /staffRating\) \{\s*setError|staff_rating.*required/i);
});

test('public stats and review history continue using the visit rating while service cards hide stars', () => {
  assert.match(homepageReviews, /stats\?\.total_reviews > 0/);
  assert.match(homepageReviews, /No ratings yet/);
  assert.match(homepageReviews, /<Stars rating=\{review\.rating\} \/>/);
  assert.match(reviewsPage, /StarPicker value=\{review\.rating\} readOnly/);
  assert.match(reviewsPage, /averageReviewRating\(reviews\)/);
  assert.match(reviewsPage, /review\.staff_rating != null/);
  assert.match(reviewsPage, /Staff rating: \{review\.staff_rating\}\/5/);
  assert.equal((reviewsPage.match(/StarPicker value=\{review\.rating\} readOnly/g) || []).length, 1);
  assert.doesNotMatch(servicesSection, /service\.rating|IconStar/);
});

test('migration makes only the assigned-staff score optional and preserves existing review guards', () => {
  assert.match(migration, /create or replace function public\.protect_review_fields\(\)/i);
  assert.match(migration, /Review ownership is immutable/);
  assert.match(migration, /Review appointment is immutable/);
  assert.match(migration, /Review timestamp is immutable/);
  assert.match(migration, /Only completed visits can be reviewed/);
  assert.match(migration, /new\.is_published := old\.is_published/);
  assert.match(migration, /if not v_staff_assigned and new\.staff_rating is not null then/i);
  assert.doesNotMatch(migration, /staff_rating is null then\s+raise exception 'Staff rating is required/);
  assert.doesNotMatch(migration, /alter table public\.reviews|create or replace view|create or replace function public\.get_published_review_stats/);
  assert.match(migration, /Optional separate 1–5 rating for an assigned team member/);
  assert.equal(mirror, migration);
});

test('new customer reviews stay unpublished until an active admin approves them', () => {
  const start = approvalMigration.indexOf('create or replace function public.protect_review_fields()');
  const end = approvalMigration.indexOf('\n$$;', start) + 4;
  assert.ok(start >= 0 && end >= 4, 'review protection function should exist');
  const guard = approvalMigration.slice(start, end);

  assert.match(approvalMigration, /alter table public\.reviews\s+alter column is_published set default false/i);
  assert.match(guard, /v_admin := public\.is_admin\(\)/);
  assert.match(guard, /if tg_op = 'INSERT' and not v_admin then\s+new\.is_published := false;/i);
  assert.match(guard, /if not v_admin and not v_bypass and tg_op = 'UPDATE' then[\s\S]*?new\.rating is distinct from old\.rating[\s\S]*?new\.staff_rating is distinct from old\.staff_rating[\s\S]*?new\.review_text is distinct from old\.review_text[\s\S]*?new\.is_published := false[\s\S]*?new\.is_published := old\.is_published;/i);
  assert.match(guard, /Only completed visits can be reviewed/);
  assert.match(guard, /if not v_staff_assigned and new\.staff_rating is not null then/i);
  assert.doesNotMatch(approvalMigration, /update public\.reviews/i);
  assert.equal(approvalMirror, approvalMigration);
});
