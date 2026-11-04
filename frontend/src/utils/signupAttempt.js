/** Owns one UI attempt without cancelling a request whose outcome may be unknown. */
export function createSignupAttemptTracker() {
  let current = null;

  return {
    cancel() { current = null; },
    run(work) {
      if (current) return current.promise;
      const attempt = {};
      current = attempt;
      const isCurrent = () => current === attempt;
      attempt.promise = Promise.resolve().then(() => work(isCurrent)).finally(() => {
        if (isCurrent()) current = null;
      });
      return attempt.promise;
    },
  };
}
