import { useState, useCallback, useEffect } from 'react';
import type { Tournament, Team, Game, EntryType, PaymentMethod } from '../types';
import { generateId, getPaymentAmount } from '../types';

const STORAGE_KEY = 'eln-beerpong-tournament';

function createEmptyTournament(): Tournament {
  const now = new Date();
  return {
    eventName: `Beer Pong - ${now.toLocaleDateString()}`,
    date: now.toISOString().split('T')[0],
    teams: [],
    games: [],
    registrationClosed: false,
    nextTableNumber: 1,
  };
}

function loadTournament(): Tournament {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : createEmptyTournament();
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
  nextTable: number;
  registrationClosed: boolean;
}

function bumpRound(draft: BracketDraft, teamId: string, round: number) {
  draft.teams = draft.teams.map(t => t.id === teamId ? { ...t, round } : t);
}

/**
 * Pairs teamId with whoever's already waiting alone at `round`, or leaves them as the new
 * one waiting. `feederGameId` is the game (or bye) that just produced teamId — null only for
 * a fresh round-1 registrant — recorded so the bracket view can draw a connector to it.
 */
function arriveAtRound(draft: BracketDraft, round: number, teamId: string, feederGameId: string | null) {
  const waiting = draft.games.find(g => g.round === round && g.status === 'pending' && !g.isBye && g.team2Id === null);
  if (waiting) {
    draft.games = draft.games.map(g => g.id === waiting.id
      ? { ...g, team2Id: teamId, tableNumber: draft.nextTable++, feederGameIds: [g.feederGameIds?.[0] ?? null, feederGameId] }
      : g);
    return;
  }
  const slot = draft.games.filter(g => g.round === round).length;
  draft.games = [...draft.games, {
    id: generateId(), round, slot, tableNumber: null,
    team1Id: teamId, team2Id: null, status: 'pending', winner: null, isBye: false,
    feederGameIds: [feederGameId, null],
  }];
}

/** True once no further arrivals can ever reach `round` — registration is closed and every earlier round has fully finished. */
function isRoundClosed(draft: BracketDraft, round: number): boolean {
  if (round <= 1) return draft.registrationClosed;
  if (!isRoundClosed(draft, round - 1)) return false;
  return draft.games.filter(g => g.round === round - 1).every(g => g.status === 'finished');
}

/**
 * If `round` is closed and still has a lone team waiting for a partner who will never
 * arrive, they get a bye — which may in turn close (and need to settle) the next round.
 */
function trySettleRound(draft: BracketDraft, round: number) {
  const active = draft.teams.filter(t => !t.eliminated);
  if (draft.registrationClosed && active.length <= 1) return; // champion already decided

  if (!isRoundClosed(draft, round)) return;

  const waiting = draft.games.find(g => g.round === round && g.status === 'pending' && !g.isBye && g.team2Id === null);
  if (!waiting || !waiting.team1Id) return;

  const teamId = waiting.team1Id;
  draft.games = draft.games.map(g => g.id === waiting.id
    ? { ...g, status: 'finished' as const, winner: 'team1' as const, isBye: true, finishedAt: new Date().toISOString() }
    : g);
  bumpRound(draft, teamId, round + 1);
  arriveAtRound(draft, round + 1, teamId, waiting.id);
  trySettleRound(draft, round + 1);
}

function findNextGame(draft: BracketDraft, gameId: string): Game | undefined {
  return draft.games.find(g => g.feederGameIds?.includes(gameId));
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
    trySettleRound(draft, game.round + 1);
  }
}

/**
 * Undoes a finished game so its winner can be re-picked: restores the loser, pulls the winner
 * back out of whatever they went on to play (recursing into that game first if it has also
 * finished), and drops the game itself back to 'active'. Only unwinds the winner's own forward
 * path — a bye elsewhere that happened to be triggered by this game closing out its round is
 * not re-examined, since that's a rare edge case not worth the complexity of a full replay.
 */
function revertGame(draft: BracketDraft, gameId: string) {
  const game = draft.games.find(g => g.id === gameId);
  if (!game || game.status !== 'finished' || game.isBye || !game.winner) return;

  const winningTeamId = game.winner === 'team1' ? game.team1Id : game.team2Id;
  const losingTeamId = game.winner === 'team1' ? game.team2Id : game.team1Id;

  const nextGame = findNextGame(draft, gameId);
  if (nextGame) {
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
      // Whichever team remains always goes back into team1 — arriveAtRound only ever looks
      // for a waiting game via team2Id === null, so team1 must be the one that's filled.
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
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams, team], nextTable: prev.nextTableNumber, registrationClosed: prev.registrationClosed };
      arriveAtRound(draft, 1, team.id, null);
      return { ...prev, teams: draft.teams, games: draft.games, nextTableNumber: draft.nextTable };
    });
    return team.id;
  }, []);

  const closeRegistration = useCallback(() => {
    setTournament(prev => {
      if (prev.registrationClosed) return prev;
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], nextTable: prev.nextTableNumber, registrationClosed: true };
      // Registration closing can unblock a lone waiter at ANY round, not just round 1
      // (e.g. every round-1 game already finished while one round-2 winner sat waiting
      // for an opponent who was always going to come from a not-yet-registered team).
      const maxRound = draft.games.length ? Math.max(...draft.games.map(g => g.round)) : 0;
      for (let r = 1; r <= maxRound + 1; r++) trySettleRound(draft, r);
      return { ...prev, registrationClosed: true, games: draft.games, teams: draft.teams, nextTableNumber: draft.nextTable };
    });
  }, []);

  const startGame = useCallback((gameId: string) => {
    setTournament(prev => ({
      ...prev,
      games: prev.games.map(g => g.id === gameId ? { ...g, status: 'active' as const, startedAt: new Date().toISOString() } : g),
    }));
  }, []);

  const finishGame = useCallback((gameId: string, winner: 'team1' | 'team2') => {
    setTournament(prev => {
      const game = prev.games.find(g => g.id === gameId);
      if (!game || game.status === 'finished') return prev;

      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], nextTable: prev.nextTableNumber, registrationClosed: prev.registrationClosed };
      finishGameOnDraft(draft, gameId, winner);
      return { ...prev, games: draft.games, teams: draft.teams, nextTableNumber: draft.nextTable };
    });
  }, []);

  /** Re-picks the winner of an already-finished game — unwinds its effects (and anything the
   * old winner went on to do) and refinishes it with the new winner. */
  const changeWinner = useCallback((gameId: string, winner: 'team1' | 'team2') => {
    setTournament(prev => {
      const game = prev.games.find(g => g.id === gameId);
      if (!game || game.status !== 'finished' || game.isBye || game.winner === winner) return prev;

      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], nextTable: prev.nextTableNumber, registrationClosed: prev.registrationClosed };
      revertGame(draft, gameId);
      finishGameOnDraft(draft, gameId, winner);
      return { ...prev, games: draft.games, teams: draft.teams, nextTableNumber: draft.nextTable };
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
        const data = JSON.parse(e.target?.result as string);
        setTournament(data);
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
    updateTeam,
    resetTournament,
    exportData,
    importData,
    getTeam,
    getTotalRevenue,
  };
}
