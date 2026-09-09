import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy } from 'lucide-react';
import type { Team } from '../types';

interface FinishGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team1: Team | null;
  team2: Team | null;
  onSelectWinner: (winner: 'team1' | 'team2') => void;
}

export default function FinishGameDialog({ open, onOpenChange, team1, team2, onSelectWinner }: FinishGameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Who Won?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-center text-muted-foreground">Select the winning team:</p>
          <div className="grid grid-cols-2 gap-4">
            {team1 && (
              <button
                onClick={() => onSelectWinner('team1')}
                className="p-6 rounded-xl border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all text-center space-y-2"
              >
                <div className="text-2xl font-bold">{team1.player1}</div>
                <div className="text-2xl font-bold">{team1.player2}</div>
                <div className="text-sm text-muted-foreground">Team 1</div>
              </button>
            )}
            {team2 && (
              <button
                onClick={() => onSelectWinner('team2')}
                className="p-6 rounded-xl border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all text-center space-y-2"
              >
                <div className="text-2xl font-bold">{team2.player1}</div>
                <div className="text-2xl font-bold">{team2.player2}</div>
                <div className="text-sm text-muted-foreground">Team 2</div>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
