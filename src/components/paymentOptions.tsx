import type { ReactNode } from 'react';
import { Clock, Moon, RotateCcw, CreditCard, Gift, Banknote } from 'lucide-react';
import type { EntryType, PaymentMethod } from '../types';

export interface PaymentOption<T extends string> {
  type: T;
  label: string;
  icon: ReactNode;
  color: string;
}

export const ENTRY_BUTTONS: PaymentOption<EntryType>[] = [
  { type: 'before9', label: 'Before 9pm (€3)', icon: <Clock className="w-5 h-5" />, color: 'bg-blue-500 hover:bg-blue-600' },
  { type: 'after9', label: 'After 9pm (€5)', icon: <Moon className="w-5 h-5" />, color: 'bg-purple-500 hover:bg-purple-600' },
  { type: 'retry', label: 'Retry (€3)', icon: <RotateCcw className="w-5 h-5" />, color: 'bg-orange-500 hover:bg-orange-600' },
];

export const METHOD_BUTTONS: PaymentOption<PaymentMethod>[] = [
  { type: 'revolut', label: 'Revolut (R)', icon: <CreditCard className="w-5 h-5" />, color: 'bg-green-500 hover:bg-green-600' },
  { type: 'free', label: 'Free (F)', icon: <Gift className="w-5 h-5" />, color: 'bg-gray-500 hover:bg-gray-600' },
  { type: 'cash', label: 'Cash', icon: <Banknote className="w-5 h-5" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
];
