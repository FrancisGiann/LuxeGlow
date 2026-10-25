import { requestedTimeLabel } from '../../utils/rescheduleRequests';

export function RescheduleRequestHistory({ requests = [] }) {
  if (!requests.length) return null;
  const ordered = [...requests].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return <details className="col-span-full rounded-lg border border-line bg-surface p-3 text-sm text-ink-800">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">Reschedule requests ({requests.length})</summary>
    <ol className="divide-y divide-line">{ordered.map((request) => <li key={request.id} className="space-y-1 py-3">
      <p className="break-words font-semibold">{requestedTimeLabel(request)} · {request.status === 'pending' ? 'Awaiting approval' : request.status}</p>
      <p className="whitespace-pre-wrap break-words">{request.reason}</p>
      {request.resolution_reason && <p className="break-words">{request.resolution_reason}</p>}
    </li>)}</ol>
  </details>;
}
