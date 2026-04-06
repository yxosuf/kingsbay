import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
  disabled?: boolean;
}

interface BulkActionBarProps {
  count: number;
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}

export function BulkActionBar({ count, actions, onClear, className }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "flex items-center gap-3 px-5 py-3 rounded-2xl",
      "bg-card border border-border shadow-2xl shadow-black/20",
      "animate-in slide-in-from-bottom-4 fade-in duration-300",
      className
    )}>
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {count} selected
      </span>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-2">
        {actions.map((action, i) => (
          <Button
            key={i}
            size="sm"
            variant={action.variant || 'default'}
            onClick={action.onClick}
            disabled={action.disabled}
            className="gap-1.5"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
