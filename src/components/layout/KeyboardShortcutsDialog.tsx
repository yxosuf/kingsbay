import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: { keys: string; label: string }[];
}

export function KeyboardShortcutsDialog({ open, onOpenChange, shortcuts }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-foreground">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.split(' → ').map((k, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono font-medium">{k}</kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
