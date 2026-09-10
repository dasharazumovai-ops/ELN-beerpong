import { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTournament } from './hooks/useTournament';
import RegistrationSheet from './components/RegistrationSheet';
import GamesPanel from './components/GamesPanel';
import BracketView from './components/BracketView';
import GameStrip from './components/GameStrip';
import PaymentSummary from './components/PaymentSummary';
import {
  Swords,
  Trophy,
  Euro,
  Download,
  Upload,
  RotateCcw,
  UserPlus,
} from 'lucide-react';

type Tab = 'main' | 'payments' | 'games';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('main');
  const [showRegistration, setShowRegistration] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    tournament,
    addTeam,
    closeRegistration,
    startGame,
    finishGame,
    resetTournament,
    exportData,
    importData,
    getTeam,
    getTotalRevenue,
  } = useTournament();

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'main', label: 'Tournament', icon: <Trophy className="w-5 h-5" /> },
    { id: 'payments', label: 'Payments', icon: <Euro className="w-5 h-5" /> },
    { id: 'games', label: 'Games', icon: <Swords className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header — scrolls with the page, not pinned, to free up space for the bracket */}
      <header className="border-b bg-card">
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
      <main className={`max-w-7xl mx-auto px-4 py-4 ${activeTab === 'main' ? 'pb-28' : ''}`}>
        {activeTab === 'main' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold">Tournament Bracket</h2>
                <p className="text-sm text-muted-foreground">
                  {tournament.teams.length} teams entered{!tournament.registrationClosed ? ' · registration open' : ''}
                </p>
              </div>
              <Button onClick={() => setShowRegistration(true)}>
                <UserPlus className="w-4 h-4 mr-1" />
                Register Team
              </Button>
            </div>

            <BracketView
              games={tournament.games}
              teams={tournament.teams}
              registrationClosed={tournament.registrationClosed}
              getTeam={getTeam}
            />
          </div>
        )}

        {activeTab === 'payments' && (
          <PaymentSummary
            teams={tournament.teams}
            totalRevenue={getTotalRevenue()}
          />
        )}

        {activeTab === 'games' && (
          <GamesPanel
            games={tournament.games}
            onStartGame={startGame}
            onFinishGame={finishGame}
            getTeam={getTeam}
          />
        )}
      </main>

      {activeTab === 'main' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
          <div className="py-2" style={{ paddingLeft: '1.5cm', paddingRight: '1.5cm' }}>
            <GameStrip
              games={tournament.games}
              getTeam={getTeam}
              onStartGame={startGame}
              onFinishGame={finishGame}
            />
          </div>
        </div>
      )}

      <RegistrationSheet
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onAddTeam={addTeam}
        onCloseRegistration={closeRegistration}
        registrationClosed={tournament.registrationClosed}
        teams={tournament.teams}
      />
    </div>
  );
}
