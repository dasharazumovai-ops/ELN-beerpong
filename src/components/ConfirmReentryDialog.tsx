import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmReentryDialogProps {
  /** Names not on today's registered list; the dialog is open while there are any. */
  names: string[] | null;
  onCancel: () => void;
  onProceed: () => void;
}

export default function ConfirmReentryDialog({ names, onCancel, onProceed }: ConfirmReentryDialogProps) {
  const quoted = (names ?? []).map(n => `“${n}”`);
  const label = quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}` : quoted[0];
  return (
    <AlertDialog open={names !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      {/* Portaled content still bubbles React events to the form that opened it (which submits on Enter). */}
      <AlertDialogContent onKeyDown={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Did {quoted.length > 1 ? 'they' : 'this person'} really play before?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} {quoted.length > 1 ? "aren't" : "isn't"} on today's list of registered participants. A re-entry is only for
            someone who already played tonight. Are you sure {quoted.length > 1 ? 'they' : 'this person'} played before?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onProceed}>Proceed</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
