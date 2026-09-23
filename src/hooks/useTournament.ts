import { useState, useCallback, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, LIVE_TOURNAMENT_DOC } from '../firebase';
import type { Tournament, Team, Game, EntryType, PaymentMethod } from '../types';
import { generateId, getPaymentAmount, firstFreeTable } from '../types';
import { makePlan } from '../bracketPlan';

const STORAGE_KEY = 'eln-beerpong-tournament';

function createEmptyTournament(): Tournament {
  const now = new Date();
  return {
    eventName: `Beer Pong - ${now.toLocaleDateString()}`,
    date: now.toISOString().split('T')[0],
    teams: [],
    games: [],
    registrationClosed: false,
    tableCount: 5,
    nextGameNumber: 1,
  };
}

/**
 * Heals games saved (before a since-fixed bug) with team1Id null and team2Id filled — an
 * invalid shape the rest of the app never produces and can't pair a new opponent into. Also
 * catches an active/finished game left with a missing team, which can only mean it was
 * interrupted mid-way through a winner change. Runs on every load so old corrupted saves
 * self-repair without the user having to do anything.
 */
function repairGames(games: Game[]): Game[] {
  return games.map(g => {
    if (g.isBye) return g;
    if (!g.team1Id && g.team2Id) {
      return {
        ...g,
        team1Id: g.team2Id,
        team2Id: null,
        tableNumber: null,
        status: 'pending' as const,
        winner: null,
        startedAt: undefined,
        finishedAt: undefined,
        feederGameIds: [g.feederGameIds?.[1] ?? null, null],
      };
    }
    if (!g.team2Id && g.status !== 'pending') {
      return { ...g, status: 'pending' as const, winner: null, startedAt: undefined, finishedAt: undefined };
    }
    return g;
  });
}

/**
 * Saves from before game numbers existed have no `gameNumber` on any game. Assigns 1, 2, 3...
 * in (round, slot) order — the closest thing to "the order these were actually played" that old
 * data still records — and reports the next number to hand out from then on. A no-op (returns
 * the games untouched, with `nextGameNumber` past whatever's already there) once every game
 * already has one, so this is always safe to run on load.
 */
function backfillGameNumbers(games: Game[]): { games: Game[]; nextGameNumber: number } {
  if (games.every(g => typeof g.gameNumber === 'number')) {
    return { games, nextGameNumber: Math.max(0, ...games.map(g => g.gameNumber)) + 1 };
  }
  const ordered = [...games].sort((a, b) => a.round - b.round || a.slot - b.slot);
  const numbered = new Map(ordered.map((g, i) => [g.id, i + 1]));
  return {
    games: games.map(g => ({ ...g, gameNumber: numbered.get(g.id)! })),
    nextGameNumber: games.length + 1,
  };
}

function loadTournament(): Tournament {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createEmptyTournament();
    const parsed = JSON.parse(saved) as Tournament;
    // Saves from before tables were tracked have no tableCount (and any tableNumber on their
    // games was just an ever-incrementing counter, never a real 1..N table) — treat both as
    // untouched: default the count and let every game start out with no table assigned.
    const { games, nextGameNumber } = backfillGameNumbers(repairGames(parsed.games).map(g =>
      parsed.tableCount === undefined ? { ...g, tableNumber: null } : g));
    return { ...parsed, tableCount: parsed.tableCount ?? 5, nextGameNumber: parsed.nextGameNumber ?? nextGameNumber, games };
  } catch {
    return createEmptyTournament();
  }
}

function saveTournament(t: Tournament) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

interface BracketDraft {
  games: Game[];
  teams: Team[];
  registrationClosed: boolean;
  nextGameNum: number;
}

function bumpRound(draft: BracketDraft, teamId: string, round: number) {
  draft.teams = draft.teams.map(t => t.id === teamId ? { ...t, round } : t);
}

/**
 * Seats teamId in `round`. `feederGameId` is the game (or bye) that just produced them — null
 * only for a fresh round-1 registrant — recorded so the bracket view can draw a connector to it.
 *
 * The bracket is a fixed tree: game N of a round only ever meets game N+1 (1&2, 3&4, ...) in the
 * next, whichever finishes first. So a winner from slot `s` always lands in the slot the bracket
 * plan assigns it (floor(s / 2), except after registration closes, where the plan moves the
 * odd-one-out bye off any path that already had one — see bracketPlan.ts), creating that game if
 * they're the first to arrive and filling it if their partner already has. Round-1 registrants
 * have no feeder and simply pair off in arrival order. The one place this can't apply is a game
 * whose planned slot is unavailable (data saved before this rule existed), which falls back to
 * pairing with whoever is waiting.
 */
