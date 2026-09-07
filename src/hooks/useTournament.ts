import { useState, useCallback, useEffect } from 'react';
import type { Tournament, Team, Game, EntryType, PaymentMethod } from '../types';
import { generateId, getPaymentAmount, slotsInRound } from '../types';

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
}

/**
 * Records that `teamId` has secured (round, slot) and, if that leaves them without a
 * same-round sibling to pair against (an odd slot count), advances them again immediately
 * via a bye — recursing until they land on a slot with an unresolved sibling, or become champion.
 */
function placeAdvancement(draft: BracketDraft, totalTeams: number, round: number, slot: number, teamId: string) {
  draft.teams = draft.teams.map(t => t.id === teamId ? { ...t, round: round + 1 } : t);

  const totalSlots = slotsInRound(totalTeams, round);
  if (totalSlots === 1) return;

  const siblingSlot = slot % 2 === 0 ? slot + 1 : slot - 1;
  const nextRound = round + 1;
  const nextSlot = Math.floor(slot / 2);

  if (siblingSlot >= totalSlots) {
    draft.games = [...draft.games, {
      id: generateId(), round: nextRound, slot: nextSlot, tableNumber: null,
      team1Id: teamId, team2Id: null, status: 'finished', winner: 'team1', isBye: true,
      finishedAt: new Date().toISOString(),
    }];
    placeAdvancement(draft, totalTeams, nextRound, nextSlot, teamId);
    return;
  }

  const sibling = draft.games.find(g => g.round === round && g.slot === siblingSlot && g.status === 'finished');
  if (!sibling) return;
  if (draft.games.some(g => g.round === nextRound && g.slot === nextSlot)) return;

  const siblingWinnerId = sibling.winner === 'team1' ? sibling.team1Id : sibling.team2Id;
  const [team1Id, team2Id] = slot < siblingSlot ? [teamId, siblingWinnerId] : [siblingWinnerId, teamId];

  draft.games = [...draft.games, {
    id: generateId(), round: nextRound, slot: nextSlot, tableNumber: draft.nextTable++,
    team1Id, team2Id, status: 'pending', winner: null, isBye: false,
  }];
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
    setTournament(prev => ({ ...prev, teams: [...prev.teams, team] }));
    return team.id;
  }, []);

  const closeRegistration = useCallback(() => {
    setTournament(prev => {
      if (prev.registrationClosed || prev.teams.length < 2) return prev;

      const ordered = prev.teams;
      const totalSlots = Math.ceil(ordered.length / 2);
      const draft: BracketDraft = { games: [...prev.games], teams: [...prev.teams], nextTable: prev.nextTableNumber };

      for (let slot = 0; slot < totalSlots; slot++) {
        const t1 = ordered[slot * 2];
        const t2 = ordered[slot * 2 + 1];
        if (t1 && t2) {
          draft.games.push({ id: generateId(), round: 1, slot, tableNumber: draft.nextTable++, team1Id: t1.id, team2Id: t2.id, status: 'pending', winner: null, isBye: false });
        } else if (t1) {
          draft.games.push({ id: generateId(), round: 1, slot, tableNumber: null, team1Id: t1.id, team2Id: null, status: 'finished', winner: 'team1', isBye: true, finishedAt: new Date().toISOString() });
          placeAdvancement(draft, ordered.length, 1, slot, t1.id);
        }
      }

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

      const winningTeamId = winner === 'team1' ? game.team1Id : game.team2Id;
      const losingTeamId = winner === 'team1' ? game.team2Id : game.team1Id;
      if (!winningTeamId) return prev;

      const finishedGame: Game = { ...game, status: 'finished', winner, finishedAt: new Date().toISOString() };
      const draft: BracketDraft = {
        games: prev.games.map(g => g.id === gameId ? finishedGame : g),
        teams: prev.teams.map(t => t.id === losingTeamId ? { ...t, eliminated: true } : t),
        nextTable: prev.nextTableNumber,
      };

      placeAdvancement(draft, prev.teams.length, game.round, game.slot, winningTeamId);

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
    updateTeam,
    resetTournament,
    exportData,
    importData,
    getTeam,
    getTotalRevenue,
  };
}
