import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, RotateCcw, UserPlus, Clock, Moon, Gift, CreditCard, Banknote } from 'lucide-react';
import type { PaymentType, Team } from '../types';
import { PAYMENT_LABELS, PAYMENT_COLORS } from '../types';

interface RegistrationPanelProps {
  onAddTeam: (player1: string, player2: string, payment1: PaymentType, payment2: PaymentType, cash1?: number, cash2?: number, isRetry?: boolean) => string;
  teams: Team[];
}

const PAYMENT_BUTTONS: { type: PaymentType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'before9', label: 'Before 9pm (€3)', icon: <Clock className="w-5 h-5" />, color: 'bg-blue-500 hover:bg-blue-600' },
  { type: 'after9', label: 'After 9pm (€5)', icon: <Moon className="w-5 h-5" />, color: 'bg-purple-500 hover:bg-purple-600' },
  { type: 'retry', label: 'Retry (€3)', icon: <RotateCcw className="w-5 h-5" />, color: 'bg-orange-500 hover:bg-orange-600' },
  { type: 'revolut', label: 'Revolut (R)', icon: <CreditCard className="w-5 h-5" />, color: 'bg-green-500 hover:bg-green-600' },
  { type: 'free', label: 'Free (F)', icon: <Gift className="w-5 h-5" />, color: 'bg-gray-500 hover:bg-gray-600' },
  { type: 'cash', label: 'Cash', icon: <Banknote className="w-5 h-5" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
];

export default function RegistrationPanel({ onAddTeam, teams }: RegistrationPanelProps) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [payment1, setPayment1] = useState<PaymentType>('before9');
  const [payment2, setPayment2] = useState<PaymentType>('before9');
  const [cash1, setCash1] = useState('');
  const [cash2, setCash2] = useState('');
  const [isRetry, setIsRetry] = useState(false);

  const handleAdd = () => {
    if (!player1.trim() || !player2.trim()) return;
    onAddTeam(
      player1,
      player2,
      payment1,
      payment2,
      payment1 === 'cash' ? parseFloat(cash1) || 0 : undefined,
      payment2 === 'cash' ? parseFloat(cash2) || 0 : undefined,
      isRetry
    );
    setPlayer1('');
    setPlayer2('');
    setCash1('');
    setCash2('');
    setIsRetry(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="space-y-6">
      {/* Add Team Form */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="w-6 h-6" />
            Register New Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Payment for Player 1 */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Player 1 Payment</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_BUTTONS.map((btn) => (
                <button
                  key={btn.type}
                  onClick={() => setPayment1(btn.type)}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white font-semibold transition-all ${btn.color} ${
                    payment1 === btn.type ? 'ring-4 ring-offset-2 ring-black scale-105' : 'opacity-80'
                  }`}
                >
                  {btn.icon}
                  <span className="text-sm">{btn.label}</span>
                </button>
              ))}
            </div>
            {payment1 === 'cash' && (
              <Input
                type="number"
                value={cash1}
                onChange={(e) => setCash1(e.target.value)}
                placeholder="Amount in €..."
                className="h-12 text-lg"
              />
            )}
          </div>

          {/* Payment for Player 2 */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Player 2 Payment</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_BUTTONS.map((btn) => (
                <button
                  key={btn.type}
                  onClick={() => setPayment2(btn.type)}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white font-semibold transition-all ${btn.color} ${
                    payment2 === btn.type ? 'ring-4 ring-offset-2 ring-black scale-105' : 'opacity-80'
                  }`}
                >
                  {btn.icon}
                  <span className="text-sm">{btn.label}</span>
                </button>
              ))}
            </div>
            {payment2 === 'cash' && (
              <Input
                type="number"
                value={cash2}
                onChange={(e) => setCash2(e.target.value)}
                placeholder="Amount in €..."
                className="h-12 text-lg"
              />
            )}
          </div>

          {/* Retry Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="retry"
              checked={isRetry}
              onChange={(e) => setIsRetry(e.target.checked)}
              className="w-5 h-5"
            />
            <Label htmlFor="retry" className="text-lg cursor-pointer">
              This is a retry team (lost before, paying €3 to play again)
            </Label>
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

      {/* Registered Teams List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Registered Teams ({teams.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Player 1</th>
                  <th className="text-left py-2 px-3">P1 Pay</th>
                  <th className="text-left py-2 px-3">Player 2</th>
                  <th className="text-left py-2 px-3">P2 Pay</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, idx) => (
                  <tr key={team.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium">{team.player1}</td>
                    <td className="py-2 px-3">
                      <Badge className={PAYMENT_COLORS[team.payment1]}>
                        {PAYMENT_LABELS[team.payment1]}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-medium">{team.player2}</td>
                    <td className="py-2 px-3">
                      <Badge className={PAYMENT_COLORS[team.payment2]}>
                        {PAYMENT_LABELS[team.payment2]}
                      </Badge>
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
