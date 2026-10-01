import { useContext } from 'react';
import { ToastContext } from './ToastContext';

export function useToastControls() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastControls must be used inside <ToastProvider>');
  return { clearScope: ctx.clearScope, dismiss: ctx.dismiss };
}
