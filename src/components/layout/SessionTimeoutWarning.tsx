import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

export function SessionTimeoutWarning() {
  const { showWarning, remainingSeconds, stayLoggedIn } = useSessionTimeout();

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Session Expiring
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in{' '}
            <span className="font-bold text-foreground">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>{' '}
            due to inactivity. Click below to stay logged in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={stayLoggedIn}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
