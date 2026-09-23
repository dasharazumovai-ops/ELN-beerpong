import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, Maximize2, Pencil, Flag, Trash2 } from 'lucide-react';
import FinishGameDialog from './FinishGameDialog';
import EditTeamDialog from './EditTeamDialog';
import type { Game, Team } from '../types';
import { makePlan } from '../bracketPlan';

interface BracketViewProps {
  teams: Team[];
  games: Game[];
  registrationClosed: boolean;
  getTeam: (id: string | null) => Team | null;
  onChangeWinner?: (gameId: string, winner: 'team1' | 'team2') => void;
  onDeleteGame?: (gameId: string) => void;
  onUpdateTeam?: (teamId: string, updates: Partial<Team>) => void;
  /** Spectator mode: no double-click-to-edit, no cursor/tooltip hints that imply it's editable. */
  readOnly?: boolean;
}

interface Connector {
  id: string;
  d: string;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.5;

// Cards are absolutely positioned, each centered between the two games that feed it (the slots
// the bracket plan sends into it). A game still waiting on one of them sits at that same
// midpoint, so it doesn't jump when its partner finishes. Games saved
// before the fixed tree existed can have arbitrary feeders, so those follow their recorded
// feeders instead. Anything that would overlap the card above it gets pushed down.
const CARD_HEIGHT_PX = 38;
const BASE_GAP = 6;

function computeLayout(games: Game[], registrationClosed: boolean) {
  const plan = makePlan(games, registrationClosed);
  const tops = new Map<string, number>();
  const heights = new Map<number, number>();
  const lastRound = games.length ? Math.max(...games.map(g => g.round)) : 0;

  for (let round = 1; round <= lastRound; round++) {
    const roundGames = games.filter(g => g.round === round).sort((a, b) => a.slot - b.slot);
    const desired = roundGames.map((game, index) => {
      const feederTops = (game.feederGameIds ?? [])
        .map(id => (id ? tops.get(id) : undefined))
        .filter((t): t is number => t !== undefined);
      const siblingTops = games
        .filter(g => g.round === round - 1 && plan.dest(round - 1, g.slot) === game.slot)
        .map(g => tops.get(g.id))
        .filter((t): t is number => t !== undefined);
      const anchors = feederTops.length === 2 ? feederTops : siblingTops.length ? siblingTops : feederTops;
      const top = anchors.length
        ? anchors.reduce((sum, t) => sum + t, 0) / anchors.length
        : index * (CARD_HEIGHT_PX + BASE_GAP);
      return { game, top, index };
    }).sort((a, b) => a.top - b.top || a.index - b.index);

    let nextFree = 0;
    for (const { game, top } of desired) {
      const placed = Math.max(top, nextFree);
      tops.set(game.id, placed);
      nextFree = placed + CARD_HEIGHT_PX + BASE_GAP;
    }
    heights.set(round, Math.max(0, nextFree - BASE_GAP));
  }
  return { tops, heights };
}

// The game's permanent number, tucked inside the card's top-right corner (there's spare room
// there, and it never sits over the team names on the left). Prominent while the match still
// matters for finding it in the room; once decided, it fades to a quiet number instead of
// competing for attention with the (finished/bye) cards, which is most of a big bracket.
function GameNumberBadge({ n, dim }: { n: number; dim: boolean }) {
  if (dim) {
    return <span className="absolute top-0.5 right-1 text-[9px] font-medium text-muted-foreground/60 leading-none">{n}</span>;
  }
  return (
    <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-white text-[9px] font-bold leading-none">
      {n}
    </span>
  );
}

// Card color follows game state: finished = dark grey, bye = light grey (dashed),
// active = green, ready to play = blue, waiting for a partner = lightest grey (dashed).
// No "vs", no table number — this view is for seeing the shape of the tree, not logistics.
function cardClasses(state: 'finished' | 'active' | 'pending' | 'waiting' | 'bye') {
  switch (state) {
    case 'finished': return 'bg-gray-300 border-gray-400';
    case 'bye': return 'bg-gray-200 border-gray-300 border-dashed';
    case 'active': return 'bg-green-200 border-green-500';
    case 'pending': return 'bg-blue-200 border-blue-500';
    case 'waiting': return 'bg-gray-50 border-gray-300 border-dashed';
  }
}

/** A match can only be deleted if some earlier real game can be sent back to replay — a bye is
 * not a game, so follow byes back to the game behind them. */
function hasReplayableFeeder(game: Game, games: Game[]): boolean {
  const feeders = (game.feederGameIds ?? []).filter((id): id is string => id !== null);
  if (feeders.length === 0) return false;
  return feeders.every(id => {
    let g = games.find(x => x.id === id);
    while (g?.isBye) {
      const upstream: string | null = g.feederGameIds?.[0] ?? null;
      g = upstream ? games.find(x => x.id === upstream) : undefined;
    }
    return !!g;
  });
}

export default function BracketView({ teams, games, registrationClosed, getTeam, onChangeWinner, onDeleteGame, onUpdateTeam, readOnly }: BracketViewProps) {
  const [zoom, setZoom] = useState(0.7);
  const [confirmGameId, setConfirmGameId] = useState<string | null>(null);
  const [repickGameId, setRepickGameId] = useState<string | null>(null);
  const [deleteGameId, setDeleteGameId] = useState<string | null>(null);
  // Double-clicking a card opens this chooser first, rather than jumping straight to whichever
  // single action used to be the only option — a card can have names to fix, a winner to
  // change and a match to delete all at once, so it asks which one you mean.
  const [actionsGameId, setActionsGameId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scaledRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  // The natural (pre-zoom) box of the scaled content. `transform: scale()` doesn't change
  // layout size, so a plain wrapper around it would report its UNSCALED height to the page —
  // but browsers still treat the zoomed-in paint as scrollable overflow, which an
  // overflow-x-auto ancestor then traps in an invisible internal scrollbar instead of
  // growing the page. Sizing an explicit spacer to naturalSize * zoom keeps the DOM footprint
  // matching what's actually drawn, so the page always has room to scroll to it.
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const layout = useMemo(() => computeLayout(games, registrationClosed), [games, registrationClosed]);
  const cardStyle = (gameId: string) => ({ top: layout.tops.get(gameId) ?? 0, height: CARD_HEIGHT_PX });

  const lastRound = games.length ? Math.max(...games.map(g => g.round)) : 0;
  const rounds = Array.from({ length: lastRound }, (_, i) => i + 1);
  const activeTeams = teams.filter(t => !t.eliminated);
  const championId = registrationClosed && activeTeams.length === 1 ? activeTeams[0].id : null;

  const confirmGame = confirmGameId ? games.find(g => g.id === confirmGameId) ?? null : null;
  const confirmWinnerTeam = confirmGame ? getTeam(confirmGame.winner === 'team1' ? confirmGame.team1Id : confirmGame.team2Id) : null;
  const repickGame = repickGameId ? games.find(g => g.id === repickGameId) ?? null : null;
  const repickTeam1 = repickGame ? getTeam(repickGame.team1Id) : null;
  const repickTeam2 = repickGame ? getTeam(repickGame.team2Id) : null;

  const handleConfirmChange = () => {
    setRepickGameId(confirmGameId);
    setConfirmGameId(null);
  };

  const handleRepickWinner = (winner: 'team1' | 'team2') => {
    if (repickGameId) onChangeWinner?.(repickGameId, winner);
    setRepickGameId(null);
  };

  const deleteTargetGame = deleteGameId ? games.find(g => g.id === deleteGameId) ?? null : null;
  const deleteFeederGames = deleteTargetGame
    ? (deleteTargetGame.feederGameIds ?? [])
        .filter((id): id is string => id !== null)
        .map(id => games.find(g => g.id === id))
        .filter((g): g is Game => !!g)
    : [];
  const deleteFeederLabel = deleteFeederGames
    .map(g => {
      const t1 = getTeam(g.team1Id);
      const t2 = getTeam(g.team2Id);
      if (!t2) return t1 ? `${t1.player1} & ${t1.player2}` : null;
      return `${t1?.player1} & ${t1?.player2} vs ${t2.player1} & ${t2.player2}`;
    })
    .filter((label): label is string => !!label)
    .join(' and ');

  const handleConfirmDelete = () => {
    if (deleteGameId) onDeleteGame?.(deleteGameId);
    setDeleteGameId(null);
  };

  const actionsGame = actionsGameId ? games.find(g => g.id === actionsGameId) ?? null : null;
  const actionsT1 = actionsGame ? getTeam(actionsGame.team1Id) : null;
  const actionsT2 = actionsGame ? getTeam(actionsGame.team2Id) : null;
  const actionsCanChangeWinner = !readOnly && actionsGame?.status === 'finished' && !actionsGame.isBye;
  const actionsCanDelete = !readOnly && !!actionsGame && !actionsGame.isBye && actionsGame.status !== 'finished'
    && hasReplayableFeeder(actionsGame, games);

  const editTeam = editTeamId ? teams.find(t => t.id === editTeamId) ?? null : null;
  // Who a "retry" re-entry can legitimately point back to: everyone registered on any OTHER team.
  const otherParticipantNames = editTeamId
    ? teams.filter(t => t.id !== editTeamId).flatMap(t => [t.player1, t.player2])
    : [];

  useLayoutEffect(() => {
    const scaled = scaledRef.current;
    if (!scaled) return;

    const compute = () => {
      const anchorRect = scaled.getBoundingClientRect();
      const paths: Connector[] = [];

      for (const game of games) {
        for (const feederId of game.feederGameIds ?? []) {
          if (!feederId) continue;
          const sourceEl = cardRefs.current.get(feederId);
          const targetEl = cardRefs.current.get(game.id);
          if (!sourceEl || !targetEl) continue;

          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          const sx = (sRect.right - anchorRect.left) / zoom;
          const sy = (sRect.top + sRect.height / 2 - anchorRect.top) / zoom;
          const tx = (tRect.left - anchorRect.left) / zoom;
          const ty = (tRect.top + tRect.height / 2 - anchorRect.top) / zoom;
          const midX = (sx + tx) / 2;

          paths.push({ id: `${feederId}-${game.id}`, d: `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}` });
        }
      }

      setConnectors(paths);
      setSvgSize({ width: scaled.scrollWidth, height: scaled.scrollHeight });
      setNaturalSize({ width: scaled.offsetWidth, height: scaled.offsetHeight });
    };

    compute();
    const resizeObserver = new ResizeObserver(compute);
    resizeObserver.observe(scaled);
    return () => resizeObserver.disconnect();
  }, [games, zoom]);

  // Trackpad pinch (reported as wheel + ctrlKey) zooms the tree instead of the page.
  // Needs a non-passive native listener since React's onWheel can't preventDefault reliably.
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Zoom must stay anchored under the cursor, not the top-left corner — otherwise zooming
  // anywhere but the top-left edge drags the view toward that corner instead of the point
  // you're actually looking at. Record which content point is under the cursor before the
  // zoom changes, then re-scroll to keep that same point under the cursor after. The bracket
  // container itself never scrolls (in either direction) — it just grows with its (scaled)
  // content — so the anchor moves the PAGE's scroll, not any scrollbar on the container.
  const pendingAnchorRef = useRef<{ contentX: number; contentY: number; offsetX: number; offsetY: number; pageScrollX: number; pageScrollY: number } | null>(null);
  // Last mouse position seen over the bracket, so the zoom buttons (and keyboard/other
  // triggers with no coordinate of their own) can anchor to "wherever you're hovering"
  // instead of always the last wheel event.
  const hoverPosRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      hoverPosRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    };
    el.addEventListener('mousemove', onMouseMove);
    return () => el.removeEventListener('mousemove', onMouseMove);
  }, []);

  const zoomAnchored = (nextZoom: (z: number) => number, at?: { offsetX: number; offsetY: number }) => {
    const el = scrollRef.current;
    if (!el) { setZoom(nextZoom); return; }
    const rect = el.getBoundingClientRect();
    const { offsetX, offsetY } = at ?? hoverPosRef.current ?? { offsetX: rect.width / 2, offsetY: rect.height / 2 };
    const currentZoom = zoomRef.current;
    pendingAnchorRef.current = {
      contentX: offsetX / currentZoom,
      contentY: offsetY / currentZoom,
      offsetX,
      offsetY,
      pageScrollX: window.scrollX,
      pageScrollY: window.scrollY,
    };
    setZoom(nextZoom);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAnchored(
        z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z - e.deltaY * 0.01).toFixed(2))),
        { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top },
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    window.scrollTo({
      left: anchor.pageScrollX + anchor.contentX * zoom - anchor.offsetX,
      top: anchor.pageScrollY + anchor.contentY * zoom - anchor.offsetY,
    });
    pendingAnchorRef.current = null;
  }, [zoom]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-end gap-1">
        <Button size="icon-sm" variant="outline" onClick={() => zoomAnchored(z => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="icon-sm" variant="outline" onClick={() => zoomAnchored(z => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => setZoom(0.7)}>
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {rounds.length === 0 ? (
        <div className="flex items-center justify-center text-center text-muted-foreground border rounded-lg" style={{ minHeight: '120vh' }}>
          <div>
            <p className="text-xl">No games yet</p>
            <p>The bracket fills in as teams register and start playing</p>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="border rounded" style={{ minHeight: '120vh' }}>
          <div style={{ width: naturalSize.width * zoom || undefined, height: naturalSize.height * zoom || undefined, position: 'relative' }}>
          <div ref={scaledRef} className="p-2 relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'max-content', position: 'absolute', top: 0, left: 0 }}>
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={svgSize.width}
              height={svgSize.height}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker id="bracket-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground" />
                </marker>
              </defs>
              {connectors.map(c => (
                <path
                  key={c.id}
                  d={c.d}
                  className="stroke-muted-foreground"
                  fill="none"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  markerEnd="url(#bracket-arrow)"
                />
              ))}
            </svg>
            <div className="flex gap-10 relative">
              {rounds.map(round => {
                const roundGames = games.filter(g => g.round === round).sort((a, b) => a.slot - b.slot);
                return (
                  <div key={round} className="w-36 shrink-0">
                    <h3 className="text-xs font-bold text-center text-muted-foreground uppercase tracking-wide mb-1.5">
                      {round === lastRound && championId ? 'Final' : `R${round}`}
                    </h3>
                    <div className="relative" style={{ height: layout.heights.get(round) ?? 0 }}>
                    {roundGames.map(game => {
                      const t1 = getTeam(game.team1Id);
                      const t2 = getTeam(game.team2Id);
                      const setRef = (el: HTMLDivElement | null) => {
                        if (el) cardRefs.current.set(game.id, el);
                        else cardRefs.current.delete(game.id);
                      };

                      if (game.isBye) {
                        const canEditBye = !readOnly && !!t1;
                        return (
                          <div
                            key={game.id}
                            ref={setRef}
                            style={cardStyle(game.id)}
                            onDoubleClick={() => { if (canEditBye) setActionsGameId(game.id); }}
                            title={canEditBye ? 'Double-click to edit names' : undefined}
                            className={`absolute inset-x-0 flex flex-col justify-center overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses('bye')} ${canEditBye ? 'cursor-pointer' : ''}`}
                          >
                            <GameNumberBadge n={game.gameNumber} dim />
                            <div className="pr-4 font-semibold truncate">{t1 ? `${t1.player1} & ${t1.player2}` : 'Unknown'}</div>
                            <div className="pr-4 text-muted-foreground truncate">Bye</div>
                          </div>
                        );
                      }

                      if (!t2) {
                        const canAct = !readOnly && !!t1;
                        return (
                          <div
                            key={game.id}
                            ref={setRef}
                            style={cardStyle(game.id)}
                            onDoubleClick={() => { if (canAct) setActionsGameId(game.id); }}
                            title={canAct ? 'Double-click for options' : undefined}
                            className={`absolute inset-x-0 flex flex-col justify-center overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses('waiting')} ${canAct ? 'cursor-pointer' : ''}`}
                          >
                            <GameNumberBadge n={game.gameNumber} dim={false} />
                            <div className="pr-4 font-medium truncate">{t1 ? `${t1.player1} & ${t1.player2}` : 'Unknown'}</div>
                            <div className="pr-4 text-muted-foreground truncate">waiting for opponent</div>
                          </div>
                        );
                      }

                      const state = game.status === 'active' ? 'active' : game.status === 'finished' ? 'finished' : 'pending';
                      const canAct = !readOnly;
                      return (
                        <div
                          key={game.id}
                          ref={setRef}
                          style={cardStyle(game.id)}
                          onDoubleClick={() => { if (canAct) setActionsGameId(game.id); }}
                          title={canAct ? 'Double-click for options' : undefined}
                          className={`absolute inset-x-0 flex flex-col justify-center overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses(state)} ${canAct ? 'cursor-pointer' : ''}`}
                        >
                          <GameNumberBadge n={game.gameNumber} dim={game.status === 'finished'} />
                          <div className={`pr-4 truncate ${game.winner === 'team1' ? 'font-semibold' : ''}`}>{t1 ? `${t1.player1} & ${t1.player2}` : 'TBD'}</div>
                          <div className={`pr-4 truncate ${game.winner === 'team2' ? 'font-semibold' : ''}`}>{t2.player1} & {t2.player2}</div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmGameId !== null} onOpenChange={(open) => { if (!open) setConfirmGameId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the winner?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmWinnerTeam
                ? `This game was decided as ${confirmWinnerTeam.player1} & ${confirmWinnerTeam.player2} winning. Do you want to pick a different winner?`
                : 'Do you want to pick a different winner for this game?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FinishGameDialog
        open={repickGameId !== null}
        onOpenChange={(open) => { if (!open) setRepickGameId(null); }}
        team1={repickTeam1}
        team2={repickTeam2}
        onSelectWinner={handleRepickWinner}
      />

      <AlertDialog open={deleteGameId !== null} onOpenChange={(open) => { if (!open) setDeleteGameId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the match and sends {deleteFeederLabel || 'its earlier match'} back to
              an active game, so you can play {deleteFeederGames.length > 1 ? 'them' : 'it'} again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={actionsGameId !== null} onOpenChange={(open) => { if (!open) setActionsGameId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionsT1 && actionsT2
                ? `${actionsT1.player1} & ${actionsT1.player2} vs ${actionsT2.player1} & ${actionsT2.player2}`
                : actionsT1 ? `${actionsT1.player1} & ${actionsT1.player2}` : 'Match options'}
            </DialogTitle>
            <DialogDescription>What do you want to do with this match?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {actionsT1 && (
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => { setEditTeamId(actionsT1.id); setActionsGameId(null); }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit {actionsT1.player1} & {actionsT1.player2}
              </Button>
            )}
            {actionsT2 && (
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => { setEditTeamId(actionsT2.id); setActionsGameId(null); }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit {actionsT2.player1} & {actionsT2.player2}
              </Button>
            )}
            {actionsCanChangeWinner && (
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => { setConfirmGameId(actionsGameId); setActionsGameId(null); }}
              >
                <Flag className="w-4 h-4 mr-2" />
                Change the winner
              </Button>
            )}
            {actionsCanDelete && (
              <Button
                variant="outline"
                className="justify-start text-destructive hover:text-destructive"
                onClick={() => { setDeleteGameId(actionsGameId); setActionsGameId(null); }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete this match & go back to the previous game
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditTeamDialog
        team={editTeam}
        otherParticipantNames={otherParticipantNames}
        onOpenChange={(open) => { if (!open) setEditTeamId(null); }}
        onSave={(teamId, updates) => onUpdateTeam?.(teamId, updates)}
      />
    </div>
  );
}
