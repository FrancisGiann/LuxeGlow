import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminPage = await readFile(new URL('../src/pages/AdminPage.jsx', import.meta.url), 'utf8');
const faqRow = adminPage.slice(adminPage.indexOf('function FaqRow('), adminPage.indexOf('\nfunction AssignedAppointments('));
const newFaqForm = adminPage.slice(adminPage.indexOf('title="FAQs"'), adminPage.indexOf(') : tab === "about"'));

test('FAQ deletion uses an accessible in-app confirmation with retryable guarded errors', () => {
  assert.doesNotMatch(faqRow, /window\.confirm/);
  assert.match(faqRow, /<AdminDialog[\s\S]*?open=\{deleteConfirmationOpen\}/);
  assert.match(faqRow, /closeDisabled=\{busy\}/);
  assert.match(faqRow, /if \(deleteBusyRef\.current\) return/);
  assert.match(faqRow, /role="alert"[\s\S]*?\{deleteError\}/);
  assert.match(faqRow, />\s*Keep FAQ\s*</);
  assert.match(faqRow, />\s*Delete FAQ\s*</);
  assert.match(newFaqForm, /aria-label="New FAQ question"/);
  assert.match(newFaqForm, /aria-label="New FAQ answer"/);
});
