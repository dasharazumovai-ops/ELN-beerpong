import { useState, useCallback, useEffect } from 'react';
import type { Tournament, Team, Game, PaymentType } from '../types';
import { generateId, getPaymentAmount } from '../types';

const STORAGE_KEY = 'eln-beerpong-tournament';

function createEmptyTournament(): Tournament {
  const now = new Date();
  return {
    eventName: `Beer Pong - ${now.toLocaleDateString()}`,
    date: now.toISOString().split('T')[0],
    teams: [],
    games: [],
    currentRound: 1,
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

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament>(loadTournament);

  useEffect(() => saveTournament(tournament), [tournament]);

  const addTeam = useCallback((
    player1: string,
    player2: string,
    payment1: PaymentType,
    payment2: PaymentType,
    cashAmount1?: number,
    cashAmount2?: number,
    isRetry: boolean = false
  ) => {
    const team: Team = {
      id: generateId(),
      player1: player1.trim(),
      player2: player2.trim(),
      payment1,
      payment2,
      cashAmount1,
      cashAmount2,
      isFirstGame: !isRetry,
      round: isRetry ? 0 : 1,
      eliminated: false,
      registeredAt: new Date().toISOString(),
    };
    setTournament(prev => ({
      ...prev,
      teams: [...prev.teams, team],
    }));
    return team.id;
  }, []);

  const createGamesForRound = useCallback(() => {
    setTournament(prev => {
      const activeTeams = prev.teams.filter(t => !t.eliminated && t.round === prev.currentRound);
      const shuffled = [...activeTeams].sort(() => Math.random() - 0.5);
      
      const newGames: Game[] = [];
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        const game: Game = {
          id: generateId(),
          round: prev.currentRound,
          tableNumber: prev.nextTableNumber + Math.floor(i / 2),
          team1Id: shuffled[i].id,
          team2Id: shuffled[i + 1].id,
          status: 'pending',
          winner: null,
        };
        newGames.push(game);
      }

      // Handle bye for odd number of teams
      const byeTeam = shuffled.length % 2 === 1 ? shuffled[shuffled.length - 1] : null;
      let updatedTeams = prev.teams;
      if (byeTeam) {
        updatedTeams = prev.teams.map(t =>
          t.id === byeTeam.id ? { ...t, round: t.round + 1 } : t
        );
      }

      return {
        ...prev,
        teams: updatedTeams,
        games: [...prev.games, ...newGames],
        nextTableNumber: prev.nextTableNumber + newGames.length,
      };
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
      if (!game) return prev;

      const winningTeamId = winner === 'team1' ? game.team1Id : game.team2Id;
      const losingTeamId = winner === 'team1' ? game.team2Id : game.team1Id;

      const updatedTeams = prev.teams.map(t => {
        if (t.id === winningTeamId) {
          return { ...t, round: t.round + 1 };
        }
        if (t.id === losingTeamId) {
          return { ...t, eliminated: true };
        }
        return t;
      });

      const updatedGames = prev.games.map(g =>
        g.id === gameId ? { ...g, status: 'finished' as const, winner, finishedAt: new Date().toISOString() } : g
      );

      return {
        ...prev,
        teams: updatedTeams,
        games: updatedGames,
      };
    });
  }, []);

  const advanceRound = useCallback(() => {
    setTournament(prev => {
      const remainingTeams = prev.teams.filter(t => !t.eliminated && t.round > prev.currentRound);
      if (remainingTeams.length <= 1) return prev;
      
      return {
        ...prev,
        currentRound: prev.currentRound + 1,
      };
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
    sum
      + (team.payment1 === 'cash' ? (team.cashAmount1 || 0) : getPaymentAmount(team.payment1))
      + (team.payment2 === 'cash' ? (team.cashAmount2 || 0) : getPaymentAmount(team.payment2)),
    0), [tournament.teams]);

  return {
    tournament,
    addTeam,
    createGamesForRound,
    startGame,
    finishGame,
    advanceRound,
    updateTeam,
    resetTournament,
    exportData,
    importData,
    getTeam,
    getTotalRevenue,
  };
}
