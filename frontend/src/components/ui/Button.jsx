import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 shadow-card',
  accent: 'bg-blush-600 text-white hover:bg-blush-700 shadow-card',
  soft: 'bg-surface text-ink-900 border border-line hover:border-brand-200 hover:bg-brand-50',
  ghost: 'text-ink-500 hover:text-brand-800 hover:bg-brand-50',
  danger: 'bg-danger text-white hover:brightness-110 shadow-card',
  'on-dark': 'bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm',
};

const SIZES = {
  sm: 'px-3.5 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200
        enabled:hover:-translate-y-px enabled:active:translate-y-0
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" tone={variant === 'soft' || variant === 'ghost' ? 'brand' : 'light'} />}
      {children}
    </button>
  );
}

export function LinkButton({ className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-brand-800 transition-colors hover:text-brand-900 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
