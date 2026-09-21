import { useEffect, useRef, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, LIVE_TOURNAMENT_DOC } from './firebase';
import BracketView from './components/BracketView';
import GameStrip from './components/GameStrip';
import GamesPanel from './components/GamesPanel';
import PaymentSummary from './components/PaymentSummary';
import type { Tournament } from './types';
import { getPaymentAmount } from './types';
import { Euro, Radio, Swords, Trophy, WifiOff } from 'lucide-react';

type LiveTab = 'main' | 'payments' | 'games';

export default function LiveView() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  // False while the snapshot listener is erroring or only serving cached data (offline).
  const [connected, setConnected] = useState(true);
  const [failedBeforeData, setFailedBeforeData] = useState(false);
  const [activeTab, setActiveTab] = useState<LiveTab>('main');
  const footerRef = useRef<HTMLDivElement>(null);
  // See App.tsx's identical measurement — a hardcoded padding-bottom estimate can fall short
  // of the strip's real (content-dependent) height and let it cover the bracket's last row.
  const [footerClearance, setFooterClearance] = useState(112);

  useEffect(() => {
    const ref = doc(db, LIVE_TOURNAMENT_DOC.collection, LIVE_TOURNAMENT_DOC.id);
    let unsubscribe = () => {};
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // A listener that errors is dead for good, so resubscribe after a pause rather than leaving
    // spectators on a frozen page. Last-known data stays on screen in the meantime.
    const subscribe = () => {
      unsubscribe = onSnapshot(
        ref,
        { includeMetadataChanges: true },
        snap => {
          setConnected(!snap.metadata.fromCache);
          setFailedBeforeData(false);
          if (snap.exists()) setTournament(snap.data() as Tournament);
          else if (!snap.metadata.fromCache) setTournament(null);
        },
        () => {
          setConnected(false);
          setFailedBeforeData(true);
          if (!cancelled) retryTimer = setTimeout(subscribe, 5000);
        },
      );
    };

    subscribe();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const update = () => setFooterClearance(el.offsetHeight + 48);
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [tournament]);

  if (!tournament && failedBeforeData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <p className="text-xl font-semibold">Can't reach the live tournament</p>
          <p className="text-muted-foreground">Retrying automatically...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Waiting for the tournament to start...
      </div>
    );
  }

  const getTeam = (id: string | null) => (id ? tournament.teams.find(t => t.id === id) ?? null : null);
  const totalRevenue = tournament.teams.reduce(
    (sum, t) => sum + getPaymentAmount(t.entry1, t.method1) + getPaymentAmount(t.entry2, t.method2),
    0,
  );
  // Stamped by the organizer's device on every push (and a 30s heartbeat), so this shows how
  // fresh the data is rather than when this page happened to receive it.
  const updatedAt = (tournament as Tournament & { updatedAt?: string }).updatedAt;
  const syncedAt = updatedAt ? new Date(updatedAt).toLocaleTimeString() : null;
  const tabs: { id: LiveTab; label: string; icon: ReactNode }[] = [
    { id: 'main', label: 'Tournament', icon: <Trophy className="w-5 h-5" /> },
    { id: 'payments', label: 'Payments', icon: <Euro className="w-5 h-5" /> },
    { id: 'games', label: 'Games', icon: <Swords className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">ELN Beer Pong</h1>
          <span className="text-sm text-muted-foreground">{tournament.eventName}</span>
          <span className="ml-auto flex items-center gap-3">
            {syncedAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">Organizer synced {syncedAt}</span>
            )}
            {connected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                <WifiOff className="w-3.5 h-3.5" />
                RECONNECTING...
              </span>
            )}
          </span>
        </div>
        <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
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
      </header>

      <main
        className="py-4"
        style={{ paddingLeft: '2.5cm', paddingRight: '2.5cm', paddingBottom: footerClearance }}
      >
        {activeTab === 'payments' && <PaymentSummary teams={tournament.teams} totalRevenue={totalRevenue} />}

        {activeTab === 'games' && <GamesPanel games={tournament.games} getTeam={getTeam} readOnly />}

        {activeTab === 'main' && <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold">Tournament Bracket</h2>
            <p className="text-sm text-muted-foreground">
              {tournament.teams.length} teams entered{!tournament.registrationClosed ? ' · registration open' : ''}
            </p>
          </div>

          <BracketView
            games={tournament.games}
            teams={tournament.teams}
            registrationClosed={tournament.registrationClosed}
            getTeam={getTeam}
            readOnly
          />
        </div>}
      </main>

      <div ref={footerRef} className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
        <div className="py-2" style={{ paddingLeft: '1.5cm', paddingRight: '1.5cm' }}>
          <GameStrip games={tournament.games} getTeam={getTeam} readOnly />
        </div>
      </div>
    </div>
  );
}
