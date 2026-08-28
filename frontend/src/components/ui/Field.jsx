import { forwardRef } from 'react';

const controlBase =
  'w-full rounded-xl border bg-surface px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-400';

function FieldWrap({ label, htmlFor, error, hint, required, children }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      {label && (
        <span className="mb-1.5 block text-sm font-semibold text-ink-900">
          {label}
          {required && <span className="ml-0.5 text-blush-600">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, id, className = '', ...props }, ref) {
  return (
    <FieldWrap label={label} htmlFor={id} error={error} hint={hint} required={props.required}>
      <input ref={ref} id={id} className={`${controlBase} ${error ? 'border-danger' : 'border-line'} ${className}`} {...props} />
    </FieldWrap>
  );
});

export function Select({ label, error, hint, id, className = '', children, ...props }) {
  return (
    <FieldWrap label={label} htmlFor={id} error={error} hint={hint} required={props.required}>
      <select id={id} className={`${controlBase} appearance-none ${error ? 'border-danger' : 'border-line'} ${className}`} {...props}>
        {children}
      </select>
    </FieldWrap>
  );
}

export function Textarea({ label, error, hint, id, className = '', ...props }) {
  return (
    <FieldWrap label={label} htmlFor={id} error={error} hint={hint} required={props.required}>
      <textarea id={id} rows={props.rows || 3} className={`${controlBase} resize-y ${error ? 'border-danger' : 'border-line'} ${className}`} {...props} />
    </FieldWrap>
  );
}
