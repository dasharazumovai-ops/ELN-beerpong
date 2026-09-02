import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Trophy, Clock } from 'lucide-react';
import type { Game, Team } from '../types';

interface ProjectorViewProps {
  games: Game[];
  getTeam: (id: string | null) => Team | null;
  currentRound: number;
}

export default function ProjectorView({ games, getTeam, currentRound }: ProjectorViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeGames = games.filter(g => g.status === 'active');
  const pendingGames = games.filter(g => g.status === 'pending');

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">ELN Beer Pong</h1>
          <p className="text-2xl text-gray-400 mt-2">Round {currentRound}</p>
        </div>
        <div className="text-right">
          <div className="text-6xl font-mono font-bold">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* Active Games - Large Display */}
      {activeGames.length > 0 && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
            <Play className="w-8 h-8 text-green-400" />
            NOW PLAYING
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeGames.map(game => {
              const t1 = getTeam(game.team1Id);
              const t2 = getTeam(game.team2Id);
              if (!t1 || !t2) return null;
              return (
                <Card key={game.id} className="bg-green-900/80 border-green-500 border-4">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-white text-2xl">
                      <span className="flex items-center gap-3">
                        <Play className="w-7 h-7 text-green-400" />
                        TABLE {game.tableNumber}
                      </span>
                      <Badge className="bg-green-500 text-white text-lg px-4 py-1">LIVE</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6 text-center">
                      <div className="bg-black/40 rounded-xl p-6">
                        <div className="text-4xl font-bold">{t1.player1}</div>
                        <div className="text-4xl font-bold">{t1.player2}</div>
                      </div>
                      <div className="bg-black/40 rounded-xl p-6">
                        <div className="text-4xl font-bold">{t2.player1}</div>
                        <div className="text-4xl font-bold">{t2.player2}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Games */}
      {pendingGames.length > 0 && (
        <div>
          <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-gray-400" />
            UP NEXT
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pendingGames.slice(0, 8).map(game => {
              const t1 = getTeam(game.team1Id);
              const t2 = getTeam(game.team2Id);
              if (!t1 || !t2) return null;
              return (
                <Card key={game.id} className="bg-gray-900/80 border-gray-600">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-lg">Table {game.tableNumber}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-1">
                    <div className="text-xl font-semibold">{t1.player1} & {t1.player2}</div>
                    <div className="text-gray-400">vs</div>
                    <div className="text-xl font-semibold">{t2.player1} & {t2.player2}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* No Games */}
      {activeGames.length === 0 && pendingGames.length === 0 && (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-4xl font-bold">Waiting for games to start...</h2>
            <p className="text-2xl text-gray-400 mt-4">Register teams and create games to begin</p>
          </div>
        </div>
      )}
    </div>
  );
}
