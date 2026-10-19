export function bindPublicMenuEscape({ target, onClose, trigger }) {
  const handleKey = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onClose();
    trigger?.focus();
  };
  target.addEventListener('keydown', handleKey);
  return () => target.removeEventListener('keydown', handleKey);
}
