import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { deleteAdminClosure, listAdminClosures, listAdminSchedule, listScheduleConflicts, saveAdminClosure, saveAdminSchedule } from '../../api/admin';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SCHEDULE_GUIDANCE = 'Edits affect future availability only. Existing appointments never move; conflicts remain here for staff follow-up.';
const manilaDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const rangeEnd = (date) => {
  const [year, month, day] = String(date).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 370));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

function normalizeSchedule(rows) {
  return DAYS.map((name, index) => {
    const row = rows.find((item) => Number(item.day_of_week) === index + 1);
    return { day_of_week: index + 1, label: name, open_time: row?.open_time || '', close_time: row?.close_time || '', is_closed: row?.is_closed === true };
  });
}

export function ScheduleSettings({ onOpenAppointments }) {
  const [schedule, setSchedule] = useState([]);
  const [closures, setClosures] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyDay, setBusyDay] = useState(null);
  const [closureBusy, setClosureBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const today = manilaDate();
  const end = rangeEnd(today);

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextSchedule, nextClosures, nextConflicts] = await Promise.all([listAdminSchedule(), listAdminClosures(today, end), listScheduleConflicts(today, end)]);
      setSchedule(normalizeSchedule(nextSchedule));
      setClosures(nextClosures || []);
      setConflicts(nextConflicts || []);
    } catch (loadError) {
      setError(loadError?.message || 'Could not load salon hours.');
    } finally {
      setLoading(false);
    }
  }, [end, today]);

  useEffect(() => { load(); }, [load]);

  const saveDay = async (row) => {
    if (busyDay) return;
    if (!row.is_closed && (!row.open_time || !row.close_time || row.close_time <= row.open_time)) {
      setError('Closing time must be after opening time.');
      return;
    }
    setBusyDay(row.day_of_week);
    setError('');
    setNotice('');
    try {
      const result = await saveAdminSchedule({ dayOfWeek: row.day_of_week, openTime: row.is_closed ? null : row.open_time, closeTime: row.is_closed ? null : row.close_time, isClosed: row.is_closed });
      if (!result.success) throw new Error(result.error);
      const nextConflicts = await listScheduleConflicts(today, end);
      setConflicts(nextConflicts || []);
      setNotice(`${row.label} hours saved. Existing appointments were not changed.`);
    } catch (saveError) {
      setError(saveError?.message || 'Could not save salon hours.');
    } finally {
      setBusyDay(null);
    }
  };

  const saveClosure = async (event) => {
    event.preventDefault();
    if (!closureDate || closureBusy) return;
    setClosureBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await saveAdminClosure(closureDate, closureReason);
      if (!result.success) throw new Error(result.error);
      setClosureDate('');
      setClosureReason('');
      await load();
      setNotice('Full-day closure saved. Existing appointments were not changed.');
    } catch (saveError) {
      setError(saveError?.message || 'Could not save closure.');
    } finally {
      setClosureBusy(false);
    }
  };

  const removeClosure = async (date) => {
    if (closureBusy) return;
    setClosureBusy(true);
    setError('');
    try {
      const result = await deleteAdminClosure(date);
      if (!result.success) throw new Error(result.error);
      await load();
      setNotice('Closure removed.');
    } catch (removeError) {
      setError(removeError?.message || 'Could not remove closure.');
    } finally {
      setClosureBusy(false);
    }
  };

  if (loading) return <div className="space-y-4"><p className="text-sm leading-relaxed text-ink-600">{SCHEDULE_GUIDANCE}</p><Card className="p-8"><div className="flex items-center gap-3 text-sm text-ink-500" role="status"><Spinner size="sm" tone="brand" />Loading salon schedule…</div></Card></div>;
  return <div className="space-y-6">
    <p className="text-sm leading-relaxed text-ink-600">{SCHEDULE_GUIDANCE}</p>
    {error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</p>}
    {notice && <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success" role="status">{notice}</p>}
    <Card className="p-5 sm:p-7"><CardHeader title="Weekly salon hours" subtitle="One continuous interval per day, in Asia/Manila time. Closing at a booking’s end is allowed; appointments never extend past it." /><div className="mt-5 divide-y divide-line border-y border-line">{schedule.map((row) => <div key={row.day_of_week} className="grid gap-3 py-4 sm:grid-cols-[minmax(8rem,1fr)_minmax(9rem,12rem)_minmax(9rem,12rem)_auto] sm:items-end"><div><p className="font-semibold text-ink-900">{row.label}</p><p className="mt-1 text-xs text-ink-500">30-minute increments</p></div><label className="text-sm font-semibold text-ink-900">Opens<input type="time" step="1800" disabled={row.is_closed || busyDay === row.day_of_week} value={row.open_time} onChange={(event) => setSchedule((current) => current.map((item) => item.day_of_week === row.day_of_week ? { ...item, open_time: event.target.value } : item))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm" /></label><label className="text-sm font-semibold text-ink-900">Closes<input type="time" step="1800" disabled={row.is_closed || busyDay === row.day_of_week} value={row.close_time} onChange={(event) => setSchedule((current) => current.map((item) => item.day_of_week === row.day_of_week ? { ...item, close_time: event.target.value } : item))} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm" /></label><div className="flex flex-wrap items-center gap-2"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink-700"><input type="checkbox" checked={row.is_closed} disabled={busyDay === row.day_of_week} onChange={(event) => setSchedule((current) => current.map((item) => item.day_of_week === row.day_of_week ? { ...item, is_closed: event.target.checked, open_time: event.target.checked ? '' : item.open_time, close_time: event.target.checked ? '' : item.close_time } : item))} />Closed</label><Button type="button" size="sm" className="min-h-11" loading={busyDay === row.day_of_week} onClick={() => saveDay(row)}>Save</Button></div></div>)}</div></Card>
    <Card className="p-5 sm:p-7"><CardHeader title="Full-day closures" subtitle="Use closures for holidays or one-off dates. Saving a closure never cancels or moves existing appointments." /><form onSubmit={saveClosure} className="mt-5 grid gap-3 border-b border-line pb-5 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto] sm:items-end"><label className="text-sm font-semibold text-ink-900">Date<input type="date" min={today} value={closureDate} onChange={(event) => setClosureDate(event.target.value)} required className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm" /></label><label className="text-sm font-semibold text-ink-900">Reason <span className="font-normal text-ink-500">(optional)</span><input value={closureReason} maxLength={500} onChange={(event) => setClosureReason(event.target.value)} placeholder="e.g. Holiday" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm" /></label><Button type="submit" className="min-h-11" loading={closureBusy}>Save closure</Button></form>{closures.length ? <ul className="divide-y divide-line">{closures.map((closure) => <li key={closure.closure_date} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-ink-900">{closure.closure_date}</p><p className="mt-1 text-sm text-ink-500">{closure.reason || 'Full-day closure'}</p></div><Button type="button" size="sm" variant="soft" disabled={closureBusy} onClick={() => removeClosure(closure.closure_date)}>Remove</Button></li>)}</ul> : <p className="py-6 text-sm text-ink-500">No full-day closures in the next year.</p>}</Card>
    <Card className="p-5 sm:p-7"><CardHeader title="Appointments outside the current schedule" subtitle="These references remain unchanged and need staff follow-up. Schedule edits never mutate appointments." action={onOpenAppointments && <Button type="button" size="sm" variant="soft" className="min-h-11" onClick={onOpenAppointments}>Open appointments</Button>} />{conflicts.length ? <ul className="mt-3 divide-y divide-line">{conflicts.map((conflict) => <li key={`${conflict.reference_no}-${conflict.local_date}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-ink-900">{conflict.reference_no}</p><p className="mt-1 text-sm text-ink-500">{conflict.local_date} · {String(conflict.local_time || '').slice(0, 5)} · {conflict.reason}</p></div><span className="text-xs font-bold uppercase text-ink-500">{conflict.status}</span></li>)}</ul> : <p className="py-6 text-sm text-ink-500">No active appointments conflict with the current schedule.</p>}</Card>
  </div>;
}
