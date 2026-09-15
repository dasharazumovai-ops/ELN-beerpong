import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, LIVE_TOURNAMENT_DOC } from './firebase';
import BracketView from './components/BracketView';
import GameStrip from './components/GameStrip';
import type { Tournament } from './types';
import { Radio } from 'lucide-react';

export default function LiveView() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [error, setError] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  // See App.tsx's identical measurement — a hardcoded padding-bottom estimate can fall short
  // of the strip's real (content-dependent) height and let it cover the bracket's last row.
  const [footerClearance, setFooterClearance] = useState(112);

  useEffect(() => {
    const ref = doc(db, LIVE_TOURNAMENT_DOC.collection, LIVE_TOURNAMENT_DOC.id);
    const unsubscribe = onSnapshot(
      ref,
      snap => setTournament(snap.exists() ? (snap.data() as Tournament) : null),
      () => setError(true),
    );
    return unsubscribe;
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <p className="text-xl font-semibold">Can't reach the live tournament</p>
          <p className="text-muted-foreground">Check your connection and reload.</p>
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">ELN Beer Pong</h1>
          <span className="text-sm text-muted-foreground">{tournament.eventName}</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            LIVE
          </span>
        </div>
      </header>

      <main className="py-4" style={{ paddingLeft: '2.5cm', paddingRight: '2.5cm', paddingBottom: footerClearance }}>
        <div className="space-y-3">
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
        </div>
      </main>

      <div ref={footerRef} className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
        <div className="py-2" style={{ paddingLeft: '1.5cm', paddingRight: '1.5cm' }}>
          <GameStrip games={tournament.games} getTeam={getTeam} readOnly />
        </div>
      </div>
    </div>
  );
}
