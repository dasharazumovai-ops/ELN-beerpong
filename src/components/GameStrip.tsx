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
    <div className="border rounded-lg px-3 py-2 bg-card">
      <h3 className="font-semibold flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
        <Swords className="w-3.5 h-3.5" />
        Games — {active.length} playing, {pending.length} waiting
      </h3>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">No games ready yet — register at least 2 teams</p>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {shown.map(game => {
            const t1 = getTeam(game.team1Id);
            const t2 = getTeam(game.team2Id);
            if (!t1 || !t2) return null;
            const isActive = game.status === 'active';
            return (
              <div
                key={game.id}
                className={`shrink-0 w-36 rounded-lg border px-2 py-1 ${isActive ? 'border-green-500 border-2 bg-green-50' : 'border-gray-300'}`}
              >
                <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>R{game.round}</span>
                  {isActive && <span className="text-green-700 font-semibold">LIVE</span>}
                </div>
                <div className="text-xs font-medium truncate leading-tight">{t1.player1} & {t1.player2}</div>
                <div className="text-xs font-medium truncate leading-tight">{t2.player1} & {t2.player2}</div>
                {isActive ? (
                  <Button size="sm" onClick={() => setFinishingGameId(game.id)} className="w-full mt-1 h-6 text-xs bg-red-500 hover:bg-red-600">
                    <Flag className="w-3 h-3 mr-1" />
                    Finish
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onStartGame(game.id)} className="w-full mt-1 h-6 text-xs bg-green-500 hover:bg-green-600">
                    <Play className="w-3 h-3 mr-1" />
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
