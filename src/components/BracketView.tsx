import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronLeft, ChevronRight, Edit2, Save, X } from 'lucide-react';
import type { Game, Team } from '../types';

interface BracketViewProps {
  games: Game[];
  teams: Team[];
  currentRound: number;
  getTeam: (id: string | null) => Team | null;
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => void;
}

export default function BracketView({ games, teams, currentRound, getTeam, onUpdateTeam }: BracketViewProps) {
  const [viewRound, setViewRound] = useState(currentRound);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editNames, setEditNames] = useState({ player1: '', player2: '' });

  const roundGames = games.filter(g => g.round === viewRound);
  const maxRound = Math.max(...games.map(g => g.round), currentRound, 1);

  const startEditing = (team: Team) => {
    setEditingTeam(team.id);
    setEditNames({ player1: team.player1, player2: team.player2 });
  };

  const saveEdit = (teamId: string) => {
    onUpdateTeam(teamId, { player1: editNames.player1, player2: editNames.player2 });
    setEditingTeam(null);
  };

  const cancelEdit = () => {
    setEditingTeam(null);
  };

  return (
    <div className="space-y-4">
      {/* Round Navigator */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setViewRound(Math.max(1, viewRound - 1))}
          disabled={viewRound <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-2xl font-bold">Round {viewRound}</h2>
        <Button
          variant="outline"
          onClick={() => setViewRound(Math.min(maxRound, viewRound + 1))}
          disabled={viewRound >= maxRound}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Round Progress */}
      <div className="flex gap-2 justify-center flex-wrap">
        {Array.from({ length: maxRound }, (_, i) => i + 1).map(r => (
          <button
            key={r}
            onClick={() => setViewRound(r)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              r === viewRound
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Round {r}
          </button>
        ))}
      </div>

      {/* Games in this round */}
      {roundGames.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl">No games in Round {viewRound}</p>
          <p>Create games to see them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roundGames.map(game => {
            const t1 = getTeam(game.team1Id);
            const t2 = getTeam(game.team2Id);
            const winner = game.winner === 'team1' ? t1 : game.winner === 'team2' ? t2 : null;

            const statusColors = {
              pending: 'border-gray-300 bg-white',
              active: 'border-green-500 bg-green-50 border-4',
              finished: 'border-red-400 bg-red-50 border-2',
            };

            const statusBadges = {
              pending: <Badge variant="outline">Waiting</Badge>,
              active: <Badge className="bg-green-600 text-white">PLAYING</Badge>,
              finished: <Badge className="bg-red-500 text-white">Done</Badge>,
            };

            return (
              <Card key={game.id} className={statusColors[game.status]}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Table {game.tableNumber}</span>
                    {statusBadges[game.status]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Team 1 */}
                  {t1 && (
                    <div className={`p-3 rounded-lg flex items-center justify-between ${
                      game.winner === 'team1' ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50'
                    }`}>
                      {editingTeam === t1.id ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            value={editNames.player1}
                            onChange={(e) => setEditNames(p => ({ ...p, player1: e.target.value }))}
                            className="flex-1 px-2 py-1 border rounded"
                          />
                          <input
                            value={editNames.player2}
                            onChange={(e) => setEditNames(p => ({ ...p, player2: e.target.value }))}
                            className="flex-1 px-2 py-1 border rounded"
                          />
                          <Button size="sm" onClick={() => saveEdit(t1.id)}><Save className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold">
                            {t1.player1} <span className="text-muted-foreground">&</span> {t1.player2}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => startEditing(t1)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="text-center text-muted-foreground font-bold">VS</div>

                  {/* Team 2 */}
                  {t2 && (
                    <div className={`p-3 rounded-lg flex items-center justify-between ${
                      game.winner === 'team2' ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50'
                    }`}>
                      {editingTeam === t2.id ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            value={editNames.player1}
                            onChange={(e) => setEditNames(p => ({ ...p, player1: e.target.value }))}
                            className="flex-1 px-2 py-1 border rounded"
                          />
                          <input
                            value={editNames.player2}
                            onChange={(e) => setEditNames(p => ({ ...p, player2: e.target.value }))}
                            className="flex-1 px-2 py-1 border rounded"
                          />
                          <Button size="sm" onClick={() => saveEdit(t2.id)}><Save className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold">
                            {t2.player1} <span className="text-muted-foreground">&</span> {t2.player2}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => startEditing(t2)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {winner && (
                    <div className="text-center text-green-700 font-bold">
                      <Trophy className="w-4 h-4 inline mr-1" />
                      Winner: {winner.player1} & {winner.player2}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Remaining Teams Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Teams Still in Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {teams.filter(t => !t.eliminated).map(team => (
              <Badge key={team.id} variant="secondary" className="text-sm py-1 px-2">
                {team.player1} & {team.player2} (R{team.round})
              </Badge>
            ))}
          </div>
          {teams.filter(t => !t.eliminated).length === 0 && (
            <p className="text-muted-foreground">No teams remaining</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
