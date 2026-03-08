import { Building2, Home, Hotel, Building, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useProperty, Property } from '@/hooks/useProperty';
import { cn } from '@/lib/utils';

const propertyTypeIcons: Record<Property['property_type'], typeof Hotel> = {
  hotel: Hotel,
  villa: Home,
  resort: Building2,
  apartment: Building,
  guesthouse: Warehouse,
};

interface PropertyBadgeProps {
  className?: string;
}

export function PropertyBadge({ className }: PropertyBadgeProps) {
  const { selectedProperty, showAllProperties, loading } = useProperty();

  if (loading) {
    return null;
  }

  if (showAllProperties) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1.5 bg-accent/50 text-accent-foreground border-accent",
          className
        )}
      >
        <Building2 className="h-3 w-3" />
        <span>All Properties</span>
      </Badge>
    );
  }

  if (!selectedProperty) {
    return (
      <Badge 
        variant="destructive" 
        className={cn("gap-1.5", className)}
      >
        <Building2 className="h-3 w-3" />
        <span>No Property Selected</span>
      </Badge>
    );
  }

  const Icon = propertyTypeIcons[selectedProperty.property_type];

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl",
        "bg-gradient-to-r from-primary/15 to-primary/5",
        "border border-primary/25 shadow-sm",
        "text-primary font-medium text-xs sm:text-sm",
        "transition-all duration-200 hover:shadow-md hover:border-primary/40",
        className
      )}
    >
      <div className="flex items-center justify-center h-4 w-4 sm:h-5 sm:w-5 rounded sm:rounded-md bg-primary/15">
        <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </div>
      <span className="max-w-[100px] sm:max-w-[150px] truncate">{selectedProperty.name}</span>
    </div>
  );
}
