import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, UtensilsCrossed, Car, Dumbbell, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/formatters';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';

type ServiceCategory = 'room_service' | 'transport' | 'facilities' | 'special_request';

interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  description: string | null;
  is_active: boolean;
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

const categoryLabelsFull: Record<ServiceCategory, string> = {
  room_service: 'Room Service',
  transport: 'Transport & Tours',
  facilities: 'Facilities & Spa',
  special_request: 'Special Requests',
};

const categoryColors: Record<ServiceCategory, string> = {
  room_service: 'bg-primary/10 text-primary',
  transport: 'bg-info/10 text-info',
  facilities: 'bg-success/10 text-success',
  special_request: 'bg-warning/10 text-warning-foreground',
};

export function ServicesSettings() {
  const { isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ServiceCategory | 'all'>('all');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('room_service');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { fetchServices(); }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase.from('services').select('*').order('category').order('name');
      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => { setName(''); setCategory('room_service'); setPrice(''); setDescription(''); setIsActive(true); setEditingService(null); };

  const openEditDialog = (service: Service) => {
    setEditingService(service); setName(service.name); setCategory(service.category);
    setPrice(service.price.toString()); setDescription(service.description || ''); setIsActive(service.is_active); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price) { toast.error('Please fill in required fields'); return; }
    setSaving(true);
    try {
      const serviceData = { name: name.trim(), category, price: parseFloat(price), description: description.trim() || null, is_active: isActive };
      if (editingService) {
        const { error } = await supabase.from('services').update(serviceData).eq('id', editingService.id);
        if (error) throw error;
        toast.success('Service updated successfully');
      } else {
        const { error } = await supabase.from('services').insert(serviceData);
        if (error) throw error;
        toast.success('Service added successfully');
      }
      setDialogOpen(false); resetForm(); fetchServices();
    } catch (error: any) {
      logError('Error saving service', error); toast.error(getSafeErrorMessage(error));
    } finally { setSaving(false); }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', serviceId);
      if (error) throw error;
      toast.success('Service deleted'); fetchServices();
    } catch (error: any) { logError('Error deleting service', error); toast.error(getSafeErrorMessage(error)); }
  };

  const toggleActive = async (service: Service) => {
    try {
      const { error } = await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id);
      if (error) throw error;
      fetchServices();
    } catch { toast.error('Failed to update service'); }
  };

  const filteredServices = activeTab === 'all' ? services : services.filter((s) => s.category === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Manage services that can be charged to guest bookings
        </p>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Service</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
                <DialogDescription>{editingService ? 'Update service details' : 'Add a new service to offer guests'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Service Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Airport Transfer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (Rs.) *</Label>
                    <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the service" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Active</Label>
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingService ? 'Update' : 'Add Service'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full h-auto gap-0.5 p-1">
            <TabsTrigger value="all" className="px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">All</TabsTrigger>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <span className="sm:hidden">{label}</span>
                <span className="hidden sm:inline">{categoryLabelsFull[key as ServiceCategory]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredServices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No services found.
                {isAdmin && (
                  <Button variant="link" onClick={() => setDialogOpen(true)} className="ml-1">Add one now</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service) => {
                const Icon = categoryIcons[service.category];
                const colorClass = categoryColors[service.category];
                return (
                  <Card key={service.id} className={`relative overflow-hidden transition-all ${!service.is_active ? 'opacity-60' : ''}`}>
                    {/* Top color band */}
                    <div className={`h-1 ${service.is_active ? colorClass.split(' ')[0] : 'bg-muted'}`} />
                    <CardContent className="pt-5 pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{categoryLabelsFull[service.category]}</p>
                          </div>
                        </div>
                        <Badge variant={service.is_active ? 'success' : 'secondary'} className="shrink-0 text-[10px]">
                          {service.is_active ? 'Active' : 'Off'}
                        </Badge>
                      </div>

                      {service.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                      )}

                      <div className="pt-2 border-t flex items-center justify-between">
                        <span className="text-sm font-semibold">{formatLKR(service.price)}</span>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <Switch checked={service.is_active} onCheckedChange={() => toggleActive(service)} className="scale-75" />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(service)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(service.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
