import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface PaymentStatusBadgeProps {
  invoices?: { id: string; payment_status: string }[] | null;
}

export function PaymentStatusBadge({ invoices }: PaymentStatusBadgeProps) {
  if (!invoices || invoices.length === 0) {
    return (
      <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-muted-foreground/30">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  }

  const allPaid = invoices.every((inv) => inv.payment_status === 'paid');
  const anyPartial = invoices.some((inv) => inv.payment_status === 'partial');

  if (allPaid) {
    return (
      <Badge variant="outline" className="text-xs bg-success/15 text-success border-success/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Paid
      </Badge>
    );
  }

  if (anyPartial) {
    return (
      <Badge variant="outline" className="text-xs bg-warning/15 text-warning-foreground border-warning/30">
        <AlertCircle className="h-3 w-3 mr-1" />
        Partial
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs bg-destructive/15 text-destructive border-destructive/30">
      <Clock className="h-3 w-3 mr-1" />
      Pending
    </Badge>
  );
}
