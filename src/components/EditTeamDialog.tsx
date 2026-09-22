import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ButtonRow from './PaymentButtons';
import ConfirmReentryDialog from './ConfirmReentryDialog';
import { ENTRY_BUTTONS, METHOD_BUTTONS } from './paymentOptions';
import type { EntryType, PaymentMethod, Team } from '../types';
import { getPaymentAmount, nameKey } from '../types';

interface EditTeamDialogProps {
  /** The team being edited, or null when the dialog is closed. */
  team: Team | null;
  onOpenChange: (open: boolean) => void;
  /** Everyone registered on other teams — who a "retry" entry can legitimately refer back to. */
  otherParticipantNames: string[];
  onSave: (teamId: string, updates: Pick<Team, 'player1' | 'player2' | 'entry1' | 'method1' | 'entry2' | 'method2'>) => void;
}

export default function EditTeamDialog({ team, onOpenChange, otherParticipantNames, onSave }: EditTeamDialogProps) {
  return (
    <Dialog open={team !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit Team</DialogTitle>
          <DialogDescription>
            Fix a name or a payment after registration. The bracket, games and revenue update everywhere straight away.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the draft resets to the right team's values each time the dialog opens. */}
        {team && (
          <EditTeamForm
            key={team.id}
            team={team}
            otherParticipantNames={otherParticipantNames}
            onCancel={() => onOpenChange(false)}
            onSave={(updates) => { onSave(team.id, updates); onOpenChange(false); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditTeamForm({ team, otherParticipantNames, onCancel, onSave }: { team: Team; otherParticipantNames: string[]; onCancel: () => void; onSave: (updates: Parameters<EditTeamDialogProps['onSave']>[1]) => void }) {
  const [player1, setPlayer1] = useState(team.player1);
  const [player2, setPlayer2] = useState(team.player2);
  const [entry1, setEntry1] = useState<EntryType>(team.entry1);
  const [method1, setMethod1] = useState<PaymentMethod>(team.method1);
  const [entry2, setEntry2] = useState<EntryType>(team.entry2);
  const [method2, setMethod2] = useState<PaymentMethod>(team.method2);

  const [unlistedRetryNames, setUnlistedRetryNames] = useState<string[] | null>(null);

  const canSave = player1.trim() !== '' && player2.trim() !== '';
  const total = getPaymentAmount(entry1, method1) + getPaymentAmount(entry2, method2);
  const save = () => onSave({ player1: player1.trim(), player2: player2.trim(), entry1, method1, entry2, method2 });
  const handleSave = () => {
    if (!canSave) return;
    // A retry is a re-entry, so it needs someone already registered on another team today. Only
    // asked for what this edit newly makes a retry, not for a retry that was already there.
    const known = new Set(otherParticipantNames.map(nameKey));
    const unlisted = ([
      [player1, entry1, team.player1, team.entry1],
      [player2, entry2, team.player2, team.entry2],
    ] as const)
      .filter(([name, entry, oldName, oldEntry]) =>
        entry === 'retry' && (oldEntry !== 'retry' || nameKey(name) !== nameKey(oldName)) && !known.has(nameKey(name)))
      .map(([name]) => name.trim());
    if (unlisted.length > 0) setUnlistedRetryNames(unlisted);
    else save();
  };

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}>
      {([
        { n: 1, name: player1, setName: setPlayer1, entry: entry1, setEntry: setEntry1, method: method1, setMethod: setMethod1 },
        { n: 2, name: player2, setName: setPlayer2, entry: entry2, setEntry: setEntry2, method: method2, setMethod: setMethod2 },
      ] as const).map(p => (
        <div key={p.n} className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-player${p.n}`} className="text-lg font-semibold">Player {p.n}</Label>
            <Input
              id={`edit-player${p.n}`}
              value={p.name}
              onChange={(e) => p.setName(e.target.value)}
              placeholder="Name..."
              className="text-lg h-12"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Entry</p>
            <ButtonRow items={ENTRY_BUTTONS} selected={p.entry} onSelect={p.setEntry} />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Payment Method</p>
            <ButtonRow items={METHOD_BUTTONS} selected={p.method} onSelect={p.setMethod} />
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Team total: <span className="font-bold text-foreground">€{total.toFixed(2)}</span></span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save changes</Button>
        </div>
      </div>

      <ConfirmReentryDialog
        names={unlistedRetryNames}
        onCancel={() => setUnlistedRetryNames(null)}
        onProceed={() => { setUnlistedRetryNames(null); save(); }}
      />
    </div>
  );
}
