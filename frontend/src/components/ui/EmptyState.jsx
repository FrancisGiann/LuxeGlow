export function EmptyState({ icon = '✦', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl">{icon}</div>
      <h4 className="font-display text-lg font-bold text-ink-900">{title}</h4>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-canvas" />
      ))}
    </div>
  );
}
