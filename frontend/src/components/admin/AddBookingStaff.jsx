import { useRef, useState } from 'react';
import { AdminDialog } from './AdminDialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';

export function AddBookingStaff({ onSave, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const submit = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onSave({ full_name: name, position_title: title });
      if (!result?.success) throw new Error(result?.error || 'Could not add booking staff.');
      setOpen(false);
      setName('');
      setTitle('');
    } catch (saveError) {
      setError(saveError?.message || 'Could not add booking staff.');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Button type="button" size="sm" className="min-h-11" disabled={disabled} onClick={() => { setError(''); setOpen(true); }}>
        Add booking staff
      </Button>
      <AdminDialog open={open} title="Add booking staff" description="Add a person to customer booking preferences. This creates a roster entry with no login account or access permissions." onClose={() => { if (!savingRef.current) setOpen(false); }} closeDisabled={busy}>
        <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
          <Input id="roster-full-name" label="Full name" required maxLength={201} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} />
          <Input id="roster-position-title" label="Position title (optional)" placeholder="e.g. Nail Artist" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} />
          <p className="text-sm text-ink-500">The person will be active and shown in booking preferences. Remove from booking later to hide them while keeping their appointments and ratings.</p>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>Add to booking preferences</Button>
            <Button type="button" variant="soft" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}
