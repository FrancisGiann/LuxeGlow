export function Card({ as: Tag = 'div', className = '', hoverable = false, children, ...props }) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-surface shadow-card ${
        hoverable ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-float' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const alignCls = align === 'center' ? 'items-center text-center mx-auto' : 'items-start text-left';
  return (
    <div className={`flex max-w-2xl flex-col gap-3 ${alignCls}`}>
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-blush-600">{eyebrow}</span>
      )}
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {subtitle && <p className="text-base text-ink-500">{subtitle}</p>}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
