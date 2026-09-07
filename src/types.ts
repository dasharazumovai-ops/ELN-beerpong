export type PaymentType = 'before9' | 'after9' | 'retry' | 'revolut' | 'free' | 'cash';
export type GameStatus = 'pending' | 'active' | 'finished';

export interface Team {
  id: string;
  player1: string;
  player2: string;
  payment1: PaymentType;
  payment2: PaymentType;
  cashAmount1?: number;
  cashAmount2?: number;
  isFirstGame: boolean;
  round: number;
  eliminated: boolean;
  registeredAt: string;
}

export interface Game {
  id: string;
  round: number;
  tableNumber: number;
  team1Id: string | null;
  team2Id: string | null;
  status: GameStatus;
  winner: 'team1' | 'team2' | null;
  startedAt?: string;
  finishedAt?: string;
}

export interface Tournament {
  eventName: string;
  date: string;
  teams: Team[];
  games: Game[];
  currentRound: number;
  nextTableNumber: number;
}

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  before9: '€3 (Before 9pm)',
  after9: '€5 (After 9pm)',
  retry: '€3 (Retry)',
  revolut: 'Revolut (R)',
  free: 'Free (F)',
  cash: 'Cash',
};

export const PAYMENT_COLORS: Record<PaymentType, string> = {
  before9: 'bg-blue-100 text-blue-800 border-blue-300',
  after9: 'bg-purple-100 text-purple-800 border-purple-300',
  retry: 'bg-orange-100 text-orange-800 border-orange-300',
  revolut: 'bg-green-100 text-green-800 border-green-300',
  free: 'bg-gray-100 text-gray-800 border-gray-300',
  cash: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const PAYMENT_AMOUNTS: Record<PaymentType, number> = { before9: 3, after9: 5, retry: 3, revolut: 3, free: 0, cash: 0 };

export const getPaymentAmount = (payment: PaymentType): number => PAYMENT_AMOUNTS[payment];

export const generateId = (): string => Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(2, 6);
