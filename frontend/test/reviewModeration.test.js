import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isValidReviewPublicationUpdate,
  normalizeReviewModerationId,
  normalizeReviewModerationRows,
} from '../src/utils/reviewModeration.js';
import { adminNavGroupForTab } from '../src/utils/adminAppointments.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(projectRoot, path), 'utf8');
const adminApi = read('frontend/src/api/admin.js');
const adminPage = read('frontend/src/pages/AdminPage.jsx');
const panel = read('frontend/src/components/admin/ReviewModerationPanel.jsx');
const ratingModal = read('frontend/src/components/dashboard/RateVisitModal.jsx');

test('review moderation normalizes only safe ids and minimal display context', () => {
  assert.equal(normalizeReviewModerationId(12), 12);
  assert.equal(normalizeReviewModerationId('12'), 12);
  for (const value of [0, -1, '01', '1.0', Number.MAX_SAFE_INTEGER + 1, true, {}, null]) {
    assert.equal(normalizeReviewModerationId(value), null);
  }

  const rows = normalizeReviewModerationRows([
    {
      id: '12',
      rating: 4,
      staff_rating: '5',
      is_published: false,
      review_text: 'Kind service',
      created_at: '2026-10-14T04:00:00Z',
      profiles: [{ first_name: 'Ari', last_name: 'Santos', email: 'private@example.test' }],
      appointments: [{
        local_date: '2026-10-10',
        local_time: '10:30:00',
        staff_id: 'staff-id',
        staff: [{ first_name: 'Sam', last_name: 'Lee' }],
        appointment_services: [{ service_name: 'Manicure' }],
      }],
    },
    { id: '9007199254740993', rating: 5, is_published: false },
    null,
  ]);

  assert.deepEqual(rows, [{
    id: 12,
    rating: 4,
    staff_rating: 5,
    is_published: false,
    review_text: 'Kind service',
    created_at: '2026-10-14T04:00:00Z',
    customer_name: 'Ari Santos',
    appointment_date: '2026-10-10',
    appointment_time: '10:30',
    staff_name: 'Sam Lee',
    service_names: 'Manicure',
  }]);
  assert.equal(Object.hasOwn(rows[0], 'customer_id'), false);
  assert.equal(Object.hasOwn(rows[0], 'email'), false);
});

test('publication updates require a safe review id and an actual boolean', () => {
  assert.equal(isValidReviewPublicationUpdate(1, true), true);
  assert.equal(isValidReviewPublicationUpdate('2', false), true);
  assert.equal(isValidReviewPublicationUpdate('02', true), false);
  assert.equal(isValidReviewPublicationUpdate(2, 'true'), false);
  assert.equal(isValidReviewPublicationUpdate(null, false), false);
});

test('review moderation API is admin-only, paginated, and writes only the publication flag', () => {
  const listing = adminApi.slice(adminApi.indexOf('export async function listAdminReviewModeration'), adminApi.indexOf('export async function setAdminReviewPublication'));
  const update = adminApi.slice(adminApi.indexOf('export async function setAdminReviewPublication'), adminApi.indexOf('export async function saveFaq'));
  assert.match(listing, /const client = await assertAdmin\(\)/);
  assert.match(listing, /const selection = 'id,rating,staff_rating[\s\S]*?profiles!reviews_customer_id_fkey[\s\S]*?appointments!reviews_appointment_id_fkey[\s\S]*?staff_member:staff_members!appointments_staff_member_id_fkey/);
  assert.match(listing, /runQuery\(selection\)[\s\S]*?runQuery\(legacySelection\)/);
  assert.match(listing, /\.eq\('is_published', isPublished\)/);
  assert.match(listing, /\.order\('created_at', \{ ascending: false \}\)[\s\S]*?\.range\(from, from \+ REVIEW_MODERATION_PAGE_SIZE - 1\)/);
  assert.match(update, /isValidReviewPublicationUpdate\(reviewId, isPublished\)/);
  assert.match(update, /const client = await assertAdmin\(\)/);
  assert.match(update, /\.update\(\{ is_published: isPublished \}\)/);
  assert.doesNotMatch(update, /customer_id|appointment_id|rating:|review_text/);
});

test('only administrator navigation exposes approval actions and the panel refreshes after status changes', () => {
  assert.equal(adminNavGroupForTab('reviews'), 'website-content');
  assert.match(adminPage, /\["reviews", "Review approvals", IconStar\]/);
  assert.match(adminPage, /tab === "reviews" && customer\?\.role === "admin"[\s\S]*?<ReviewModerationPanel \/>/);
  assert.match(panel, /Customer reviews appear on the homepage after an administrator approves them/);
  assert.match(panel, /Approve review/);
  assert.match(panel, /Unpublish review/);
  assert.match(panel, /setAdminReviewPublication\(review\.id, nextPublished\)/);
  assert.match(panel, /setRefreshVersion\(\(version\) => version \+ 1\)/);
  assert.match(panel, /requestRef\.current !== requestId/);
  assert.match(panel, /StarPicker value=\{review\.rating\} readOnly/);
  assert.match(panel, /Staff rating: \{review\.staff_rating\}\/5/);
  assert.match(ratingModal, /Your review will appear on the homepage after approval/);
});
