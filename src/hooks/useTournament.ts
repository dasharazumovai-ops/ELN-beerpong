import { useState, useCallback, useEffect } from 'react';
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Tournament, Team, Game, EntryType, PaymentMethod } from '../types';
import { generateId, getPaymentAmount } from '../types';

const tournamentRef = doc(db, 'tournaments', 'current');

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

interface BracketDraft {
  games: Game[];
  teams: Team[];
  nextTable: number;
  registrationClosed: boolean;
}

function bumpRound(draft: BracketDraft, teamId: string, round: number) {
  draft.teams = draft.teams.map(t => t.id === teamId ? { ...t, round } : t);
}

/** Pairs teamId with whoever's already waiting alone at `round`, or leaves them as the new one waiting. */
function arriveAtRound(draft: BracketDraft, round: number, teamId: string) {
  const waiting = draft.games.find(g => g.round === round && g.status === 'pending' && !g.isBye && g.team2Id === null);
  if (waiting) {
    draft.games = draft.games.map(g => g.id === waiting.id ? { ...g, team2Id: teamId, tableNumber: draft.nextTable++ } : g);
    return;
  }
  const slot = draft.games.filter(g => g.round === round).length;
  draft.games = [...draft.games, {
    id: generateId(), round, slot, tableNumber: null,
    team1Id: teamId, team2Id: null, status: 'pending', winner: null, isBye: false,
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
  arriveAtRound(draft, round + 1, teamId);
  trySettleRound(draft, round + 1);
}

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament>(createEmptyTournament);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(tournamentRef, (snap) => {
      if (snap.exists()) {
        setTournament(snap.data() as Tournament);
      } else {
        const empty = createEmptyTournament();
        setDoc(tournamentRef, empty).catch(() => { /* another client may have created it first */ });
        setTournament(empty);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, []);

  const mutate = useCallback((updater: (prev: Tournament) => Tournament) => {
    runTransaction(db, async (tx) => {
      const snap = await tx.get(tournamentRef);
      const prev = snap.exists() ? (snap.data() as Tournament) : createEmptyTournament();
      tx.set(tournamentRef, updater(prev));
    }).catch(() => { /* offline or blocked write — local view will resync once connectivity returns */ });
  }, []);

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
    mutate(prev => {
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams, team], nextTable: prev.nextTableNumber, registrationClosed: prev.registrationClosed };
      arriveAtRound(draft, 1, team.id);
      return { ...prev, teams: draft.teams, games: draft.games, nextTableNumber: draft.nextTable };
    });
    return team.id;
  }, [mutate]);

  const closeRegistration = useCallback(() => {
    mutate(prev => {
      if (prev.registrationClosed) return prev;
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], nextTable: prev.nextTableNumber, registrationClosed: true };
      // Registration closing can unblock a lone waiter at ANY round, not just round 1
      // (e.g. every round-1 game already finished while one round-2 winner sat waiting
      // for an opponent who was always going to come from a not-yet-registered team).
      const maxRound = draft.games.length ? Math.max(...draft.games.map(g => g.round)) : 0;
      for (let r = 1; r <= maxRound + 1; r++) trySettleRound(draft, r);
      return { ...prev, registrationClosed: true, games: draft.games, teams: draft.teams, nextTableNumber: draft.nextTable };
    });
  }, [mutate]);

  const startGame = useCallback((gameId: string) => {
    mutate(prev => ({
      ...prev,
      games: prev.games.map(g => g.id === gameId ? { ...g, status: 'active' as const, startedAt: new Date().toISOString() } : g),
    }));
  }, [mutate]);

  const finishGame = useCallback((gameId: string, winner: 'team1' | 'team2') => {
    mutate(prev => {
      const game = prev.games.find(g => g.id === gameId);
      if (!game || game.status === 'finished') return prev;

      const winningTeamId = winner === 'team1' ? game.team1Id : game.team2Id;
      const losingTeamId = winner === 'team1' ? game.team2Id : game.team1Id;
      if (!winningTeamId) return prev;

      const finishedGame: Game = { ...game, status: 'finished', winner, finishedAt: new Date().toISOString() };
      const draft: BracketDraft = {
        games: prev.games.map(g => g.id === gameId ? finishedGame : g),
        teams: prev.teams.map(t => t.id === losingTeamId ? { ...t, eliminated: true } : t),
        nextTable: prev.nextTableNumber,
        registrationClosed: prev.registrationClosed,
      };

      bumpRound(draft, winningTeamId, game.round + 1);

      const stillActive = draft.teams.filter(t => !t.eliminated);
      const isChampion = draft.registrationClosed && stillActive.length <= 1;
      if (!isChampion) {
        arriveAtRound(draft, game.round + 1, winningTeamId);
        trySettleRound(draft, game.round + 1);
      }

      return { ...prev, games: draft.games, teams: draft.teams, nextTableNumber: draft.nextTable };
    });
  }, [mutate]);

  const updateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    mutate(prev => ({ ...prev, teams: prev.teams.map(t => t.id === teamId ? { ...t, ...updates } : t) }));
  }, [mutate]);

  const resetTournament = useCallback(async () => {
    if (!confirm('Are you sure you want to reset everything? This cannot be undone.')) return;
    if (tournament.teams.length > 0) {
      const archiveId = `${tournament.date}-${generateId()}`;
      try {
        await setDoc(doc(db, 'archive', archiveId), { ...tournament, archivedAt: new Date().toISOString() });
      } catch { /* archiving is best-effort — don't block the reset on it */ }
    }
    mutate(() => createEmptyTournament());
  }, [tournament, mutate]);

  const exportData = useCallback(() => {
    const dataStr = JSON.stringify(tournament, null, 2);
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
        mutate(() => data);
      } catch {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  }, [mutate]);

  const getTeam = useCallback((teamId: string | null) => tournament.teams.find(t => t.id === teamId) || null, [tournament.teams]);

  const getTotalRevenue = useCallback(() => tournament.teams.reduce((sum, team) =>
    sum + getPaymentAmount(team.entry1, team.method1) + getPaymentAmount(team.entry2, team.method2),
    0), [tournament.teams]);

  return {
    tournament,
    loading,
    addTeam,
    closeRegistration,
    startGame,
    finishGame,
    updateTeam,
    resetTournament,
    exportData,
    importData,
    getTeam,
    getTotalRevenue,
  };
}
