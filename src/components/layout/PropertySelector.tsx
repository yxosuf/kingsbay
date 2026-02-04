import { Building2, ChevronDown, Home, Hotel, Building, Warehouse, Check } from 'lucide-react';
import { useProperty, Property } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const propertyTypeIcons: Record<Property['property_type'], typeof Hotel> = {
  hotel: Hotel,
  villa: Home,
  resort: Building2,
  apartment: Building,
  guesthouse: Warehouse,
};

export function PropertySelector() {
  const { properties, selectedProperty, setSelectedProperty, showAllProperties, setShowAllProperties, loading } = useProperty();
  const { isAdmin, isManager } = useAuth();

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Building2 className="h-4 w-4" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  if (properties.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Building2 className="h-4 w-4" />
        <span className="hidden sm:inline">No Properties</span>
      </Button>
    );
  }

  const Icon = selectedProperty ? propertyTypeIcons[selectedProperty.property_type] : Building2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[200px]">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate hidden sm:inline">
            {showAllProperties ? 'All Properties' : selectedProperty?.name || 'Select Property'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel>Switch Property</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* All Properties option - only for admin/manager */}
        {(isAdmin || isManager) && (
          <>
            <DropdownMenuItem
              onClick={() => {
                setShowAllProperties(true);
                setSelectedProperty(properties[0]); // Keep first as fallback
              }}
              className={cn(
                'gap-2',
                showAllProperties && 'bg-accent'
              )}
            >
              <Building2 className="h-4 w-4" />
              <span className="flex-1">All Properties</span>
              {showAllProperties && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {properties.map((property) => {
          const PropertyIcon = propertyTypeIcons[property.property_type];
          const isSelected = !showAllProperties && selectedProperty?.id === property.id;
          
          return (
            <DropdownMenuItem
              key={property.id}
              onClick={() => setSelectedProperty(property)}
              className={cn(
                'gap-2',
                isSelected && 'bg-accent'
              )}
            >
              <PropertyIcon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate">{property.name}</p>
                {property.location && (
                  <p className="text-xs text-muted-foreground truncate">{property.location}</p>
                )}
              </div>
              {isSelected && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
