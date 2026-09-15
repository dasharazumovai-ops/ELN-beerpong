import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import FinishGameDialog from './FinishGameDialog';
import type { Game, Team } from '../types';

interface BracketViewProps {
  teams: Team[];
  games: Game[];
  registrationClosed: boolean;
  getTeam: (id: string | null) => Team | null;
  onChangeWinner: (gameId: string, winner: 'team1' | 'team2') => void;
}

interface Connector {
  id: string;
  d: string;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.5;

// H = fixed height of a single card, G = the round-1 gap between cards. Recursively:
//   gap(n)    = 2 * gap(n-1) + H       (each round needs 2x its predecessor's room, plus a card)
//   offset(n) = offset(n-1) + (H + gap(n-1)) / 2   (nudge down to center against round n-1)
// which closes to the two formulas below — this is what actually centers a card between its
// two feeders; a merely-doubling gap or a linear offset both leave connectors mis-landing.
const CARD_HEIGHT_PX = 36;
const BASE_GAP = 6;
function roundGapPx(round: number) {
  return (BASE_GAP + CARD_HEIGHT_PX) * 2 ** (round - 1) - CARD_HEIGHT_PX;
}
function roundOffsetPx(round: number) {
  return ((CARD_HEIGHT_PX + BASE_GAP) / 2) * (2 ** (round - 1) - 1);
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

export default function BracketView({ teams, games, registrationClosed, getTeam, onChangeWinner }: BracketViewProps) {
  const [zoom, setZoom] = useState(0.7);
  const [confirmGameId, setConfirmGameId] = useState<string | null>(null);
  const [repickGameId, setRepickGameId] = useState<string | null>(null);
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
    if (repickGameId) onChangeWinner(repickGameId, winner);
    setRepickGameId(null);
  };

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
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <p className="text-xl">No games yet</p>
          <p>The bracket fills in as teams register and start playing</p>
        </div>
      ) : (
        <div ref={scrollRef} className="border rounded" style={{ minHeight: '40vh' }}>
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
                    <div className="flex flex-col" style={{ gap: `${roundGapPx(round)}px`, marginTop: `${roundOffsetPx(round)}px` }}>
                    {roundGames.map(game => {
                      const t1 = getTeam(game.team1Id);
                      const t2 = getTeam(game.team2Id);
                      const setRef = (el: HTMLDivElement | null) => {
                        if (el) cardRefs.current.set(game.id, el);
                        else cardRefs.current.delete(game.id);
                      };

                      if (game.isBye) {
                        return (
                          <div key={game.id} ref={setRef} className={`rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses('bye')}`}>
                            <div className="font-semibold truncate">{t1 ? `${t1.player1} & ${t1.player2}` : 'Unknown'}</div>
                            <div className="text-muted-foreground truncate">Bye</div>
                          </div>
                        );
                      }

                      if (!t2) {
                        return (
                          <div key={game.id} ref={setRef} className={`rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses('waiting')}`}>
                            <div className="font-medium truncate">{t1 ? `${t1.player1} & ${t1.player2}` : 'Unknown'}</div>
                            <div className="text-muted-foreground truncate">waiting for opponent</div>
                          </div>
                        );
                      }

                      const state = game.status === 'active' ? 'active' : game.status === 'finished' ? 'finished' : 'pending';
                      const isFinished = game.status === 'finished';
                      return (
                        <div
                          key={game.id}
                          ref={setRef}
                          onDoubleClick={() => { if (isFinished) setConfirmGameId(game.id); }}
                          title={isFinished ? 'Double-click to change the winner' : undefined}
                          className={`rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses(state)} ${isFinished ? 'cursor-pointer' : ''}`}
                        >
                          <div className={`truncate ${game.winner === 'team1' ? 'font-semibold' : ''}`}>{t1 ? `${t1.player1} & ${t1.player2}` : 'TBD'}</div>
                          <div className={`truncate ${game.winner === 'team2' ? 'font-semibold' : ''}`}>{t2.player1} & {t2.player2}</div>
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
    </div>
  );
}
