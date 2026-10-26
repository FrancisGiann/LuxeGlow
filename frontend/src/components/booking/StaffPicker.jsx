import { Spinner } from '../ui/Spinner';
import { staffChoiceState } from '../../utils/staffAvailability';

export function StaffPicker({ staff, loading, error, selectedId, onSelect, availability, hasTime, onRetry, notice }) {
  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-ink-500"><Spinner size="sm" tone="brand" />Loading team members…</div>;
  if (error) return <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</p>;
  if (!staff?.length) return <p className="rounded-xl border border-gold-600 bg-gold-100 px-4 py-3 text-sm font-semibold text-ink-900">No team members are accepting appointments right now. Please check again later.</p>;
  const selected = staff.find((member) => member.id === selectedId);
  return <details className="rounded-xl border border-line bg-surface" open={!!selectedId || hasTime || Boolean(notice)}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-bold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800">
      <span>Team member preference</span>
      <span className="text-right text-brand-800">{selected?.name || 'No preference'}</span>
    </summary>
    {hasTime && availability.status === 'loading' && <p className="px-4 pb-3 text-sm text-ink-500" role="status">Checking team availability…</p>}
    {hasTime && availability.status === 'error' && <div className="px-4 pb-3 text-sm text-danger" role="alert"><p>Could not check team availability. Please try again.</p><button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-lg border border-danger/40 px-3 font-bold">Retry team availability</button></div>}
    {notice && <p className="px-4 pb-3 text-sm text-danger" role="status">{notice}</p>}
    <div role="radiogroup" aria-label="Bookable team members" className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
      <button type="button" role="radio" aria-checked={!selectedId} onClick={() => onSelect('')} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${!selectedId ? 'border-brand-800 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-700 hover:border-brand-400 hover:bg-brand-50'}`}><span className="block">No preference</span><span className="mt-0.5 block text-xs font-normal text-ink-500">We’ll match you with an available team member</span></button>
      {staff.map((member) => { const choice = staffChoiceState(member.id, availability, hasTime); return <button key={member.id} type="button" role="radio" aria-checked={selectedId === member.id} disabled={choice.disabled} aria-disabled={choice.disabled} onClick={() => { if (!choice.disabled) onSelect(member.id); }} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${choice.disabled ? 'cursor-not-allowed border-danger/30 bg-canvas text-ink-500' : selectedId === member.id ? 'border-brand-800 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-700 hover:border-brand-400 hover:bg-brand-50'}`}><span className="block">{member.name}</span>{choice.label && <span className={`mt-1 block text-xs font-semibold ${choice.disabled ? 'text-danger' : 'text-brand-800'}`}>{choice.label}</span>}{member.position_title && <span className="mt-0.5 block text-xs font-medium text-ink-600">{member.position_title}</span>}<span className="mt-0.5 block text-xs font-normal text-ink-500">{selectedId === member.id ? 'Selected team member' : member.average_rating > 0 ? `${member.average_rating.toFixed(1)} staff rating${member.rating_count ? ` · ${member.rating_count} visit${member.rating_count === 1 ? '' : 's'}` : ''} · choose as preference` : 'No ratings yet.'}</span></button>; })}
    </div>
  </details>;
}
