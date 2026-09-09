import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, RotateCcw, UserPlus, Clock, Moon, Gift, CreditCard, Banknote, Lock } from 'lucide-react';
import type { EntryType, PaymentMethod, Team } from '../types';
import { ENTRY_LABELS, ENTRY_COLORS, METHOD_LABELS, METHOD_COLORS } from '../types';

interface RegistrationPanelProps {
  onAddTeam: (player1: string, player2: string, entry1: EntryType, method1: PaymentMethod, entry2: EntryType, method2: PaymentMethod) => string;
  onCloseRegistration: () => void;
  registrationClosed: boolean;
  teams: Team[];
}

const ENTRY_BUTTONS: { type: EntryType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'before9', label: 'Before 9pm (€3)', icon: <Clock className="w-5 h-5" />, color: 'bg-blue-500 hover:bg-blue-600' },
  { type: 'after9', label: 'After 9pm (€5)', icon: <Moon className="w-5 h-5" />, color: 'bg-purple-500 hover:bg-purple-600' },
  { type: 'retry', label: 'Retry (€3)', icon: <RotateCcw className="w-5 h-5" />, color: 'bg-orange-500 hover:bg-orange-600' },
];

const METHOD_BUTTONS: { type: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'revolut', label: 'Revolut (R)', icon: <CreditCard className="w-5 h-5" />, color: 'bg-green-500 hover:bg-green-600' },
  { type: 'free', label: 'Free (F)', icon: <Gift className="w-5 h-5" />, color: 'bg-gray-500 hover:bg-gray-600' },
  { type: 'cash', label: 'Cash', icon: <Banknote className="w-5 h-5" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
];

function ButtonRow<T extends string>({ items, selected, onSelect }: { items: { type: T; label: string; icon: React.ReactNode; color: string }[]; selected: T; onSelect: (type: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((btn) => (
        <button
          key={btn.type}
          onClick={() => onSelect(btn.type)}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white font-semibold transition-all ${btn.color} ${
            selected === btn.type ? 'ring-2 ring-offset-2 ring-black' : 'opacity-70'
          }`}
        >
          {btn.icon}
          <span className="text-sm">{btn.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function RegistrationPanel({ onAddTeam, onCloseRegistration, registrationClosed, teams }: RegistrationPanelProps) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [entry1, setEntry1] = useState<EntryType>('before9');
  const [method1, setMethod1] = useState<PaymentMethod>('revolut');
  const [entry2, setEntry2] = useState<EntryType>('before9');
  const [method2, setMethod2] = useState<PaymentMethod>('revolut');

  const handleAdd = () => {
    if (!player1.trim() || !player2.trim()) return;
    onAddTeam(player1, player2, entry1, method1, entry2, method2);
    setPlayer1('');
    setPlayer2('');
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
                  onChange={(e) => setPlayer1(e.target.value)}
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
                  onChange={(e) => setPlayer2(e.target.value)}
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
                <p className="text-sm text-muted-foreground">Entry</p>
                <ButtonRow items={ENTRY_BUTTONS} selected={entry1} onSelect={setEntry1} />
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
                <p className="text-sm text-muted-foreground">Entry</p>
                <ButtonRow items={ENTRY_BUTTONS} selected={entry2} onSelect={setEntry2} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <ButtonRow items={METHOD_BUTTONS} selected={method2} onSelect={setMethod2} />
              </div>
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
    </div>
  );
}
