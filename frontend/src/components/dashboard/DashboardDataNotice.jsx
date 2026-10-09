export function DashboardDataNotice({ onRetry, retrying = false }) {
  return (
    <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <p>We couldn’t load your latest dashboard data. Some information may be missing or out of date.</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="min-h-11 rounded-lg border border-danger/30 px-3 font-bold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  );
}