function arriveAtRound(draft: BracketDraft, round: number, teamId: string, feederGameId: string | null) {
  const feeder = feederGameId ? draft.games.find(g => g.id === feederGameId) : undefined;
  if (feeder) {
    const targetSlot = makePlan(draft.games, draft.registrationClosed).dest(feeder.round, feeder.slot);
    const target = draft.games.find(g => g.round === round && g.slot === targetSlot);
    if (!target) {
      draft.games = [...draft.games, {
        id: generateId(), round, slot: targetSlot, gameNumber: draft.nextGameNum++, tableNumber: null,
        team1Id: teamId, team2Id: null, status: 'pending', winner: null, isBye: false,
        feederGameIds: [feederGameId, null],
      }];
      return;
    }
    if (!target.isBye && target.status === 'pending' && target.team2Id === null && target.team1Id !== teamId) {
      draft.games = draft.games.map(g => g.id === target.id
        ? { ...g, team2Id: teamId, feederGameIds: [g.feederGameIds?.[0] ?? null, feederGameId] }
        : g);
      return;
    }
    // The planned slot is already spoken for by an unrelated game — only possible after a
    // pre-close/post-close mismatch (bracketPlan.ts): a real match already decided that slot
    // under a different scheme before the final shape of the bracket was known. There's no
    // legitimate partner left for this arrival, so — exactly like settleLoneGames — it advances
    // immediately as a bye, rather than being parked in a "waiting" game. Parking it risks it
    // sitting there forever unrecognized: the checks that spot a genuine lone waiter assume the
    // plan and reality agree, which is exactly what just failed.
    const slot = nextFreeSlot(draft, round);
    const byeId = generateId();
    draft.games = [...draft.games, {
      id: byeId, round, slot, gameNumber: draft.nextGameNum++, tableNumber: null,
      team1Id: teamId, team2Id: null, status: 'finished', winner: 'team1', isBye: true,
      feederGameIds: [feederGameId, null], finishedAt: new Date().toISOString(),
    }];
    bumpRound(draft, teamId, round + 1);
    arriveAtRound(draft, round + 1, teamId, byeId);
    return;
  }

  // Round-1 registration (no feeder): pair off in arrival order.
  const waiting = draft.games.find(g => g.round === round && g.status === 'pending' && !g.isBye && g.team2Id === null);
  if (waiting) {
    draft.games = draft.games.map(g => g.id === waiting.id
      ? { ...g, team2Id: teamId, feederGameIds: [g.feederGameIds?.[0] ?? null, feederGameId] }
      : g);
    return;
  }
  draft.games = [...draft.games, {
    id: generateId(), round, slot: nextFreeSlot(draft, round), gameNumber: draft.nextGameNum++, tableNumber: null,
    team1Id: teamId, team2Id: null, status: 'pending', winner: null, isBye: false,
    feederGameIds: [feederGameId, null],
  }];
}

/** A slot number guaranteed not to collide with anything already in `round` — `.length` isn't
 * safe here, since a round can already have gaps or an out-of-range slot from an earlier
 * plan/reality mismatch, but one past the highest slot actually present never collides. */
function nextFreeSlot(draft: BracketDraft, round: number): number {
  const existingSlots = draft.games.filter(g => g.round === round).map(g => g.slot);
  return existingSlots.length ? Math.max(...existingSlots) + 1 : 0;
}

/** True once no further arrivals can ever reach `round` — registration is closed and every earlier round has fully finished. */
function isRoundClosed(draft: BracketDraft, round: number): boolean {
  if (round <= 1) return draft.registrationClosed;
  if (!isRoundClosed(draft, round - 1)) return false;
  return draft.games.filter(g => g.round === round - 1).every(g => g.status === 'finished');
}

/** How many games each round will end up with once registration is closed: round 1 is whatever
 * exists, and each later round has half as many, rounded up (an odd one out sits alone). Used
 * only as a depth cap for isLoneWaiter's recursion guard below — NOT trusted as an exact round
 * count, since a game finished while registration was still open can push the real bracket a
 * round or two past what round 1's size alone would predict. */
function finalRoundCounts(draft: BracketDraft): number[] {
  const counts = [draft.games.filter(g => g.round === 1).length];
  while (counts[counts.length - 1] > 1) counts.push(Math.ceil(counts[counts.length - 1] / 2));
  return counts;
}

