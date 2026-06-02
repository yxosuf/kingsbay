/**
 * Single source of truth for booking status display configuration.
 *
 * Consolidates the duplicated status→variant/color mappings from
 * BookingStatusBadge, Index.tsx, GuestDashboard.tsx, etc.
 */

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

export interface StatusConfig {
  variant: BadgeVariant;
  className: string;
  label: string;
}

export const BOOKING_STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:      { variant: 'warning',     className: 'bg-warning/20 text-warning-foreground border-warning', label: 'Pending' },
  confirmed:    { variant: 'info',        className: 'bg-info/20 text-info border-info',                     label: 'Confirmed' },
  checked_in:   { variant: 'success',     className: 'bg-success/20 text-success border-success',            label: 'Checked In' },
  checked_out:  { variant: 'secondary',   className: 'bg-muted text-muted-foreground',                       label: 'Checked Out' },
  cancelled:    { variant: 'destructive', className: 'bg-destructive/20 text-destructive border-destructive', label: 'Cancelled' },
  no_show:      { variant: 'destructive', className: 'bg-destructive/20 text-destructive border-destructive', label: 'No Show' },
  needs_review: { variant: 'warning',     className: 'bg-warning/20 text-warning-foreground border-warning', label: 'Needs Review' },
};

const DEFAULT_CONFIG: StatusConfig = {
  variant: 'secondary',
  className: '',
  label: '',
};

export function getBookingStatusConfig(status: string): StatusConfig {
  return BOOKING_STATUS_CONFIG[status] ?? { ...DEFAULT_CONFIG, label: status.replace('_', ' ') };
}

export function getBookingStatusVariant(status: string): BadgeVariant {
  return getBookingStatusConfig(status).variant;
}

export function getBookingStatusLabel(status: string): string {
  return getBookingStatusConfig(status).label || status.replace('_', ' ');
}
