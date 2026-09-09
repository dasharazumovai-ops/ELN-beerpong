import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { Game, Team } from '../types';

interface BracketViewProps {
  teams: Team[];
  games: Game[];
  registrationClosed: boolean;
  getTeam: (id: string | null) => Team | null;
}

function matchesSearch(team: Team, query: string) {
  const q = query.trim().toLowerCase();
  return !!q && (team.player1.toLowerCase().includes(q) || team.player2.toLowerCase().includes(q));
}

export default function BracketView({ teams, games, registrationClosed, getTeam }: BracketViewProps) {
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);

  const lastRound = games.length ? Math.max(...games.map(g => g.round)) : 0;
  const rounds = Array.from({ length: lastRound }, (_, i) => i + 1);
  const activeTeams = teams.filter(t => !t.eliminated);
  const championId = registrationClosed && activeTeams.length === 1 ? activeTeams[0].id : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a player or team..."
          className="max-w-xs h-8"
        />
        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon-sm" variant="outline" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button size="icon-sm" variant="outline" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setZoom(1)}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <p className="text-xl">No games yet</p>
          <p>The bracket fills in as teams register and start playing</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto" style={{ height: '48vh' }}>
          <div className="p-4" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'max-content' }}>
            <div className="flex gap-4">
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
        </div>
      )}
    </div>
  );
}