/** A team sitting alone in a game whose opponent can never arrive: registration is closed and
 * nothing else in the bracket plan feeds the game it's waiting in. */
function isLoneWaiter(draft: BracketDraft, game: Game, counts: number[]): boolean {
  if (!draft.registrationClosed) return false;
  if (game.isBye || game.status !== 'pending' || game.team2Id !== null || !game.team1Id) return false;
  // Generous padding past the naive round count (rather than counts.length itself): a
  // pre-close/post-close mismatch can genuinely push the real final a round or two later than
  // round 1's size alone predicts, and refusing to resolve a real lone waiter there is what
  // caused actual stalls. But SOME cap is required — without one, a mismatch can otherwise
  // recurse without end (a real crash, confirmed while testing this), which is worse than
  // either a stall or an extra bye. active.length<=1 (checked by the caller) is what actually
  // recognizes the true champion; this is purely a backstop against runaway recursion.
  if (game.round >= counts.length + 4) return false;
  if (game.round === 1) return true;
  if (isRoundClosed(draft, game.round)) return true;
  const feeder = draft.games.find(g => g.id === game.feederGameIds?.[0]);
  if (!feeder) return false;
  const feeding = makePlan(draft.games, true).sources(feeder.round, game.slot);
  return feeding.length <= 1;
}

/**
 * Registration closing leaves at most one game per round with no partner. That team gets a bye
 * and moves straight up to the next round, where the bracket plan has already made sure it won't
 * be alone again. Runs until nothing is left waiting on someone who will never arrive.
 */
function settleLoneGames(draft: BracketDraft) {
  for (;;) {
    const active = draft.teams.filter(t => !t.eliminated);
    if (draft.registrationClosed && active.length <= 1) return; // champion already decided

    const lone = draft.games.find(g => isLoneWaiter(draft, g, finalRoundCounts(draft)));
    if (!lone || !lone.team1Id) return;

    draft.games = draft.games.map(g => g.id === lone.id
      ? { ...g, status: 'finished' as const, winner: 'team1' as const, isBye: true, finishedAt: new Date().toISOString() }
      : g);
    bumpRound(draft, lone.team1Id, lone.round + 1);
    arriveAtRound(draft, lone.round + 1, lone.team1Id, lone.id);
  }
}

/**
 * Games made while registration was open were placed by the plain fixed pairing. Once it closes,
 * any that haven't started yet (waiting for a partner, or ready but not begun) are picked up and
 * seated again where the closed-registration plan puts them, so the one-bye rule also covers
 * rounds that were already under way. Started or finished games stay exactly where they are.
 */
function reseatPendingGames(draft: BracketDraft) {
  const maxRound = draft.games.length ? Math.max(...draft.games.map(g => g.round)) : 0;
  for (let round = 2; round <= maxRound; round++) {
    const plan = makePlan(draft.games, draft.registrationClosed);
    const misplaced = draft.games.filter(game => {
      if (game.round !== round || game.isBye || game.status !== 'pending' || !game.team1Id) return false;
      const seated = [game.team1Id, game.team2Id].map((teamId, i) => teamId ? game.feederGameIds?.[i] ?? null : undefined);
      if (seated.some(feederId => feederId === null)) return false; // no feeder recorded (old data): leave it be
      return seated.some(feederId => {
        const feeder = feederId ? draft.games.find(g => g.id === feederId) : undefined;
        return feeder !== undefined && plan.dest(feeder.round, feeder.slot) !== game.slot;
      });
    });
    if (misplaced.length === 0) continue;

    const arrivals = misplaced.flatMap(game =>
      [[game.team1Id, game.feederGameIds?.[0]], [game.team2Id, game.feederGameIds?.[1]]] as const,
    ).filter((arrival): arrival is readonly [string, string] => !!arrival[0] && !!arrival[1]);
    const misplacedIds = new Set(misplaced.map(g => g.id));
    draft.games = draft.games.filter(g => !misplacedIds.has(g.id));
    for (const [teamId, feederId] of arrivals) arriveAtRound(draft, round, teamId, feederId);
  }
}

function findNextGame(draft: BracketDraft, gameId: string): Game | undefined {
  return draft.games.find(g => g.feederGameIds?.includes(gameId));
}

/** Follows a chain of byes back to the real game whose winner they carried upward — the game
 * that can actually be replayed. Null if the chain starts at a round-1 bye (a lone registrant),
 * which has no game behind it. */
