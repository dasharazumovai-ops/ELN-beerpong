import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { Game, Team } from '../types';

interface BracketViewProps {
  teams: Team[];
  games: Game[];
  registrationClosed: boolean;
  getTeam: (id: string | null) => Team | null;
}

type Tone = 'champion' | 'active' | 'pending' | 'waiting' | 'lost';

const TONE_STYLES: Record<Tone, string> = {
  champion: 'bg-yellow-100 text-yellow-900 border-yellow-400',
  active: 'bg-green-100 text-green-800 border-green-400',
  pending: 'bg-blue-100 text-blue-800 border-blue-300',
  waiting: 'bg-gray-100 text-gray-700 border-gray-300',
  lost: 'bg-red-100 text-red-700 border-red-300',
};

function matchesSearch(team: Team, query: string) {
  const q = query.trim().toLowerCase();
  return !!q && (team.player1.toLowerCase().includes(q) || team.player2.toLowerCase().includes(q));
}

function statusFor(team: Team, games: Game[], isChampion: boolean): { label: string; tone: Tone } {
  if (team.eliminated) {
    const lostGame = games.filter(g => !g.isBye && g.status === 'finished' && (g.team1Id === team.id || g.team2Id === team.id))
      .sort((a, b) => b.round - a.round)[0];
    return { label: `Eliminated — Round ${lostGame ? lostGame.round : team.round}`, tone: 'lost' };
  }
  if (isChampion) return { label: 'Champion 🏆', tone: 'champion' };

  const currentGame = games.find(g => g.round === team.round && (g.team1Id === team.id || g.team2Id === team.id));
  if (!currentGame) return { label: `Round ${team.round}`, tone: 'waiting' };
  if (currentGame.status === 'active') return { label: `Playing now — Round ${team.round}, Table ${currentGame.tableNumber}`, tone: 'active' };
  if (currentGame.team2Id === null) return { label: `Round ${team.round} — waiting for a partner to register`, tone: 'waiting' };
  return { label: `Up next — Round ${team.round}, Table ${currentGame.tableNumber}`, tone: 'pending' };
}

export default function BracketView({ teams, games, registrationClosed, getTeam }: BracketViewProps) {
  const [search, setSearch] = useState('');

  const lastRound = games.length ? Math.max(...games.map(g => g.round)) : 0;
  const rounds = Array.from({ length: lastRound }, (_, i) => i + 1);
  const activeTeams = teams.filter(t => !t.eliminated);
  const championId = registrationClosed && activeTeams.length === 1 ? activeTeams[0].id : null;

  const statusById = useMemo(() => {
    const map = new Map<string, { label: string; tone: Tone }>();
    for (const team of teams) map.set(team.id, statusFor(team, games, team.id === championId));
    return map;
  }, [teams, games, championId]);

  const sortedTeams = [...teams].sort((a, b) => {
    const aTone = statusById.get(a.id)!.tone;
    const bTone = statusById.get(b.id)!.tone;
    if (aTone === 'champion' && bTone !== 'champion') return -1;
    if (bTone === 'champion' && aTone !== 'champion') return 1;
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (b.round !== a.round) return b.round - a.round;
    return a.player1.localeCompare(b.player1);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a player or team..."
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          {teams.length} teams entered{!registrationClosed ? ' · registration still open' : ''}
        </span>
      </div>

      {rounds.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-xl">No games yet</p>
          <p>The bracket fills in as teams register and start playing</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {rounds.map(round => {
              const roundGames = games.filter(g => g.round === round).sort((a, b) => a.slot - b.slot);
              return (
                <div key={round} className="w-64 shrink-0 space-y-3">
                  <h3 className="text-lg font-bold text-center">
                    {round === lastRound && championId ? 'Final' : `Round ${round}`}
                  </h3>
                  {roundGames.map(game => {
                    const t1 = getTeam(game.team1Id);
                    const t2 = getTeam(game.team2Id);

                    if (game.isBye) {
                      return (
                        <Card key={game.id} className={t1 && matchesSearch(t1, search) ? 'ring-2 ring-yellow-400' : ''}>
                          <CardContent className="py-3 text-center">
                            <div className="font-semibold text-sm">{t1 ? `${t1.player1} & ${t1.player2}` : 'Unknown'}</div>
                            <Badge variant="outline" className="mt-1 text-xs">Bye</Badge>
                          </CardContent>
                        </Card>
                      );
                    }

                    if (!t2) {
                      return (
                        <Card key={game.id} className={`border-dashed border-2 ${t1 && matchesSearch(t1, search) ? 'ring-2 ring-yellow-400 border-gray-200' : 'border-gray-200'}`}>
                          <CardContent className="py-3 text-center">
                            <div className="font-semibold text-sm">{t1 ? `${t1.player1} & ${t1.player2}` : 'Unknown'}</div>
                            <p className="text-xs text-muted-foreground mt-1">Waiting for opponent</p>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <Card key={game.id} className={game.status === 'active' ? 'border-green-500 border-2' : ''}>
                        <CardContent className="py-3 space-y-2">
                          <div className={`rounded p-2 text-center text-sm ${game.winner === 'team1' ? 'bg-green-100 font-semibold' : 'bg-gray-50'} ${t1 && matchesSearch(t1, search) ? 'ring-2 ring-yellow-400' : ''}`}>
                            {t1 ? `${t1.player1} & ${t1.player2}` : 'TBD'}
                          </div>
                          <div className="text-center text-xs text-muted-foreground">vs</div>
                          <div className={`rounded p-2 text-center text-sm ${game.winner === 'team2' ? 'bg-green-100 font-semibold' : 'bg-gray-50'} ${matchesSearch(t2, search) ? 'ring-2 ring-yellow-400' : ''}`}>
                            {t2.player1} & {t2.player2}
                          </div>
                          <div className="text-center">
                            <Badge variant={game.status === 'active' ? 'default' : game.status === 'finished' ? 'secondary' : 'outline'} className="text-xs">
                              {game.status === 'active' ? 'Playing' : `Table ${game.tableNumber}${game.status === 'pending' ? ' · Pending' : ''}`}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedTeams.filter(t => !search.trim() || matchesSearch(t, search)).map(team => {
              const status = statusById.get(team.id)!;
              return (
                <div key={team.id} className={`flex items-center justify-between p-3 rounded-lg border ${TONE_STYLES[status.tone]}`}>
                  <span className="font-semibold">{team.player1} & {team.player2}</span>
                  <span className="text-sm">{status.label}</span>
                </div>
              );
            })}
            {sortedTeams.length === 0 && <p className="text-muted-foreground">No teams registered yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
