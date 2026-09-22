import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, UserPlus, Lock, Search } from 'lucide-react';
import ButtonRow from './PaymentButtons';
import { ENTRY_BUTTONS, METHOD_BUTTONS } from './paymentOptions';
import ConfirmReentryDialog from './ConfirmReentryDialog';
import type { EntryType, PaymentMethod, Team } from '../types';
import { ENTRY_LABELS, ENTRY_COLORS, METHOD_LABELS, METHOD_COLORS, getPaymentAmount, nameKey } from '../types';

/** "Before 9pm" pricing stops being offered at this local hour (24h clock). */
const BEFORE9_CUTOFF_HOUR = 21;
const isPastBefore9Cutoff = (now: Date) => now.getHours() >= BEFORE9_CUTOFF_HOUR;

const METHOD_SHORT: Record<PaymentMethod, string> = { cash: 'Cash', revolut: 'Revolut', free: 'Free' };

/** What to physically collect from this team right now, phrased for whoever's holding the cash
 * box — one line when both players pay the same way, itemized when they don't (e.g. one retry,
 * one first-timer paying a different amount by a different method). */
function collectSummary(player1: string, entry1: EntryType, method1: PaymentMethod, player2: string, entry2: EntryType, method2: PaymentMethod): string {
  const amt1 = getPaymentAmount(entry1, method1);
  const amt2 = getPaymentAmount(entry2, method2);
  const total = amt1 + amt2;
  if (total === 0) return 'Both players free — nothing to collect';
  if (entry1 === entry2 && method1 === method2) return `Collect €${total} ${METHOD_SHORT[method1]} total (both players)`;
  const name1 = player1.trim() || 'Player 1';
  const name2 = player2.trim() || 'Player 2';
  const part = (name: string, amt: number, method: PaymentMethod) => amt === 0 ? `${name}: free` : `${name}: €${amt} ${METHOD_SHORT[method]}`;
  return `Collect ${part(name1, amt1, method1)} + ${part(name2, amt2, method2)} = €${total} total`;
}

interface RegistrationPanelProps {
  onAddTeam: (player1: string, player2: string, entry1: EntryType, method1: PaymentMethod, entry2: EntryType, method2: PaymentMethod) => string;
  onCloseRegistration: () => void;
  registrationClosed: boolean;
  teams: Team[];
}

