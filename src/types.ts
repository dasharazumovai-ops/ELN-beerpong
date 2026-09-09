export type EntryType = 'before9' | 'after9' | 'retry';
export type PaymentMethod = 'revolut' | 'free' | 'cash';
export type GameStatus = 'pending' | 'active' | 'finished';

export interface Team {
  id: string;
  player1: string;
  player2: string;
  entry1: EntryType;
  method1: PaymentMethod;
  entry2: EntryType;
  method2: PaymentMethod;
  round: number;
  eliminated: boolean;
  registeredAt: string;
}

export interface Game {
  id: string;
  round: number;
  /** Display order within the round (arrival order) — not a feeder relationship. */
  slot: number;
  tableNumber: number | null;
  team1Id: string | null;
  team2Id: string | null;
  status: GameStatus;
  winner: 'team1' | 'team2' | null;
  isBye: boolean;
  /** The game (or bye) that produced team1Id/team2Id, for drawing bracket connectors. Null for round-1 entrants and any not-yet-filled slot. */
  feederGameIds: (string | null)[];
  startedAt?: string;
  finishedAt?: string;
}

export interface Tournament {
  eventName: string;
  date: string;
  teams: Team[];
  games: Game[];
  registrationClosed: boolean;
  nextTableNumber: number;
}

export const ENTRY_LABELS: Record<EntryType, string> = {
  before9: 'Before 9pm (€3)',
  after9: 'After 9pm (€5)',
  retry: 'Retry (€3)',
};

export const ENTRY_COLORS: Record<EntryType, string> = {
  before9: 'bg-blue-100 text-blue-800 border-blue-300',
  after9: 'bg-purple-100 text-purple-800 border-purple-300',
  retry: 'bg-orange-100 text-orange-800 border-orange-300',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  revolut: 'Revolut (R)',
  free: 'Free (F)',
  cash: 'Cash',
};

export const METHOD_COLORS: Record<PaymentMethod, string> = {
  revolut: 'bg-green-100 text-green-800 border-green-300',
  free: 'bg-gray-100 text-gray-800 border-gray-300',
  cash: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const ENTRY_PRICES: Record<EntryType, number> = { before9: 3, after9: 5, retry: 3 };

export const getPaymentAmount = (entry: EntryType, method: PaymentMethod): number => method === 'free' ? 0 : ENTRY_PRICES[entry];

export const generateId = (): string => Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(2, 6);
