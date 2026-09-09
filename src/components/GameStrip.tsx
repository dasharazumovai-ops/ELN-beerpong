import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Flag, Swords } from 'lucide-react';
import FinishGameDialog from './FinishGameDialog';
import type { Game, Team } from '../types';

interface GameStripProps {
  games: Game[];
  getTeam: (id: string | null) => Team | null;
  onStartGame: (gameId: string) => void;
  onFinishGame: (gameId: string, winner: 'team1' | 'team2') => void;
}

export default function GameStrip({ games, getTeam, onStartGame, onFinishGame }: GameStripProps) {
  const [finishingGameId, setFinishingGameId] = useState<string | null>(null);

  const active = games.filter(g => g.status === 'active');
  const pending = games.filter(g => g.status === 'pending' && g.team2Id !== null);
  const shown = [...active, ...pending];

  const handleWinnerSelect = (winner: 'team1' | 'team2') => {
    if (finishingGameId) {
      onFinishGame(finishingGameId, winner);
      setFinishingGameId(null);
    }
  };

  const finishGameData = finishingGameId ? games.find(g => g.id === finishingGameId) : null;
  const finishTeam1 = finishGameData ? getTeam(finishGameData.team1Id) : null;
  const finishTeam2 = finishGameData ? getTeam(finishGameData.team2Id) : null;

  return (
    <div className="border rounded-lg p-3 bg-card">
      <h3 className="font-semibold flex items-center gap-2 text-sm mb-2">
        <Swords className="w-4 h-4" />
        Games — {active.length} playing, {pending.length} waiting
      </h3>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No games ready yet — register at least 2 teams</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {shown.map(game => {
            const t1 = getTeam(game.team1Id);
            const t2 = getTeam(game.team2Id);
            if (!t1 || !t2) return null;
            const isActive = game.status === 'active';
            return (
              <div
                key={game.id}
                className={`shrink-0 w-44 rounded-lg border p-2.5 ${isActive ? 'border-green-500 border-2 bg-green-50' : 'border-gray-300'}`}
              >
                <div className="text-xs text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>R{game.round} · T{game.tableNumber}</span>
                  {isActive && <span className="text-green-700 font-semibold">LIVE</span>}
                </div>
                <div className="text-sm font-semibold leading-tight truncate">{t1.player1} & {t1.player2}</div>
                <div className="text-[11px] text-muted-foreground text-center my-0.5">vs</div>
                <div className="text-sm font-semibold leading-tight truncate">{t2.player1} & {t2.player2}</div>
                {isActive ? (
                  <Button size="sm" onClick={() => setFinishingGameId(game.id)} className="w-full mt-2 bg-red-500 hover:bg-red-600">
                    <Flag className="w-3.5 h-3.5 mr-1" />
                    Finish
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onStartGame(game.id)} className="w-full mt-2 bg-green-500 hover:bg-green-600">
                    <Play className="w-3.5 h-3.5 mr-1" />
                    Start
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FinishGameDialog
        open={finishingGameId !== null}
        onOpenChange={(open) => { if (!open) setFinishingGameId(null); }}
        team1={finishTeam1}
        team2={finishTeam2}
        onSelectWinner={handleWinnerSelect}
      />
    </div>
  );
}
