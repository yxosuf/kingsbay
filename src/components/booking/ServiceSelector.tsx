import { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Trash2, UtensilsCrossed, Car, Dumbbell, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ServiceCategory = 'room_service' | 'transport' | 'facilities' | 'special_request';

interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  description: string | null;
  is_active: boolean;
}

export interface SelectedService {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ServiceSelectorProps {
  selectedServices: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
}

const categoryIcons: Record<ServiceCategory, typeof UtensilsCrossed> = {
  room_service: UtensilsCrossed,
  transport: Car,
  facilities: Dumbbell,
  special_request: Star,
};

const categoryLabels: Record<ServiceCategory, string> = {
  room_service: 'Room Service',
  transport: 'Transport',
  facilities: 'Facilities',
  special_request: 'Special',
};

const ServiceSelectorComponent = ({ selectedServices, onServicesChange }: ServiceSelectorProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const addService = useCallback((service: Service) => {
    onServicesChange((prev) => {
      const existing = prev.find((s) => s.serviceId === service.id);
      if (existing) {
        // Increase quantity
        return prev.map((s) =>
          s.serviceId === service.id
            ? { ...s, quantity: s.quantity + 1, totalPrice: (s.quantity + 1) * s.unitPrice }
            : s
        );
      } else {
        // Add new service
        return [
          ...prev,
          {
            serviceId: service.id,
            name: service.name,
            quantity: 1,
            unitPrice: service.price,
            totalPrice: service.price,
          },
        ];
      }
    });
  }, [onServicesChange]);

  const updateQuantity = useCallback((serviceId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      onServicesChange((prev) => prev.filter((s) => s.serviceId !== serviceId));
      return;
    }
    onServicesChange((prev) =>
      prev.map((s) =>
        s.serviceId === serviceId
          ? { ...s, quantity: newQuantity, totalPrice: newQuantity * s.unitPrice }
          : s
      )
    );
  }, [onServicesChange]);

  const removeService = useCallback((serviceId: string) => {
    onServicesChange((prev) => prev.filter((s) => s.serviceId !== serviceId));
  }, [onServicesChange]);

  const totalServicesAmount = selectedServices.reduce((sum, s) => sum + s.totalPrice, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Additional Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group services by category
  const servicesByCategory = services.reduce(
    (acc, service) => {
      if (!acc[service.category]) {
        acc[service.category] = [];
      }
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<ServiceCategory, Service[]>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Additional Services
          {selectedServices.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {selectedServices.length} selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selected Services Summary */}
        {selectedServices.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Selected Services</h4>
            {selectedServices.map((service) => (
              <div key={service.serviceId} className="flex items-center justify-between gap-2">
                <span className="text-sm flex-1">{service.name}</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(service.serviceId, service.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={service.quantity}
                    onChange={(e) =>
                      updateQuantity(service.serviceId, parseInt(e.target.value) || 1)
                    }
                    className="w-14 h-7 text-center text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(service.serviceId, service.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium w-24 text-right">
                    Rs. {service.totalPrice.toLocaleString()}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeService(service.serviceId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-medium">
              <span>Total Services:</span>
              <span>Rs. {totalServicesAmount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Available Services */}
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No services available. Add services from the Services page.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(servicesByCategory).map(([category, categoryServices]) => {
              const Icon = categoryIcons[category as ServiceCategory];
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">
                      {categoryLabels[category as ServiceCategory]}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryServices.map((service) => {
                      const isSelected = selectedServices.some(
                        (s) => s.serviceId === service.id
                      );
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => addService(service)}
                          className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{service.name}</p>
                            {service.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {service.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-sm font-medium whitespace-nowrap">
                              Rs. {service.price.toLocaleString()}
                            </span>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ServiceSelector = memo(ServiceSelectorComponent);
