/** Coordinates profile revalidation without letting old identity requests win. */
export function isCurrentAuthenticatedIdentity(currentUserId, nextUserId) {
  return typeof currentUserId === 'string'
    && currentUserId.length > 0
    && typeof nextUserId === 'string'
    && nextUserId.length > 0
    && currentUserId === nextUserId;
}

export function createSessionRefreshCoordinator({ checkSession, onAuthenticated, onGuest, onTransientError }) {
  let identityEpoch = 0;
  let inFlight = null;
  let knownStatus = 'loading';

  const invalidate = ({ resetStatus = false } = {}) => {
    identityEpoch += 1;
    inFlight = null;
    if (resetStatus) knownStatus = 'loading';
    return identityEpoch;
  };

  const refresh = ({ initial = false } = {}) => {
    const requestEpoch = identityEpoch;
    if (inFlight?.epoch === requestEpoch) return inFlight.promise;

    const promise = (async () => {
      try {
        const result = await checkSession();
        if (requestEpoch !== identityEpoch) return { applied: false, reason: 'stale' };
        if (result?.loggedIn === true && result.customer) {
          knownStatus = 'authenticated';
          onAuthenticated?.(result);
          return { applied: true, status: 'authenticated', data: result };
        }
        knownStatus = 'guest';
        onGuest?.(result);
        return { applied: true, status: 'guest', data: result };
      } catch (error) {
        if (requestEpoch !== identityEpoch) return { applied: false, reason: 'stale' };
        const fallbackToGuest = initial || knownStatus === 'loading';
        if (fallbackToGuest) knownStatus = 'guest';
        onTransientError?.(error, { initial, fallbackToGuest });
        return { applied: true, status: 'transient', error };
      }
    })();

    inFlight = { epoch: requestEpoch, promise };
    promise.then(
      () => { if (inFlight?.promise === promise) inFlight = null; },
      () => { if (inFlight?.promise === promise) inFlight = null; },
    );
    return promise;
  };

  return { refresh, invalidate, markStatus: (nextStatus) => { knownStatus = nextStatus; } };
}
