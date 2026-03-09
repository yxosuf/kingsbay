import { KpiCard } from '@/components/ui/KpiCard';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  BedDouble,
  LogIn,
  LogOut,
  Footprints,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiMetrics, RoomMetrics } from '@/hooks/useDashboardKpi';

interface OperationsMetricsRowProps {
  kpi: KpiMetrics;
  rooms: RoomMetrics;
}

export function OperationsMetricsRow({ kpi, rooms }: OperationsMetricsRowProps) {
  const navigate = useNavigate();
  const occupancyPct = rooms.total_rooms > 0
    ? Math.round((kpi.rooms_occupied / rooms.total_rooms) * 100)
    : 0;

  const cards = [
    {
      title: 'Occupancy',
      value: `${occupancyPct}%`,
      subtitle: `${kpi.rooms_occupied}/${rooms.total_rooms} rooms`,
      icon: BarChart3,
      variant: 'primary' as const,
      onClick: () => navigate('/availability'),
    },
    {
      title: 'Available',
      value: rooms.available_rooms.toString(),
      icon: BedDouble,
      variant: 'info' as const,
      onClick: () => navigate('/rooms'),
    },
    {
      title: 'Arrivals',
      value: kpi.arrivals_today.toString(),
      subtitle: 'Today',
      icon: LogIn,
      variant: 'success' as const,
      onClick: () => navigate('/front-desk'),
    },
    {
      title: 'Departures',
      value: kpi.departures_today.toString(),
      subtitle: 'Today',
      icon: LogOut,
      variant: 'warning' as const,
      onClick: () => navigate('/front-desk'),
    },
    {
      title: 'Walk-ins',
      value: kpi.walkins_today.toString(),
      subtitle: 'Today',
      icon: Footprints,
      variant: 'primary' as const,
      onClick: () => navigate('/bookings/new?walkin=true'),
    },
    {
      title: 'In-House',
      value: kpi.rooms_occupied.toString(),
      subtitle: 'Guests',
      icon: Users,
      variant: 'success' as const,
      onClick: () => navigate('/front-desk'),
    },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {cards.map((card, i) => (
        <KpiCard key={card.title} colorVariant={card.variant} onClick={card.onClick}>
          <div className="p-2.5 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <card.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{card.title}</p>
            </div>
            <p className={cn(
              "text-lg sm:text-2xl font-bold text-foreground animate-fade-in-up"
            )} style={{ animationDelay: `${i * 60}ms` }}>
              {card.value}
            </p>
            {card.subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground">{card.subtitle}</p>
            )}
          </div>
        </KpiCard>
      ))}
    </div>
  );
}