function resolveRealFeeder(draft: BracketDraft, gameId: string): Game | null {
  let game = draft.games.find(g => g.id === gameId) ?? null;
  while (game?.isBye) {
    const upstreamId: string | null = game.feederGameIds?.[0] ?? null;
    game = upstreamId ? draft.games.find(g => g.id === upstreamId) ?? null : null;
  }
  return game;
}

/** Mutates `draft` to finish `gameId` with `winner` — the shared core of finishing a game for
 * the first time and re-finishing one after `revertGame` has undone it. */
function finishGameOnDraft(draft: BracketDraft, gameId: string, winner: 'team1' | 'team2') {
  const game = draft.games.find(g => g.id === gameId);
  if (!game || game.status === 'finished') return;

  const winningTeamId = winner === 'team1' ? game.team1Id : game.team2Id;
  const losingTeamId = winner === 'team1' ? game.team2Id : game.team1Id;
  if (!winningTeamId) return;

  const finishedGame: Game = { ...game, status: 'finished', winner, finishedAt: new Date().toISOString() };
  draft.games = draft.games.map(g => g.id === gameId ? finishedGame : g);
  draft.teams = draft.teams.map(t => t.id === losingTeamId ? { ...t, eliminated: true } : t);

  bumpRound(draft, winningTeamId, game.round + 1);

  const stillActive = draft.teams.filter(t => !t.eliminated);
  const isChampion = draft.registrationClosed && stillActive.length <= 1;
  if (!isChampion) {
    arriveAtRound(draft, game.round + 1, winningTeamId, game.id);
    settleLoneGames(draft);
  }
}

/**
 * Takes the winner of `gameId` back out of the game they advanced into. If they've already
 * played and finished that game, it's unwound first; if it's merely a bye that was carrying them
 * upward, whatever it triggered further along is unwound and the bye itself is dropped.
 */
function pullWinnerOut(draft: BracketDraft, gameId: string, winningTeamId: string | null) {
  const nextGame = findNextGame(draft, gameId);
  if (!nextGame) return;

  if (nextGame.isBye) {
    pullWinnerOut(draft, nextGame.id, winningTeamId);
    draft.games = draft.games.filter(g => g.id !== nextGame.id);
    return;
  }

  // If the winner had already gone on to finish that next game too, unwind it first. If it's
  // merely active (started but not finished), pulling a team out of it invalidates it — it
  // can no longer be in progress, so it drops back to a single-team "waiting" game below.
  if (nextGame.status === 'finished') revertGame(draft, nextGame.id);
  const slotIsTeam1 = nextGame.team1Id === winningTeamId && nextGame.feederGameIds?.[0] === gameId;
  const remainingTeamId = slotIsTeam1 ? nextGame.team2Id : nextGame.team1Id;
  const remainingFeederId = slotIsTeam1 ? (nextGame.feederGameIds?.[1] ?? null) : (nextGame.feederGameIds?.[0] ?? null);
  if (!remainingTeamId) {
    // This game only existed to host the winner's arrival — their opponent never showed.
    draft.games = draft.games.filter(g => g.id !== nextGame.id);
  } else {
    // Whichever team remains always goes back into team1 — the next arrival fills team2, so
    // team1 must be the one that's filled.
    draft.games = draft.games.map(g => g.id === nextGame.id ? {
      ...g,
      team1Id: remainingTeamId,
      team2Id: null,
      tableNumber: null,
      status: 'pending' as const,
      startedAt: undefined,
      feederGameIds: [remainingFeederId, null],
    } : g);
  }
}

/**
 * Undoes a finished game so its winner can be re-picked: restores the loser, pulls the winner
 * back out of whatever they went on to play (recursing into that game first if it has also
 * finished), and drops the game itself back to 'active'. Because pairings are a fixed tree,
 * nothing outside the winner's own path ever depends on this game, so there's nothing else to
 * re-examine.
 */
