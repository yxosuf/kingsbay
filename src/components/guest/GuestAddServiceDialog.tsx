import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface GuestAddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  onSuccess: () => void;
}

const categoryLabels: Record<string, string> = {
  room_service: 'Room Service',
  transport: 'Transport',
  facilities: 'Facilities',
  special_request: 'Special Requests',
};

export function GuestAddServiceDialog({
  open,
  onOpenChange,
  bookingId,
  onSuccess,
}: GuestAddServiceDialogProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      supabase
        .from('services')
        .select('id, name, price, category')
        .eq('is_active', true)
        .order('category')
        .order('name')
        .then(({ data }) => {
          setServices(data || []);
          setLoading(false);
        });
    }
  }, [open]);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const qty = parseInt(quantity) || 0;
  const totalPrice = qty * (selectedService?.price || 0);

  const servicesByCategory = services.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const handleSubmit = async () => {
    if (!selectedService || qty <= 0) {
      toast.error('Please select a service and quantity');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('guest_services').insert({
        booking_id: bookingId,
        service_id: selectedService.id,
        quantity: qty,
        unit_price: selectedService.price,
        total_price: qty * selectedService.price,
        service_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      toast.success('Service added successfully');
      setSelectedServiceId('');
      setQuantity('1');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Request a Service</DialogTitle>
          <DialogDescription>Add a service to your booking</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(servicesByCategory).map(([category, items]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                          {categoryLabels[category] || category}
                        </div>
                        {items.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} – LKR {service.price.toLocaleString()}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  max="10"
                />
              </div>

              {selectedService && totalPrice > 0 && (
                <div className="p-4 bg-muted rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span>{selectedService.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {qty} × LKR {selectedService.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t border-border">
                    <span>Total</span>
                    <span>LKR {totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedServiceId}>
            {saving ? 'Adding...' : 'Add Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
