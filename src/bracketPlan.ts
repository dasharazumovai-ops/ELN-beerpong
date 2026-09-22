import type { Game } from './types';

/**
 * Where each round's winners go in the next round.
 *
 * While registration is open the bracket is a plain fixed tree: game 1 meets game 2, game 3
 * meets game 4, and so on, so slot `s` feeds slot floor(s / 2) of the next round.
 *
 * Once registration is closed the number of games in every round is known, computed once from
 * round 1's shape and never revisited. Whenever a round has an odd number of arrivals, one of
 * them has no partner — a bye. Naively always picking the last arrival would let the same team
 * ride a bye after bye after bye (see the "screenshot" bug this fixed): instead, the bye is
 * spliced onto whichever arrival hasn't already had one, preferring the last such arrival and
 * pairing everyone else up in their existing order around it. A team already carrying a bye is
 * routed into a real match instead — against whoever would otherwise have gone alone — so it
 * only ever collects at most one, no matter how the tree is shaped.
 */
export interface BracketPlan {
  /** Slot in `round + 1` that the winner of `slot` in `round` moves into. */
  dest: (round: number, slot: number) => number;
  /** Slots of `round` whose winners move into `slot` of `round + 1`. Only exact once registration is closed. */
  sources: (round: number, slot: number) => number[];
}

const OPEN_PLAN: BracketPlan = {
  dest: (_round, slot) => slot >> 1,
  sources: (_round, slot) => [slot * 2, slot * 2 + 1],
};

export function makePlan(games: Game[], registrationClosed: boolean): BracketPlan {
  if (!registrationClosed) return OPEN_PLAN;

  const roundOne = games.filter(g => g.round === 1).sort((a, b) => a.slot - b.slot);
  if (roundOne.length === 0) return OPEN_PLAN;

  // Simulate the whole tree's shape in one pass, tracking (per round) which arrival lineages
  // have already had a bye. `destPerRound[r - 1][slot]` is where round r's slot lands in r + 1.
  let arrivals = roundOne.map(g => g.isBye || g.team2Id === null);
  const destPerRound: number[][] = [];

  while (arrivals.length > 1) {
    const dest: number[] = new Array(arrivals.length).fill(-1);
    const next: boolean[] = [];

    if (arrivals.length % 2 === 0) {
      for (let i = 0; i < arrivals.length; i += 2) {
        dest[i] = next.length;
        dest[i + 1] = next.length;
        next.push(arrivals[i] || arrivals[i + 1]);
      }
    } else {
      // Odd: exactly one arrival sits out. Give the bye to the last one that hasn't already had
      // one (sliding earlier past anyone who has); if every candidate already has, there's
      // nowhere left to protect, so the very last arrival takes it.
      let byeIndex = arrivals.length - 1;
      while (byeIndex >= 0 && arrivals[byeIndex]) byeIndex--;
      if (byeIndex < 0) byeIndex = arrivals.length - 1;

      const others = arrivals.map((_, i) => i).filter(i => i !== byeIndex);
      for (let k = 0; k < others.length; k += 2) {
        const a = others[k];
        const b = others[k + 1];
        dest[a] = next.length;
        dest[b] = next.length;
        next.push(arrivals[a] || arrivals[b]);
      }
      dest[byeIndex] = next.length;
      next.push(true);
    }

    destPerRound.push(dest);
    arrivals = next;
  }

  const dest = (round: number, slot: number) => destPerRound[round - 1]?.[slot] ?? slot >> 1;
  const sources = (round: number, slot: number) => {
    const table = destPerRound[round - 1];
    if (!table) return [];
    const found: number[] = [];
    table.forEach((d, s) => { if (d === slot) found.push(s); });
    return found;
  };
  return { dest, sources };
}
