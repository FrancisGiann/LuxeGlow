/** Native radio-group keyboard behavior for the five visit/staff rating buttons. */
export function handleStarRatingKeyDown(event, value, onChange) {
  const current = Number(value) >= 1 && Number(value) <= 5 ? Number(value) : 1;
  let next;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = current % 5 + 1;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current + 3) % 5 + 1;
  else if (event.key === 'Home') next = 1;
  else if (event.key === 'End') next = 5;
  else return;
  event.preventDefault();
  onChange(next);
  event.currentTarget.querySelectorAll('[role="radio"]')[next - 1]?.focus();
}
