import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { Game, Team } from '../types';

interface BracketViewProps {
  teams: Team[];
  games: Game[];
  registrationClosed: boolean;
  getTeam: (id: string | null) => Team | null;
}

interface Connector {
  id: string;
  d: string;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.5;

// A card in round r+1 sits at the vertical midpoint of the two round-r cards that feed it.
// Working that out for a uniform card height shows the gap between cards simply doubles
// every round (BASE_GAP * 2^(round-1)), and each round's first card must start further from
// the top than the last by half the previous round's gap — otherwise connectors have to
// zig-zag to reach a misaligned midpoint, which is what made the arrows hard to follow.
const BASE_GAP = 6;
function roundGapPx(round: number) {
  return BASE_GAP * 2 ** (round - 1);
}
function roundOffsetPx(round: number) {
  return (BASE_GAP / 2) * (2 ** (round - 1) - 1);
}

// Card color follows game state: finished = dark grey, bye = light grey (dashed),
// active = green, ready to play = blue, waiting for a partner = lightest grey (dashed).
// No "vs", no table number — this view is for seeing the shape of the tree, not logistics.
function cardClasses(state: 'finished' | 'active' | 'pending' | 'waiting' | 'bye') {
  switch (state) {
    case 'finished': return 'bg-gray-300 border-gray-400';
    case 'bye': return 'bg-gray-200 border-gray-300 border-dashed';
    case 'active': return 'bg-green-50 border-green-400';
    case 'pending': return 'bg-blue-50 border-blue-300';
    case 'waiting': return 'bg-gray-50 border-gray-300 border-dashed';
  }
}

export default function BracketView({ teams, games, registrationClosed, getTeam }: BracketViewProps) {
  const [zoom, setZoom] = useState(0.7);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scaledRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const lastRound = games.length ? Math.max(...games.map(g => g.round)) : 0;
  const rounds = Array.from({ length: lastRound }, (_, i) => i + 1);
  const activeTeams = teams.filter(t => !t.eliminated);
  const championId = registrationClosed && activeTeams.length === 1 ? activeTeams[0].id : null;

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
    };

    compute();
    const resizeObserver = new ResizeObserver(compute);
    resizeObserver.observe(scaled);
    return () => resizeObserver.disconnect();
  }, [games, zoom]);

  // Trackpad pinch (reported as wheel + ctrlKey) zooms the tree instead of the page.
  // Needs a non-passive native listener since React's onWheel can't preventDefault reliably.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z - e.deltaY * 0.01).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-end gap-1">
        <Button size="icon-sm" variant="outline" onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="icon-sm" variant="outline" onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}>
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
        <div ref={scrollRef} className="border rounded overflow-auto" style={{ height: '64vh' }}>
          <div ref={scaledRef} className="p-2 relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'max-content' }}>
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
                      return (
                        <div key={game.id} ref={setRef} className={`rounded border px-1.5 py-1 text-[11px] leading-tight ${cardClasses(state)}`}>
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
      )}
    </div>
  );
}
