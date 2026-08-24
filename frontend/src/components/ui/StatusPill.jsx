const STATUS_STYLES = {
  Pending: 'bg-gold-100 text-gold-600',
  Confirmed: 'bg-brand-100 text-brand-800',
  Completed: 'bg-success/10 text-success',
  Cancelled: 'bg-danger/10 text-danger',
};

export function StatusPill({ status, size = 'md' }) {
  const style = STATUS_STYLES[status] || 'bg-ink-900/5 text-ink-500';
  const sizeCls = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ${sizeCls} ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