function revertGame(draft: BracketDraft, gameId: string) {
  const game = draft.games.find(g => g.id === gameId);
  if (!game || game.status !== 'finished' || game.isBye || !game.winner) return;

  const winningTeamId = game.winner === 'team1' ? game.team1Id : game.team2Id;
  const losingTeamId = game.winner === 'team1' ? game.team2Id : game.team1Id;

  pullWinnerOut(draft, gameId, winningTeamId);

  if (losingTeamId) {
    draft.teams = draft.teams.map(t => t.id === losingTeamId ? { ...t, eliminated: false } : t);
  }
  if (winningTeamId) {
    bumpRound(draft, winningTeamId, game.round);
  }
  draft.games = draft.games.map(g => g.id === gameId ? { ...g, status: 'active' as const, winner: null, finishedAt: undefined } : g);
}

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament>(loadTournament);

  useEffect(() => saveTournament(tournament), [tournament]);

  // Broadcast every change to Firestore for the read-only live view (?live=1) to pick up in
  // real time. This device stays the source of truth (localStorage above); Firestore is a
  // one-way outbound mirror, so a flaky connection here can never corrupt or block local use.
  // JSON round-tripping strips the odd `undefined` field (e.g. a cleared startedAt), which
  // Firestore's SDK otherwise rejects outright.
  //
  // The live view must always reflect this device, so a push is never given up on: failures
  // retry with backoff, coming back online re-pushes immediately, and a heartbeat re-pushes the
  // current state every 30s — which both heals the doc if anything else overwrote it and gives
  // spectators an `updatedAt` proving the organizer is still connected.
  useEffect(() => {
    const ref = doc(db, LIVE_TOURNAMENT_DOC.collection, LIVE_TOURNAMENT_DOC.id);
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const push = () => {
      clearTimeout(retryTimer);
      setDoc(ref, { ...JSON.parse(JSON.stringify(tournament)), updatedAt: new Date().toISOString() })
        .then(() => { failures = 0; })
        .catch(err => {
          console.warn('Live view sync failed (offline, or Firestore rules/config):', err);
          if (cancelled) return;
          retryTimer = setTimeout(push, Math.min(30_000, 2_000 * 2 ** failures++));
        });
    };

    push();
    const heartbeat = setInterval(push, 30_000);
    window.addEventListener('online', push);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      window.removeEventListener('online', push);
    };
  }, [tournament]);

  const addTeam = useCallback((
    player1: string,
    player2: string,
    entry1: EntryType,
    method1: PaymentMethod,
    entry2: EntryType,
    method2: PaymentMethod,
  ) => {
    const team: Team = {
      id: generateId(),
      player1: player1.trim(),
      player2: player2.trim(),
      entry1,
      method1,
      entry2,
      method2,
      round: 1,
      eliminated: false,
      registeredAt: new Date().toISOString(),
    };
    setTournament(prev => {
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams, team], registrationClosed: prev.registrationClosed, nextGameNum: prev.nextGameNumber };
      arriveAtRound(draft, 1, team.id, null);
      return { ...prev, teams: draft.teams, games: draft.games, nextGameNumber: draft.nextGameNum };
    });
    return team.id;
  }, []);

  const closeRegistration = useCallback(() => {
    setTournament(prev => {
      if (prev.registrationClosed) return prev;
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], registrationClosed: true, nextGameNum: prev.nextGameNumber };
      // Closing registration can leave the last game at any round without a partner ever
      // arriving (e.g. the odd one out in round 1, or a round-2 winner whose partner game
      // doesn't exist), so every round is checked, not just round 1.
      reseatPendingGames(draft);
      settleLoneGames(draft);
      return { ...prev, registrationClosed: true, games: draft.games, teams: draft.teams, nextGameNumber: draft.nextGameNum };
    });
  }, []);

  /** Claims a free table for the game and starts it. Refuses if every table already holds an
   * active game — the UI is expected to disable Start in that case, but this is the actual
   * guard against ever double-booking a table (see firstFreeTable in types.ts). */
  const startGame = useCallback((gameId: string) => {
    setTournament(prev => {
      const table = firstFreeTable(prev.games, prev.tableCount);
      if (table === null) return prev;
      return {
        ...prev,
        games: prev.games.map(g => g.id === gameId
          ? { ...g, status: 'active' as const, startedAt: new Date().toISOString(), tableNumber: table }
          : g),
      };
    });
  }, []);

  /** How many tables are set up tonight — usually 5, sometimes fewer, and fewer still matter as
   * the field narrows near the final rounds. Never below 1. */
  const setTableCount = useCallback((count: number) => {
    setTournament(prev => ({ ...prev, tableCount: Math.max(1, Math.round(count)) }));
  }, []);

  const finishGame = useCallback((gameId: string, winner: 'team1' | 'team2') => {
    setTournament(prev => {
      const game = prev.games.find(g => g.id === gameId);
      if (!game || game.status === 'finished') return prev;

      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], registrationClosed: prev.registrationClosed, nextGameNum: prev.nextGameNumber };
      finishGameOnDraft(draft, gameId, winner);
      return { ...prev, games: draft.games, teams: draft.teams, nextGameNumber: draft.nextGameNum };
    });
  }, []);

  /** Re-picks the winner of an already-finished game — unwinds its effects (and anything the
   * old winner went on to do) and refinishes it with the new winner. */
  const changeWinner = useCallback((gameId: string, winner: 'team1' | 'team2') => {
    setTournament(prev => {
      const game = prev.games.find(g => g.id === gameId);
      if (!game || game.status !== 'finished' || game.isBye || game.winner === winner) return prev;

      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], registrationClosed: prev.registrationClosed, nextGameNum: prev.nextGameNumber };
      revertGame(draft, gameId);
      finishGameOnDraft(draft, gameId, winner);
      return { ...prev, games: draft.games, teams: draft.teams, nextGameNumber: draft.nextGameNum };
    });
  }, []);

  /**
   * Deletes a not-yet-decided game (waiting, pending, or active) — e.g. a stray duplicate
   * pairing — and sends whichever earlier match(es) fed into it back to 'active' so they can
   * be replayed and produce a correct arrival. Reuses revertGame for each feeder, which
   * already knows how to clean up (and, once every feeder is gone, delete) the game they fed
   * into as a side effect — refused if the game has no feeder to fall back to (a round-1 entry).
   */
  const deleteGame = useCallback((gameId: string) => {
    setTournament(prev => {
      const game = prev.games.find(g => g.id === gameId);
      if (!game || game.status === 'finished' || game.isBye) return prev;
      const feederIds = (game.feederGameIds ?? []).filter((id): id is string => id !== null);
      if (feederIds.length === 0) return prev;

      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], registrationClosed: prev.registrationClosed, nextGameNum: prev.nextGameNumber };
      // A feeder can be a bye standing in for a real game further back; that's the one to replay.
      const realFeeders = feederIds.map(id => resolveRealFeeder(draft, id));
      if (realFeeders.some(f => !f)) return prev;
      for (const feeder of realFeeders) revertGame(draft, feeder!.id);
      draft.games = draft.games.filter(g => g.id !== gameId);
      return { ...prev, games: draft.games, teams: draft.teams, nextGameNumber: draft.nextGameNum };
    });
  }, []);

  const updateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    setTournament(prev => ({ ...prev, teams: prev.teams.map(t => t.id === teamId ? { ...t, ...updates } : t) }));
  }, []);

  const resetTournament = useCallback(() => {
    if (!confirm('Are you sure you want to reset everything? This cannot be undone.')) return;
    const empty = createEmptyTournament();
    setTournament(empty);
    saveTournament(empty);
  }, []);

  const exportData = useCallback(() => {
    const active = tournament.teams.filter(t => !t.eliminated);
    const champion = tournament.registrationClosed && active.length === 1 ? active[0] : null;

    const teamsWithTotals = tournament.teams.map(team => ({
      ...team,
      totalPaid: getPaymentAmount(team.entry1, team.method1) + getPaymentAmount(team.entry2, team.method2),
    }));
    const totalRevenue = teamsWithTotals.reduce((sum, t) => sum + t.totalPaid, 0);

    const payload = {
      ...tournament,
      teams: teamsWithTotals,
      summary: {
        exportedAt: new Date().toISOString(),
        teamCount: tournament.teams.length,
        totalRevenue,
        champion: champion ? `${champion.player1} & ${champion.player2}` : null,
      },
    };

    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beerpong-${tournament.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tournament]);

  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as Tournament;
        const { games, nextGameNumber } = backfillGameNumbers(repairGames(data.games).map(g =>
          data.tableCount === undefined ? { ...g, tableNumber: null } : g));
        setTournament({ ...data, tableCount: data.tableCount ?? 5, nextGameNumber: data.nextGameNumber ?? nextGameNumber, games });
      } catch {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  }, []);

  const getTeam = useCallback((teamId: string | null) => tournament.teams.find(t => t.id === teamId) || null, [tournament.teams]);

  const getTotalRevenue = useCallback(() => tournament.teams.reduce((sum, team) =>
    sum + getPaymentAmount(team.entry1, team.method1) + getPaymentAmount(team.entry2, team.method2),
    0), [tournament.teams]);

  return {
    tournament,
    addTeam,
    closeRegistration,
    startGame,
    finishGame,
    changeWinner,
    deleteGame,
    updateTeam,
    setTableCount,
    resetTournament,
    exportData,
    importData,
    getTeam,
    getTotalRevenue,
  };
}