export default function RegistrationPanel({ onAddTeam, onCloseRegistration, registrationClosed, teams }: RegistrationPanelProps) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [entry1, setEntry1] = useState<EntryType>(() => isPastBefore9Cutoff(new Date()) ? 'after9' : 'before9');
  const [method1, setMethod1] = useState<PaymentMethod>('revolut');
  const [entry2, setEntry2] = useState<EntryType>(() => isPastBefore9Cutoff(new Date()) ? 'after9' : 'before9');
  const [method2, setMethod2] = useState<PaymentMethod>('revolut');
  // Whether each name slot was filled by picking a previously-registered participant rather
  // than typed fresh — a returning player can only re-enter as a "retry", never before9/after9.
  const [player1Returning, setPlayer1Returning] = useState(false);
  const [player2Returning, setPlayer2Returning] = useState(false);
  const [rejoinSearch, setRejoinSearch] = useState('');

  const [pendingConfirm, setPendingConfirm] = useState<{ names: string[]; onProceed: () => void } | null>(null);
  // Names the organizer has explicitly confirmed "did play before" despite not being on the list,
  // per slot, so they aren't asked again for the same name (e.g. between picking Retry and ADD).
  const [confirmedRetry, setConfirmedRetry] = useState<[string | null, string | null]>([null, null]);

  // Ticks every 15s so the Before-9pm cutoff below locks live, without needing a page refresh.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const pastCutoff = isPastBefore9Cutoff(now);

  // Staff can force Before-9pm pricing back open past the cutoff (e.g. someone was queued and
  // paid before 9pm but only reaches the register after). Explicit per slot, resets on each add.
  const [cutoffOverride, setCutoffOverride] = useState<[boolean, boolean]>([false, false]);
  const overrideCutoff = (slot: 0 | 1) => {
    if (!confirm('Override the 9pm cutoff and charge Before-9pm pricing (€3) for this player?')) return;
    setCutoffOverride(prev => slot === 0 ? [true, prev[1]] : [prev[0], true]);
  };

  // If the cutoff hits while a before9 selection is already sitting in the form, snap it forward
  // to after9 rather than letting a stale, no-longer-honored price go through silently.
  useEffect(() => {
    if (!pastCutoff) return;
    if (entry1 === 'before9' && !cutoffOverride[0] && !player1Returning) setEntry1('after9');
    if (entry2 === 'before9' && !cutoffOverride[1] && !player2Returning) setEntry2('after9');
  }, [pastCutoff, cutoffOverride, entry1, entry2, player1Returning, player2Returning]);

  const entryDisabled = (slot: 0 | 1, returning: boolean): EntryType[] | undefined => {
    if (returning) return ['before9', 'after9'];
    if (pastCutoff && !cutoffOverride[slot]) return ['before9'];
    return undefined;
  };

  const knownNames = Array.from(new Set(teams.flatMap(t => [t.player1, t.player2]))).sort((a, b) => a.localeCompare(b));
  const knownKeys = new Set(knownNames.map(nameKey));
  const rejoinQuery = rejoinSearch.trim().toLowerCase();
  const rejoinSuggestions = rejoinQuery
    ? knownNames.filter(name => name.toLowerCase().includes(rejoinQuery)).slice(0, 8)
    : [];
  const rejoinIsOnList = knownKeys.has(nameKey(rejoinSearch));

  // A re-entry is only for someone already registered today; anyone else needs an explicit OK.
  const isRetryVerified = (slot: 0 | 1, name: string) => knownKeys.has(nameKey(name)) || confirmedRetry[slot] === nameKey(name);
  const markConfirmed = (slot: 0 | 1, name: string) =>
    setConfirmedRetry(prev => (slot === 0 ? [nameKey(name), prev[1]] : [prev[0], nameKey(name)]));

  const selectEntry = (slot: 0 | 1, type: EntryType) => {
    const setEntry = slot === 0 ? setEntry1 : setEntry2;
    const name = (slot === 0 ? player1 : player2).trim();
    if (type === 'retry' && name && !isRetryVerified(slot, name)) {
      setPendingConfirm({ names: [name], onProceed: () => { markConfirmed(slot, name); setEntry('retry'); } });
      return;
    }
    setEntry(type);
  };

  const fillReturning = (name: string) => {
    if (!player1.trim()) {
      setPlayer1(name);
      setEntry1('retry');
      setPlayer1Returning(true);
      markConfirmed(0, name);
    } else if (!player2.trim()) {
      setPlayer2(name);
      setEntry2('retry');
      setPlayer2Returning(true);
      markConfirmed(1, name);
    }
    setRejoinSearch('');
  };

  const handlePickReturning = (name: string) => fillReturning(name);

  const handlePickUnlisted = () => {
    const name = rejoinSearch.trim();
    if (!name) return;
    setPendingConfirm({ names: [name], onProceed: () => fillReturning(name) });
  };

  const handleAdd = () => {
    if (!player1.trim() || !player2.trim()) return;
    const doAdd = () => {
      onAddTeam(player1, player2, entry1, method1, entry2, method2);
      setPlayer1('');
      setPlayer2('');
      setPlayer1Returning(false);
      setPlayer2Returning(false);
      setConfirmedRetry([null, null]);
      setCutoffOverride([false, false]);
    };
    // Catches a name typed or changed after Retry was already selected.
    const unverified = ([[0, player1, entry1], [1, player2, entry2]] as const)
      .filter(([slot, name, entry]) => entry === 'retry' && !isRetryVerified(slot, name.trim()))
      .map(([, name]) => name.trim());
    if (unverified.length > 0) {
      setPendingConfirm({ names: unverified, onProceed: doAdd });
      return;
    }
    doAdd();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleClose = () => {
    if (confirm(`Close registration with ${teams.length} teams? No new teams can join after this — anyone still waiting for a partner gets a bye into the next round. This cannot be undone.`)) {
      onCloseRegistration();
    }
  };

  return (
    <div className="space-y-6">
      {/* Re-register a returning participant */}
      {!registrationClosed && (
        <div className="relative space-y-2">
          <Label className="text-lg font-semibold flex items-center gap-2">
            <Search className="w-5 h-5" />
            Re-register a Returning Player
          </Label>
          <Input
            value={rejoinSearch}
            onChange={(e) => setRejoinSearch(e.target.value)}
            placeholder="Start typing a name who already played tonight..."
            className="text-lg h-12"
          />
          {rejoinQuery && (
            <div className="absolute z-10 w-full mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden">
              {rejoinSuggestions.map(name => (
                <button
                  key={name}
                  onClick={() => handlePickReturning(name)}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-base"
                >
                  {name}
                </button>
              ))}
              {!rejoinIsOnList && (
                <button
                  onClick={handlePickUnlisted}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-sm text-muted-foreground border-t first:border-t-0"
                >
                  {rejoinSuggestions.length === 0 ? 'Not on today’s list' : 'Not on the list'} — re-enter “{rejoinSearch.trim()}” anyway…
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Team Form */}
      {registrationClosed ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Lock className="w-8 h-8 mx-auto mb-2" />
            <p className="text-lg font-semibold">Registration is closed</p>
            <p>{teams.length} teams entered — close this window to see the bracket</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="w-6 h-6" />
              Register New Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Player Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="player1" className="text-lg font-semibold">Player 1</Label>
                <Input
                  id="player1"
                  value={player1}
                  onChange={(e) => { setPlayer1(e.target.value); setPlayer1Returning(false); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Name..."
                  className="text-lg h-12"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player2" className="text-lg font-semibold">Player 2</Label>
                <Input
                  id="player2"
                  value={player2}
                  onChange={(e) => { setPlayer2(e.target.value); setPlayer2Returning(false); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Name..."
                  className="text-lg h-12"
                />
              </div>
            </div>

            {/* Player 1 Payment */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Player 1 Payment</Label>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Entry{player1Returning && ' — returning player, retry only'}
                  {!player1Returning && pastCutoff && !cutoffOverride[0] && (
                    <> — <button type="button" onClick={() => overrideCutoff(0)} className="underline text-orange-700 hover:text-orange-900">Before-9pm closed at 9pm — override</button></>
                  )}
                </p>
                <ButtonRow items={ENTRY_BUTTONS} selected={entry1} onSelect={(type) => selectEntry(0, type)} disabledTypes={entryDisabled(0, player1Returning)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <ButtonRow items={METHOD_BUTTONS} selected={method1} onSelect={setMethod1} />
              </div>
            </div>

            {/* Player 2 Payment */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Player 2 Payment</Label>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Entry{player2Returning && ' — returning player, retry only'}
                  {!player2Returning && pastCutoff && !cutoffOverride[1] && (
                    <> — <button type="button" onClick={() => overrideCutoff(1)} className="underline text-orange-700 hover:text-orange-900">Before-9pm closed at 9pm — override</button></>
                  )}
                </p>
                <ButtonRow items={ENTRY_BUTTONS} selected={entry2} onSelect={(type) => selectEntry(1, type)} disabledTypes={entryDisabled(1, player2Returning)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <ButtonRow items={METHOD_BUTTONS} selected={method2} onSelect={setMethod2} />
              </div>
            </div>

            {/* What to collect, right before it's collected */}
            <div className="rounded-lg border-2 border-dashed bg-muted px-4 py-3 text-center font-semibold">
              {collectSummary(player1, entry1, method1, player2, entry2, method2)}
            </div>

            {/* Add Button */}
            <Button
              onClick={handleAdd}
              disabled={!player1.trim() || !player2.trim()}
              className="w-full h-14 text-xl font-bold"
            >
              <Plus className="w-6 h-6 mr-2" />
              ADD TEAM
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Registered Teams List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-3">
            <span>Registered Teams ({teams.length})</span>
            {!registrationClosed && (
              <Button
                onClick={handleClose}
                disabled={teams.length < 2}
                variant="secondary"
                size="sm"
              >
                <Lock className="w-4 h-4 mr-1" />
                Finish Registration
              </Button>
            )}
          </CardTitle>
          {!registrationClosed && (
            <p className="text-sm text-muted-foreground">
              Games are already playable as teams pair up — check the Games tab. Only close registration once you're done taking new teams for the night.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Player 1</th>
                  <th className="text-left py-2 px-3">P1 Payment</th>
                  <th className="text-left py-2 px-3">Player 2</th>
                  <th className="text-left py-2 px-3">P2 Payment</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, idx) => (
                  <tr key={team.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium">{team.player1}</td>
                    <td className="py-2 px-3 space-x-1">
                      <Badge className={ENTRY_COLORS[team.entry1]}>{ENTRY_LABELS[team.entry1]}</Badge>
                      <Badge className={METHOD_COLORS[team.method1]}>{METHOD_LABELS[team.method1]}</Badge>
                    </td>
                    <td className="py-2 px-3 font-medium">{team.player2}</td>
                    <td className="py-2 px-3 space-x-1">
                      <Badge className={ENTRY_COLORS[team.entry2]}>{ENTRY_LABELS[team.entry2]}</Badge>
                      <Badge className={METHOD_COLORS[team.method2]}>{METHOD_LABELS[team.method2]}</Badge>
                    </td>
                    <td className="py-2 px-3">
                      {team.eliminated ? (
                        <Badge variant="destructive">Eliminated</Badge>
                      ) : (
                        <Badge variant="default">Round {team.round}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmReentryDialog
        names={pendingConfirm?.names ?? null}
        onCancel={() => setPendingConfirm(null)}
        onProceed={() => { const proceed = pendingConfirm?.onProceed; setPendingConfirm(null); proceed?.(); }}
      />
    </div>
  );
}
