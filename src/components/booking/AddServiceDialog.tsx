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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  onSuccess: () => void;
}

export function AddServiceDialog({
  open,
  onOpenChange,
  bookingId,
  onSuccess,
}: AddServiceDialogProps) {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchServices();
    }
  }, [open]);

  useEffect(() => {
    // Reset custom price when service changes
    const service = services.find((s) => s.id === selectedServiceId);
    if (service) {
      setCustomPrice(service.price.toString());
    }
  }, [selectedServiceId, services]);

  const fetchServices = async () => {
    try {
      const { data } = await supabase
        .from('services')
        .select('id, name, price, category')
        .eq('is_active', true)
        .order('category')
        .order('name');

      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedServiceId || !quantity) {
      toast.error('Please select a service and quantity');
      return;
    }

    const qty = parseInt(quantity);
    const unitPrice = parseFloat(customPrice) || 0;

    if (qty <= 0 || unitPrice <= 0) {
      toast.error('Invalid quantity or price');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('guest_services').insert({
        booking_id: bookingId,
        service_id: selectedServiceId,
        quantity: qty,
        unit_price: unitPrice,
        total_price: qty * unitPrice,
        notes: notes || null,
        service_date: new Date().toISOString().split('T')[0],
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Service added successfully');
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding service:', error);
      toast.error(error.message || 'Failed to add service');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedServiceId('');
    setQuantity('1');
    setCustomPrice('');
    setNotes('');
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const qty = parseInt(quantity) || 0;
  const unitPrice = parseFloat(customPrice) || 0;
  const totalPrice = qty * unitPrice;

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const categoryLabels: Record<string, string> = {
    room_service: 'Room Service',
    transport: 'Transport',
    facilities: 'Facilities',
    special_request: 'Special Requests',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
          <DialogDescription>Add a service charge to this booking</DialogDescription>
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
                    {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                          {categoryLabels[category] || category}
                        </div>
                        {categoryServices.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - Rs. {service.price.toLocaleString()}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (Rs.)</Label>
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder={selectedService?.price.toString()}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>

              {selectedServiceId && totalPrice > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service</span>
                    <span>{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">
                      {qty} × Rs. {unitPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                    <span>Total</span>
                    <span>Rs. {totalPrice.toLocaleString()}</span>
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
