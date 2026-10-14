import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changeLoginFailureEmail,
  emptyLoginFailureState,
  isCurrentLoginFailure,
  recordLoginFailure,
  shouldSuggestPasswordReset,
} from '../src/utils/loginRecoveryHint.js';

test('recovery hint appears after three invalid credentials for the normalized email only', () => {
  const first = recordLoginFailure(emptyLoginFailureState(), ' Person@Example.com ', {
    invalidCredentials: true,
  });
  const second = recordLoginFailure(first, 'person@example.com', {
    invalidCredentials: true,
  });

  assert.equal(first.attempts, 1);
  assert.equal(shouldSuggestPasswordReset(second, 'PERSON@example.com'), false);

  const third = recordLoginFailure(second, 'PERSON@example.com', {
    invalidCredentials: true,
  });
  assert.deepEqual(third, { email: 'person@example.com', attempts: 3 });
  assert.equal(shouldSuggestPasswordReset(third, ' person@example.com '), true);
  assert.equal(shouldSuggestPasswordReset(third, 'other@example.com'), false);
});

test('changing email identity and opening a fresh login view reset the threshold', () => {
  const failures = { email: 'person@example.com', attempts: 3 };

  assert.deepEqual(changeLoginFailureEmail(failures, 'other@example.com'), {
    email: 'other@example.com',
    attempts: 0,
  });
  assert.equal(changeLoginFailureEmail(failures, ' PERSON@example.com '), failures);
  assert.deepEqual(emptyLoginFailureState(), { email: '', attempts: 0 });
});

test('late login responses are ignored after email or modal identity changes', () => {
  assert.equal(
    isCurrentLoginFailure(
      { email: 'Person@example.com', generation: 4 },
      { email: ' person@example.com ', generation: 4 },
    ),
    true,
  );
  assert.equal(
    isCurrentLoginFailure(
      { email: 'person@example.com', generation: 4 },
      { email: 'person@example.com', generation: 5 },
    ),
    false,
  );
  assert.equal(
    isCurrentLoginFailure(
      { email: 'person@example.com', generation: 4 },
      { email: 'other@example.com', generation: 5 },
    ),
    false,
  );
});

test('success, throttling, verification, generic failures, and invalid input do not count', () => {
  const failures = { email: 'person@example.com', attempts: 2 };
  const nonCredentialResults = [
    { ok: true, invalidCredentials: true },
    { rateLimited: true, invalidCredentials: true },
    { needsVerification: true, invalidCredentials: true },
    { error: 'Unable to sign in right now.' },
    { invalidCredentials: false },
  ];

  for (const result of nonCredentialResults) {
    assert.equal(recordLoginFailure(failures, 'person@example.com', result), failures);
  }
  assert.equal(
    recordLoginFailure(failures, 'not-an-email', { invalidCredentials: true }),
    failures,
  );
  assert.equal(
    recordLoginFailure(failures, `${'a'.repeat(321)}@example.com`, {
      invalidCredentials: true,
    }),
    failures,
  );
});
