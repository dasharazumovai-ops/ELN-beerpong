import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Trophy, Flag } from 'lucide-react';
import type { Game, Team } from '../types';

interface GamesPanelProps {
  games: Game[];
  onStartGame: (gameId: string) => void;
  onFinishGame: (gameId: string, winner: 'team1' | 'team2') => void;
  getTeam: (id: string | null) => Team | null;
}

export default function GamesPanel({ games, onStartGame, onFinishGame, getTeam }: GamesPanelProps) {
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [finishingGameId, setFinishingGameId] = useState<string | null>(null);

  const activeGames = games.filter(g => g.status === 'active');
  const pendingGames = games.filter(g => g.status === 'pending' && g.team2Id !== null);
  const finishedGames = games.filter(g => g.status === 'finished' && !g.isBye);

  const handleFinishClick = (gameId: string) => {
    setFinishingGameId(gameId);
    setShowWinnerDialog(true);
  };

  const handleWinnerSelect = (winner: 'team1' | 'team2') => {
    if (finishingGameId) {
      onFinishGame(finishingGameId, winner);
      setShowWinnerDialog(false);
      setFinishingGameId(null);
    }
  };

  const finishGameData = finishingGameId ? games.find(g => g.id === finishingGameId) : null;
  const finishTeam1 = finishGameData ? getTeam(finishGameData.team1Id) : null;
  const finishTeam2 = finishGameData ? getTeam(finishGameData.team2Id) : null;

  return (
    <div className="space-y-6">
      {/* Active Games - BIG and GREEN */}
      {activeGames.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Play className="w-5 h-5 text-green-600" />
            Active Games ({activeGames.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGames.map(game => {
              const t1 = getTeam(game.team1Id);
              const t2 = getTeam(game.team2Id);
              if (!t1 || !t2) return null;
              return (
                <Card key={game.id} className="border-green-500 border-4 bg-green-50 shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-green-600" />
                        Round {game.round} · Table {game.tableNumber}
                      </span>
                      <Badge className="bg-green-600 text-white">PLAYING</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <div className="text-2xl font-bold">{t1.player1}</div>
                        <div className="text-2xl font-bold">{t1.player2}</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <div className="text-2xl font-bold">{t2.player1}</div>
                        <div className="text-2xl font-bold">{t2.player2}</div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleFinishClick(game.id)}
                      className="w-full h-14 text-xl font-bold bg-red-500 hover:bg-red-600"
                    >
                      <Flag className="w-6 h-6 mr-2" />
                      FINISH GAME
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Games */}
      {pendingGames.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gray-500" />
            Ready to Play ({pendingGames.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingGames.map(game => {
              const t1 = getTeam(game.team1Id);
              const t2 = getTeam(game.team2Id);
              if (!t1 || !t2) return null;
              return (
                <Card key={game.id} className="border-gray-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>Round {game.round} · Table {game.tableNumber}</span>
                      <Badge variant="outline">Pending</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-center text-sm">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="font-semibold">{t1.player1}</div>
                        <div className="font-semibold">{t1.player2}</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <div className="font-semibold">{t2.player1}</div>
                        <div className="font-semibold">{t2.player2}</div>
                      </div>
                    </div>
                    <Button
                      onClick={() => onStartGame(game.id)}
                      className="w-full bg-green-500 hover:bg-green-600"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      START
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Finished Games */}
      {finishedGames.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-red-500" />
            Finished Games ({finishedGames.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {finishedGames.map(game => {
              const t1 = getTeam(game.team1Id);
              const t2 = getTeam(game.team2Id);
              const winner = game.winner === 'team1' ? t1 : t2;
              if (!t1 || !t2) return null;
              return (
                <Card key={game.id} className="border-red-400 border-2 bg-red-50 opacity-70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>Round {game.round} · Table {game.tableNumber}</span>
                      <Badge className="bg-red-500 text-white">Finished</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-center text-sm">
                      <div className={`rounded p-2 ${game.winner === 'team1' ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100'}`}>
                        <div className="font-semibold">{t1.player1}</div>
                        <div className="font-semibold">{t1.player2}</div>
                        {game.winner === 'team1' && <Trophy className="w-4 h-4 text-green-600 mx-auto mt-1" />}
                      </div>
                      <div className={`rounded p-2 ${game.winner === 'team2' ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100'}`}>
                        <div className="font-semibold">{t2.player1}</div>
                        <div className="font-semibold">{t2.player2}</div>
                        {game.winner === 'team2' && <Trophy className="w-4 h-4 text-green-600 mx-auto mt-1" />}
                      </div>
                    </div>
                    {winner && (
                      <div className="text-center text-green-700 font-bold text-sm">
                        Winner: {winner.player1} & {winner.player2}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeGames.length === 0 && pendingGames.length === 0 && finishedGames.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl">No games yet</p>
          <p>Register at least 2 teams to get the first game ready</p>
        </div>
      )}

      {/* Winner Selection Dialog */}
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Who Won?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-center text-muted-foreground">Select the winning team:</p>
            <div className="grid grid-cols-2 gap-4">
              {finishTeam1 && (
                <button
                  onClick={() => handleWinnerSelect('team1')}
                  className="p-6 rounded-xl border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all text-center space-y-2"
                >
                  <div className="text-2xl font-bold">{finishTeam1.player1}</div>
                  <div className="text-2xl font-bold">{finishTeam1.player2}</div>
                  <div className="text-sm text-muted-foreground">Team 1</div>
                </button>
              )}
              {finishTeam2 && (
                <button
                  onClick={() => handleWinnerSelect('team2')}
                  className="p-6 rounded-xl border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all text-center space-y-2"
                >
                  <div className="text-2xl font-bold">{finishTeam2.player1}</div>
                  <div className="text-2xl font-bold">{finishTeam2.player2}</div>
                  <div className="text-sm text-muted-foreground">Team 2</div>
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
