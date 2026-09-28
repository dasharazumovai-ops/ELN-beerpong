import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Flag, Swords } from 'lucide-react';
import FinishGameDialog from './FinishGameDialog';
import type { Game, Team } from '../types';
import { firstFreeTable } from '../types';

interface GameStripProps {
  games: Game[];
  getTeam: (id: string | null) => Team | null;
  onStartGame?: (gameId: string) => void;
  onFinishGame?: (gameId: string, winner: 'team1' | 'team2') => void;
  /** How many physical tables are set up tonight — gates the Start buttons below. Defaults to 5. */
  tableCount?: number;
  readOnly?: boolean;
}

export default function GameStrip({ games, getTeam, onStartGame, onFinishGame, tableCount = 5, readOnly }: GameStripProps) {
  const [finishingGameId, setFinishingGameId] = useState<string | null>(null);

  const active = games.filter(g => g.status === 'active');
  const pending = games.filter(g => g.status === 'pending' && g.team2Id !== null);
  const shown = [...active, ...pending];
  const hasFreeTable = firstFreeTable(games, tableCount) !== null;

  const handleWinnerSelect = (winner: 'team1' | 'team2') => {
    if (finishingGameId) {
      onFinishGame?.(finishingGameId, winner);
      setFinishingGameId(null);
    }
  };

  const finishGameData = finishingGameId ? games.find(g => g.id === finishingGameId) : null;
  const finishTeam1 = finishGameData ? getTeam(finishGameData.team1Id) : null;
  const finishTeam2 = finishGameData ? getTeam(finishGameData.team2Id) : null;

  return (
    <div className="border rounded-lg px-4 py-3 bg-card">
      <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Swords className="w-4 h-4" />
        Games — {active.length} playing, {pending.length} waiting
      </h3>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">No games ready yet — register at least 2 teams</p>
      ) : (
        // Each card below is exactly one seventh of the row (minus the six 0.5rem gaps), so seven
        // are always visible at once and more scroll sideways; the min width only kicks in on
        // screens too narrow to keep the names legible at that size.
        <div className="flex gap-2 overflow-x-auto pb-1">
          {shown.map(game => {
            const t1 = getTeam(game.team1Id);
            const t2 = getTeam(game.team2Id);
            if (!t1 || !t2) return null;
            const isActive = game.status === 'active';
            return (
              <div
                key={game.id}
                className={`shrink-0 min-w-[7rem] w-[calc((100%-3rem)/7)] rounded-lg border px-2.5 py-2 ${isActive ? 'border-green-500 border-2 bg-green-50' : 'border-gray-300'}`}
              >
                <div className="text-xs text-muted-foreground flex items-center justify-between mb-0.5">
                  <span>Game {game.gameNumber}{isActive && game.tableNumber !== null ? ` · Table ${game.tableNumber}` : ''}</span>
                  {isActive && <span className="text-green-700 font-semibold">LIVE</span>}
                </div>
                <div className="text-sm font-medium truncate leading-snug">{t1.player1} & {t1.player2}</div>
                <div className="text-sm font-medium truncate leading-snug">{t2.player1} & {t2.player2}</div>
                {!readOnly && (isActive ? (
                  <Button size="sm" onClick={() => setFinishingGameId(game.id)} className="w-full mt-2 h-8 text-sm bg-red-500 hover:bg-red-600">
                    <Flag className="w-4 h-4 mr-1" />
                    Finish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onStartGame?.(game.id)}
                    disabled={!hasFreeTable}
                    title={hasFreeTable ? undefined : 'No free tables right now'}
                    className="w-full mt-2 h-8 text-sm bg-green-500 hover:bg-green-600"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    {hasFreeTable ? 'Start' : 'Full'}
                  </Button>
                ))}
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
