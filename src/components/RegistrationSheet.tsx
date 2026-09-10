import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import RegistrationPanel from './RegistrationPanel';
import type { EntryType, PaymentMethod, Team } from '../types';

interface RegistrationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTeam: (player1: string, player2: string, entry1: EntryType, method1: PaymentMethod, entry2: EntryType, method2: PaymentMethod) => string;
  onCloseRegistration: () => void;
  registrationClosed: boolean;
  teams: Team[];
}

export default function RegistrationSheet({ open, onOpenChange, onAddTeam, onCloseRegistration, registrationClosed, teams }: RegistrationSheetProps) {
  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          className="fixed top-0 right-0 z-40 bg-background border-l shadow-2xl flex flex-col w-full sm:max-w-xl
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          style={{ height: 'calc(100% - 11rem)' }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetPrimitive.Description className="sr-only">Register a new team for the tournament</SheetPrimitive.Description>
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <SheetPrimitive.Title className="font-semibold text-lg">Team Registration</SheetPrimitive.Title>
            <SheetPrimitive.Close className="rounded-md p-1.5 opacity-70 hover:opacity-100 hover:bg-muted transition-opacity">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <RegistrationPanel
              onAddTeam={onAddTeam}
              onCloseRegistration={onCloseRegistration}
              registrationClosed={registrationClosed}
              teams={teams}
            />
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}
