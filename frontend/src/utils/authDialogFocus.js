const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function controlsIn(dialog) {
  return Array.from(dialog.querySelectorAll(FOCUSABLE))
    .filter((control) => control.tabIndex >= 0 && control.getClientRects().length > 0);
}

export function focusAuthDialog(dialog) {
  if (!dialog) return;
  const controls = controlsIn(dialog);
  const input = controls.find((control) => control.tagName === 'INPUT' && !['checkbox', 'radio', 'hidden'].includes(control.type));
  (input || controls[0] || dialog).focus({ preventScroll: true });
}

export function containAuthDialogFocus(dialog, onEscape) {
  if (!dialog) return () => {};
  const document = dialog.ownerDocument;
  const invoker = document.activeElement;
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const controls = controlsIn(dialog);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.focus({ preventScroll: true }); return; }
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeyDown, true);
  focusAuthDialog(dialog);
  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    if (invoker?.isConnected && invoker.getClientRects().length > 0) invoker.focus({ preventScroll: true });
  };
}
