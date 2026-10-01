import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IconX } from '../icons';
import { ToastContext } from './ToastContext';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timerState = timersRef.current.get(id);
    if (timerState) window.clearTimeout(timerState.timer);
    timersRef.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const clearScope = useCallback((scope) => {
    if (!scope) return;
    timersRef.current.forEach((timerState, id) => {
      if (timerState.scope !== scope) return;
      window.clearTimeout(timerState.timer);
      timersRef.current.delete(id);
    });
    setToasts((list) => list.filter((toast) => toast.scope !== scope));
  }, []);

  const push = useCallback((message, tone = 'success', options = {}) => {
    if (typeof message !== 'string' || !message.trim()) return null;
    const id = ++idRef.current;
    const scope = options.scope || null;
    const duration = Number.isFinite(options.duration)
      ? Math.max(0, options.duration)
      : 3500;
    if (options.replaceScope && scope) clearScope(scope);
    setToasts((list) => [
      ...list,
      { id, message: message.trim(), tone, scope, dismissible: options.dismissible !== false },
    ]);
    if (duration > 0) {
      const timer = window.setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, { timer, scope });
    }
    return id;
  }, [clearScope, dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach(({ timer }) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const controls = useMemo(
    () => ({ push, clearScope, dismiss }),
    [clearScope, dismiss, push],
  );

  const tones = {
    success: 'bg-ink-900 text-white',
    error: 'bg-danger text-white',
    info: 'bg-surface text-ink-900 border border-line shadow-pop',
  };

  return (
    <ToastContext.Provider value={controls}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-[1200] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium shadow-float ${tones[t.tone] || tones.success}`}
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.dismissible && (
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                <IconX size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.push;
}
