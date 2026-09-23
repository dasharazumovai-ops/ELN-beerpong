import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Play, Trophy, Flag, Search, Minus, Plus, LayoutGrid } from 'lucide-react';
import FinishGameDialog from './FinishGameDialog';
import type { Game, Team } from '../types';
import { firstFreeTable } from '../types';

interface GamesPanelProps {
  games: Game[];
  onStartGame?: (gameId: string) => void;
  onFinishGame?: (gameId: string, winner: 'team1' | 'team2') => void;
  getTeam: (id: string | null) => Team | null;
  /** How many physical tables are set up tonight. Defaults to 5 if not given (e.g. very old data). */
  tableCount?: number;
  onSetTableCount?: (count: number) => void;
  /** Spectator mode (live view): no START/FINISH controls, no table-count editing. */
  readOnly?: boolean;
}

export default function GamesPanel({ games, onStartGame, onFinishGame, getTeam, tableCount = 5, onSetTableCount, readOnly }: GamesPanelProps) {
  const [finishingGameId, setFinishingGameId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const matchesSearch = (game: Game) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const t1 = getTeam(game.team1Id);
    const t2 = getTeam(game.team2Id);
    return [t1?.player1, t1?.player2, t2?.player1, t2?.player2].some(name => name?.toLowerCase().includes(q));
  };

  const activeGames = games.filter(g => g.status === 'active').filter(matchesSearch);
  const pendingGames = games.filter(g => g.status === 'pending' && g.team2Id !== null).filter(matchesSearch);
  const finishedGames = games.filter(g => g.status === 'finished' && !g.isBye).filter(matchesSearch);

  // Unfiltered by search — the tables overview is about the physical room, not whoever's
  // currently being searched for.
  const allActive = games.filter(g => g.status === 'active');
  const gameAtTable = (n: number) => allActive.find(g => g.tableNumber === n);
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a player or team..."
          className="max-w-xs h-9"
        />
      </div>

      {/* Tables overview — the physical room, not the bracket. Table numbers are only ever
          handed out to a game once it's actually started, so this always matches reality: a
          free box means that table is genuinely open right now. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Tables
            </span>
            {!readOnly && onSetTableCount && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => onSetTableCount(tableCount - 1)}
                  disabled={tableCount <= 1}
                  aria-label="Fewer tables"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-sm font-semibold w-6 text-center tabular-nums">{tableCount}</span>
                <Button size="icon-sm" variant="outline" onClick={() => onSetTableCount(tableCount + 1)} aria-label="More tables">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => {
              const game = gameAtTable(n);
              const t1 = game ? getTeam(game.team1Id) : null;
              const t2 = game ? getTeam(game.team2Id) : null;
              return (
                <div
                  key={n}
                  className={`rounded-lg border px-2 py-1.5 text-xs ${
                    game ? 'border-green-500 bg-green-50' : 'border-dashed border-gray-300 bg-muted/30'
                  }`}
                >
                  <div className="font-bold">Table {n}</div>
                  {game ? (
                    <div className="text-green-700 font-semibold whitespace-nowrap">Game {game.gameNumber}</div>
                  ) : (
                    <div className="text-muted-foreground">Free</div>
                  )}
                  {t1 && t2 && (
                    <div className="mt-0.5 text-muted-foreground leading-tight truncate">
                      {t1.player1} & {t1.player2} vs {t2.player1} & {t2.player2}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                    <CardTitle className="space-y-1">
                      <span className="flex items-center gap-2 text-xl">
                        <Play className="w-5 h-5 text-green-600 shrink-0" />
                        Game {game.gameNumber}
                      </span>
                      <div className="flex items-center gap-2 text-sm font-normal">
                        <span className="text-muted-foreground">R{game.round}</span>
                        {game.tableNumber !== null && (
                          <Badge variant="outline" className="border-green-600 text-green-700">Table {game.tableNumber}</Badge>
                        )}
                        <Badge className="bg-green-600 text-white">PLAYING</Badge>
                      </div>
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
                    {!readOnly && (
                      <Button
                        onClick={() => setFinishingGameId(game.id)}
                        className="w-full h-14 text-xl font-bold bg-red-500 hover:bg-red-600"
                      >
                        <Flag className="w-6 h-6 mr-2" />
                        FINISH GAME
                      </Button>
                    )}
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
                    <CardTitle className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold">Game {game.gameNumber}</span>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                      <span className="text-xs font-normal text-muted-foreground">R{game.round}</span>
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
                    {!readOnly && (
                      <Button
                        onClick={() => onStartGame?.(game.id)}
                        disabled={!hasFreeTable}
                        title={hasFreeTable ? undefined : 'No free tables right now — finish one first'}
                        className="w-full bg-green-500 hover:bg-green-600"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {hasFreeTable ? 'START' : 'NO FREE TABLES'}
                      </Button>
                    )}
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
                    <CardTitle className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold">Game {game.gameNumber}</span>
                        <Badge className="bg-red-500 text-white">Finished</Badge>
                      </div>
                      <span className="text-xs font-normal text-muted-foreground">R{game.round}</span>
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
          {search.trim() ? (
            <p className="text-xl">No games match "{search.trim()}"</p>
          ) : (
            <>
              <p className="text-xl">No games yet</p>
              <p>Register at least 2 teams to get the first game ready</p>
            </>
          )}
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
