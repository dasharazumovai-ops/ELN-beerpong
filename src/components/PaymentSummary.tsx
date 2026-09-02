import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Euro, TrendingUp, Users, CreditCard, Gift, Banknote } from 'lucide-react';
import type { Team } from '../types';
import { PAYMENT_LABELS, PAYMENT_COLORS, getPaymentAmount } from '../types';

interface PaymentSummaryProps {
  teams: Team[];
  totalRevenue: number;
}

export default function PaymentSummary({ teams, totalRevenue }: PaymentSummaryProps) {
  const before9Count = teams.filter(t => t.payment1 === 'before9' || t.payment2 === 'before9').length;
  const after9Count = teams.filter(t => t.payment1 === 'after9' || t.payment2 === 'after9').length;
  const retryCount = teams.filter(t => t.payment1 === 'retry' || t.payment2 === 'retry').length;
  const revolutCount = teams.filter(t => t.payment1 === 'revolut' || t.payment2 === 'revolut').length;
  const freeCount = teams.filter(t => t.payment1 === 'free' || t.payment2 === 'free').length;
  const cashTotal = teams.reduce((sum, t) => {
    let s = 0;
    if (t.payment1 === 'cash' && t.cashAmount1) s += t.cashAmount1;
    if (t.payment2 === 'cash' && t.cashAmount2) s += t.cashAmount2;
    return sum + s;
  }, 0);

  const stats = [
    { label: 'Total Teams', value: teams.length, icon: <Users className="w-5 h-5" /> },
    { label: 'Total Players', value: teams.length * 2, icon: <Users className="w-5 h-5" /> },
    { label: 'Total Revenue', value: `€${totalRevenue.toFixed(2)}`, icon: <Euro className="w-5 h-5" /> },
    { label: 'Cash Collected', value: `€${cashTotal.toFixed(2)}`, icon: <Banknote className="w-5 h-5" /> },
  ];

  const breakdown = [
    { label: 'Before 9pm (€3)', count: before9Count, icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'After 9pm (€5)', count: after9Count, icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Retry (€3)', count: retryCount, icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Revolut', count: revolutCount, icon: <CreditCard className="w-4 h-4" /> },
    { label: 'Free', count: freeCount, icon: <Gift className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className="text-muted-foreground">{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {breakdown.map(item => (
              <div key={item.label} className="text-center p-4 bg-muted rounded-lg">
                <div className="flex justify-center mb-2">{item.icon}</div>
                <div className="text-2xl font-bold">{item.count}</div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Payment Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Player 1</TableHead>
                <TableHead>P1 Payment</TableHead>
                <TableHead>Player 2</TableHead>
                <TableHead>P2 Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team, idx) => {
                const p1Amount = team.payment1 === 'cash' ? (team.cashAmount1 || 0) : getPaymentAmount(team.payment1, team.isFirstGame);
                const p2Amount = team.payment2 === 'cash' ? (team.cashAmount2 || 0) : getPaymentAmount(team.payment2, team.isFirstGame);
                const total = p1Amount + p2Amount;
                return (
                  <TableRow key={team.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">{team.player1}</TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_COLORS[team.payment1]}>
                        {PAYMENT_LABELS[team.payment1]}
                        {team.payment1 === 'cash' && team.cashAmount1 ? ` €${team.cashAmount1}` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{team.player2}</TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_COLORS[team.payment2]}>
                        {PAYMENT_LABELS[team.payment2]}
                        {team.payment2 === 'cash' && team.cashAmount2 ? ` €${team.cashAmount2}` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">€{total.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
