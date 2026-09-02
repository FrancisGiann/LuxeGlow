import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { IconEye, IconEyeOff } from '../icons';

const controlBase =
  'w-full rounded-xl border bg-surface px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-400';

function FieldWrap({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="block">
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-ink-900" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-blush-600">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-danger">{error}</span>}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, id, className = '', type = 'text', ...props }, forwardedRef) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputRef = useRef(null);
  const selectionRef = useRef(null);
  const isPassword = type === 'password';

  useLayoutEffect(() => {
    const selection = selectionRef.current;
    const input = inputRef.current;
    if (!selection || !input) return;
    selectionRef.current = null;
    if (!selection.wasFocused) return;

    input.focus({ preventScroll: true });
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(selection.start, selection.end);
    }
  }, [passwordVisible]);

  const setInputRef = (node) => {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const togglePasswordVisibility = () => {
    const input = inputRef.current;
    if (input) {
      selectionRef.current = {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length,
        wasFocused: document.activeElement === input,
      };
    }
    setPasswordVisible((visible) => !visible);
  };

  return (
    <FieldWrap label={label} htmlFor={id} error={error} hint={hint} required={props.required}>
      <div className={isPassword ? 'relative' : undefined}>
        <input
          ref={setInputRef}
          id={id}
          type={isPassword && passwordVisible ? 'text' : type}
          className={`${controlBase} ${error ? 'border-danger' : 'border-line'} ${isPassword ? 'pr-14' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={togglePasswordVisibility}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
            aria-controls={id}
            disabled={props.disabled}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-500 transition-colors hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passwordVisible ? <IconEyeOff size={19} /> : <IconEye size={19} />}
          </button>
        )}
      </div>
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
