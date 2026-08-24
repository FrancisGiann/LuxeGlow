import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((message, tone = 'success') => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  const tones = {
    success: 'bg-ink-900 text-white',
    error: 'bg-danger text-white',
    info: 'bg-surface text-ink-900 border border-line shadow-pop',
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-[1200] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`w-full rounded-xl px-4 py-3 text-center text-sm font-medium shadow-float ${tones[t.tone] || tones.success}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
