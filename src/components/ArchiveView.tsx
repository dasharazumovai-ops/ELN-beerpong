import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Archive as ArchiveIcon, Trophy, Calendar } from 'lucide-react';
import type { Tournament } from '../types';
import { getPaymentAmount, ENTRY_LABELS, METHOD_LABELS } from '../types';

interface ArchivedTournament extends Tournament {
  archivedAt?: string;
}

function revenueFor(t: Tournament) {
  return t.teams.reduce((sum, team) => sum + getPaymentAmount(team.entry1, team.method1) + getPaymentAmount(team.entry2, team.method2), 0);
}

function championOf(t: Tournament) {
  const active = t.teams.filter(team => !team.eliminated);
  return t.registrationClosed && active.length === 1 ? active[0] : null;
}

export default function ArchiveView() {
  const [entries, setEntries] = useState<{ id: string; data: ArchivedTournament }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'archive'), orderBy('archivedAt', 'desc')));
        if (!cancelled) setEntries(snap.docs.map(d => ({ id: d.id, data: d.data() as ArchivedTournament })));
      } catch {
        // network/permission issue — falls through to the empty state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Loading archive...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ArchiveIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-xl">No archived events yet</p>
        <p>Past events are saved here automatically when you hit Reset after a night's play</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(({ id, data }) => {
        const champion = championOf(data);
        const revenue = revenueFor(data);
        const expanded = expandedId === id;
        return (
          <Card key={id}>
            <CardHeader className="cursor-pointer select-none" onClick={() => setExpandedId(expanded ? null : id)}>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  {data.eventName}
                  <span className="text-muted-foreground font-normal">· {data.date}</span>
                </span>
                <div className="flex items-center gap-3 text-sm font-normal">
                  <span>{data.teams.length} teams</span>
                  <span>€{revenue.toFixed(2)}</span>
                  {champion && (
                    <Badge className="bg-yellow-100 text-yellow-900 border-yellow-400">
                      <Trophy className="w-3 h-3 mr-1" />
                      {champion.player1} & {champion.player2}
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            {expanded && (
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
                        <th className="text-left py-2 px-3">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teams.map((team, idx) => (
                        <tr key={team.id} className="border-b">
                          <td className="py-2 px-3">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium">{team.player1}</td>
                          <td className="py-2 px-3 text-xs">{ENTRY_LABELS[team.entry1]} · {METHOD_LABELS[team.method1]}</td>
                          <td className="py-2 px-3 font-medium">{team.player2}</td>
                          <td className="py-2 px-3 text-xs">{ENTRY_LABELS[team.entry2]} · {METHOD_LABELS[team.method2]}</td>
                          <td className="py-2 px-3">
                            {champion?.id === team.id ? (
                              <Badge className="bg-yellow-100 text-yellow-900 border-yellow-400">Champion</Badge>
                            ) : team.eliminated ? (
                              <Badge variant="destructive">Eliminated R{team.round}</Badge>
                            ) : (
                              <Badge variant="outline">Round {team.round}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
