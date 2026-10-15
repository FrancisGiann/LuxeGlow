import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { IconArrowRight } from '../icons';

function StaffDirectoryRow({ entry, selected, onSelect }) {
  const person = entry.kind === 'member' ? entry.member : entry.account;
  const secondary = entry.kind === 'member'
    ? person.position_title || (entry.roleLabel === 'Owner' ? 'Salon owner' : 'Team member')
    : person.email || 'Staff account';
  const statusLabel = person.is_active ? 'Active' : 'Inactive';
  const statusTone = person.is_active
    ? 'bg-success/10 text-success'
    : 'bg-danger/10 text-danger';

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(entry.key)}
        aria-pressed={selected}
        aria-controls="staff-directory-details"
        className={`grid min-h-14 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${selected ? 'bg-blush-50' : 'hover:bg-canvas'}`}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink-900">
            {entry.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-500">
            <span className="font-semibold text-ink-700">{entry.roleLabel}</span>
            {secondary ? ` · ${secondary}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            aria-label={`${entry.roleLabel} status: ${statusLabel}`}
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone}`}
          >
            {statusLabel}
          </span>
          <IconArrowRight
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-ink-400 transition-transform ${selected ? 'translate-x-0.5 text-brand-700' : ''}`}
          />
        </span>
      </button>
    </li>
  );
}

export function StaffDirectory({
  entries,
  selectedKey,
  onSelect,
  action,
  children,
}) {
  const detailsRef = useRef(null);
  const userSelectionRef = useRef(false);
  const [selectionVersion, setSelectionVersion] = useState(0);

  useEffect(() => {
    if (!userSelectionRef.current) return;
    userSelectionRef.current = false;
    if (!window.matchMedia?.('(max-width: 1279px)').matches) return;

    const details = detailsRef.current;
    if (!details) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    details.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    details.querySelector('h2')?.focus({ preventScroll: true });
  }, [selectedKey, selectionVersion]);

  const handleSelect = (key) => {
    userSelectionRef.current = true;
    setSelectionVersion((version) => version + 1);
    onSelect(key);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
      <Card className="p-5 sm:p-7">
        <CardHeader
          title="Staff"
          subtitle="Select a person to manage details and appointments."
          action={action}
        />
        <ul className="mt-2">
          {entries.length ? (
            entries.map((entry) => (
              <StaffDirectoryRow
                key={entry.key}
                entry={entry}
                selected={selectedKey === entry.key}
                onSelect={handleSelect}
              />
            ))
          ) : (
            <li className="py-10 text-center text-sm text-ink-500">
              No staff are available.
            </li>
          )}
        </ul>
      </Card>
      <div
        ref={detailsRef}
        id="staff-directory-details"
        className="scroll-mt-28"
      >
        {children}
      </div>
    </div>
  );
}
