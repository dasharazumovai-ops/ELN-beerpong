import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Euro, TrendingUp, Users, CreditCard, Gift, Banknote } from 'lucide-react';
import type { Team } from '../types';
import { ENTRY_LABELS, ENTRY_COLORS, METHOD_LABELS, METHOD_COLORS, getPaymentAmount } from '../types';

interface PaymentSummaryProps {
  teams: Team[];
  totalRevenue: number;
}

export default function PaymentSummary({ teams, totalRevenue }: PaymentSummaryProps) {
  const before9Count = teams.filter(t => t.entry1 === 'before9' || t.entry2 === 'before9').length;
  const after9Count = teams.filter(t => t.entry1 === 'after9' || t.entry2 === 'after9').length;
  const retryCount = teams.filter(t => t.entry1 === 'retry' || t.entry2 === 'retry').length;
  const revolutCount = teams.filter(t => t.method1 === 'revolut' || t.method2 === 'revolut').length;
  const freeCount = teams.filter(t => t.method1 === 'free' || t.method2 === 'free').length;
  const cashCount = teams.filter(t => t.method1 === 'cash' || t.method2 === 'cash').length;
  const cashTotal = teams.reduce((sum, t) =>
    sum + (t.method1 === 'cash' ? getPaymentAmount(t.entry1, t.method1) : 0) + (t.method2 === 'cash' ? getPaymentAmount(t.entry2, t.method2) : 0),
    0);

  const stats = [
    { label: 'Total Teams', value: teams.length, icon: <Users className="w-5 h-5" /> },
    { label: 'Total Players', value: teams.length * 2, icon: <Users className="w-5 h-5" /> },
    { label: 'Total Revenue', value: `€${totalRevenue.toFixed(2)}`, icon: <Euro className="w-5 h-5" /> },
    { label: 'Cash Collected', value: `€${cashTotal.toFixed(2)}`, icon: <Banknote className="w-5 h-5" /> },
  ];

  const entryBreakdown = [
    { label: 'Before 9pm (€3)', count: before9Count, icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'After 9pm (€5)', count: after9Count, icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Retry (€3)', count: retryCount, icon: <TrendingUp className="w-4 h-4" /> },
  ];

  const methodBreakdown = [
    { label: 'Revolut', count: revolutCount, icon: <CreditCard className="w-4 h-4" /> },
    { label: 'Free', count: freeCount, icon: <Gift className="w-4 h-4" /> },
    { label: 'Cash', count: cashCount, icon: <Banknote className="w-4 h-4" /> },
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
          <CardTitle>Entry Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {entryBreakdown.map(item => (
              <div key={item.label} className="text-center p-4 bg-muted rounded-lg">
                <div className="flex justify-center mb-2">{item.icon}</div>
                <div className="text-2xl font-bold">{item.count}</div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {methodBreakdown.map(item => (
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
                const total = getPaymentAmount(team.entry1, team.method1) + getPaymentAmount(team.entry2, team.method2);
                return (
                  <TableRow key={team.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">{team.player1}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge className={ENTRY_COLORS[team.entry1]}>{ENTRY_LABELS[team.entry1]}</Badge>
                      <Badge className={METHOD_COLORS[team.method1]}>{METHOD_LABELS[team.method1]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{team.player2}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge className={ENTRY_COLORS[team.entry2]}>{ENTRY_LABELS[team.entry2]}</Badge>
                      <Badge className={METHOD_COLORS[team.method2]}>{METHOD_LABELS[team.method2]}</Badge>
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
