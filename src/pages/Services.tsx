import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, UtensilsCrossed, Car, Dumbbell, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  transport: 'Transport & Tours',
  facilities: 'Facilities & Spa',
  special_request: 'Special Requests',
};

export default function Services() {
  // NOTE: isAdmin is for UI visibility only. Security is enforced by RLS policies on the database.
  const { isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ServiceCategory | 'all'>('all');

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('room_service');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('room_service');
    setPrice('');
    setDescription('');
    setIsActive(true);
    setEditingService(null);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setCategory(service.category);
    setPrice(service.price.toString());
    setDescription(service.description || '');
    setIsActive(service.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        name: name.trim(),
        category,
        price: parseFloat(price),
        description: description.trim() || null,
        is_active: isActive,
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);
        if (error) throw error;
        toast.success('Service updated successfully');
      } else {
        const { error } = await supabase.from('services').insert(serviceData);
        if (error) throw error;
        toast.success('Service added successfully');
      }

      setDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      toast.error(error.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const { error } = await supabase.from('services').delete().eq('id', serviceId);
      if (error) throw error;
      toast.success('Service deleted');
      fetchServices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete service');
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !service.is_active })
        .eq('id', service.id);
      if (error) throw error;
      fetchServices();
    } catch (error) {
      toast.error('Failed to update service');
    }
  };

  const filteredServices =
    activeTab === 'all' ? services : services.filter((s) => s.category === activeTab);

  const categories: (ServiceCategory | 'all')[] = [
    'all',
    'room_service',
    'transport',
    'facilities',
    'special_request',
  ];

  return (
    <DashboardLayout title="Services">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Manage services that can be charged to guest bookings
          </p>
          {isAdmin && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingService ? 'Edit Service' : 'Add New Service'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingService
                      ? 'Update service details'
                      : 'Add a new service to offer guests'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Service Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Airport Transfer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={category}
                        onValueChange={(v) => setCategory(v as ServiceCategory)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Price (Rs.) *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="1500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of the service"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isActive">Active</Label>
                    <Switch
                      id="isActive"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : editingService ? 'Update' : 'Add Service'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All Services</TabsTrigger>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No services found.
                    {isAdmin && (
                      <Button
                        variant="link"
                        onClick={() => setDialogOpen(true)}
                        className="ml-1"
                      >
                        Add one now
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.map((service) => {
                        const Icon = categoryIcons[service.category];
                        return (
                          <TableRow key={service.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{service.name}</p>
                                  {service.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {service.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {categoryLabels[service.category]}
                              </Badge>
                            </TableCell>
                            <TableCell>Rs. {service.price.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant={service.is_active ? 'default' : 'secondary'}
                                className={
                                  service.is_active
                                    ? 'bg-success/20 text-success border-success'
                                    : ''
                                }
                              >
                                {service.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Switch
                                    checked={service.is_active}
                                    onCheckedChange={() => toggleActive(service)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(service)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={() => handleDelete(service.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
