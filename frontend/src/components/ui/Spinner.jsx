export function Spinner({ size = 'md', tone = 'light' }) {
  const sizes = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-8 w-8' };
  const tones = {
    light: 'border-white/40 border-t-white',
    brand: 'border-brand-200 border-t-brand-800',
    ink: 'border-line-strong border-t-ink-700',
  };
  return <span className={`inline-block animate-spin rounded-full border-2 ${sizes[size]} ${tones[tone]}`} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-blush-600 font-display text-xl font-bold text-white shadow-float">
          AN
        </div>
        <span className="text-sm font-medium text-ink-400">Loading your space…</span>
      </div>
    </div>
  );
}
