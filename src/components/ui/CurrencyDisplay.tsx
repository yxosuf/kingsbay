import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number;
  fxRate?: number | null;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CurrencyDisplay({
  amount,
  fxRate,
  className,
  primaryClassName,
  secondaryClassName,
  size = 'md',
}: CurrencyDisplayProps) {
  const usdAmount = fxRate && fxRate > 0 ? Math.round(amount / fxRate) : null;

  const sizeClasses = {
    sm: { primary: 'text-sm', secondary: 'text-[10px]' },
    md: { primary: 'text-base', secondary: 'text-xs' },
    lg: { primary: 'text-lg font-bold', secondary: 'text-xs' },
  };

  return (
    <div className={cn('leading-tight', className)}>
      <p className={cn(sizeClasses[size].primary, primaryClassName)}>
        LKR {amount.toLocaleString()}
      </p>
      {usdAmount !== null && (
        <p className={cn(sizeClasses[size].secondary, 'text-muted-foreground', secondaryClassName)}>
          ~${usdAmount.toLocaleString()} USD
        </p>
      )}
    </div>
  );
}
