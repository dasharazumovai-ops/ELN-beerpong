import { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTournament } from './hooks/useTournament';
import RegistrationPanel from './components/RegistrationPanel';
import GamesPanel from './components/GamesPanel';
import BracketView from './components/BracketView';
import ProjectorView from './components/ProjectorView';
import PaymentSummary from './components/PaymentSummary';
import {
  Users,
  Swords,
  Trophy,
  Monitor,
  Euro,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';

type Tab = 'register' | 'games' | 'bracket' | 'payments';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('register');
  const [showProjector, setShowProjector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useTournament();

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'register', label: 'Register', icon: <Users className="w-5 h-5" /> },
    { id: 'games', label: 'Games', icon: <Swords className="w-5 h-5" /> },
    { id: 'bracket', label: 'Bracket', icon: <Trophy className="w-5 h-5" /> },
    { id: 'payments', label: 'Payments', icon: <Euro className="w-5 h-5" /> },
  ];

  if (showProjector) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowProjector(false)}
          className="fixed top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur"
        >
          Exit Projector
        </button>
        <ProjectorView
          games={tournament.games}
          getTeam={getTeam}
          currentRound={tournament.currentRound}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">ELN Beer Pong</h1>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {tournament.eventName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProjector(true)}
              >
                <Monitor className="w-4 h-4 mr-1" />
                Projector
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
              >
                <Download className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />
                Load
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importData(file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={resetTournament}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 mt-3 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'register' && (
          <RegistrationPanel
            onAddTeam={addTeam}
            teams={tournament.teams}
          />
        )}

        {activeTab === 'games' && (
          <GamesPanel
            games={tournament.games}
            teams={tournament.teams}
            currentRound={tournament.currentRound}
            onStartGame={startGame}
            onFinishGame={finishGame}
            onCreateGames={createGamesForRound}
            onAdvanceRound={advanceRound}
            getTeam={getTeam}
          />
        )}

        {activeTab === 'bracket' && (
          <BracketView
            games={tournament.games}
            teams={tournament.teams}
            currentRound={tournament.currentRound}
            getTeam={getTeam}
            onUpdateTeam={updateTeam}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentSummary
            teams={tournament.teams}
            totalRevenue={getTotalRevenue()}
          />
        )}
      </main>
    </div>
  );
}
