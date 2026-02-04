import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Edit, Trash2, Building2, Hotel, Home, Building, Warehouse, MapPin, Phone, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperty, Property } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';

const propertyTypes = [
  { value: 'hotel', label: 'Hotel', icon: Hotel },
  { value: 'villa', label: 'Villa', icon: Home },
  { value: 'resort', label: 'Resort', icon: Building2 },
  { value: 'apartment', label: 'Apartment', icon: Building },
  { value: 'guesthouse', label: 'Guesthouse', icon: Warehouse },
] as const;

export default function Properties() {
  const { isAdmin } = useAuth();
  const { refetchProperties } = useProperty();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<Property['property_type']>('hotel');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties((data as Property[]) || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPropertyType('hotel');
    setLocation('');
    setAddress('');
    setPhone('');
    setEmail('');
    setDescription('');
    setIsActive(true);
    setEditingProperty(null);
  };

  const openEditDialog = (property: Property) => {
    setEditingProperty(property);
    setName(property.name);
    setPropertyType(property.property_type);
    setLocation(property.location || '');
    setAddress(property.address || '');
    setPhone(property.phone || '');
    setEmail(property.email || '');
    setDescription(property.description || '');
    setIsActive(property.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Property name is required');
      return;
    }

    setSaving(true);
    try {
      const propertyData = {
        name: name.trim(),
        property_type: propertyType,
        location: location.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        description: description.trim() || null,
        is_active: isActive,
      };

      if (editingProperty) {
        const { error } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', editingProperty.id);
        if (error) throw error;
        toast.success('Property updated successfully');
      } else {
        const { error } = await supabase.from('properties').insert(propertyData);
        if (error) throw error;
        toast.success('Property added successfully');
      }

      setDialogOpen(false);
      resetForm();
      fetchProperties();
      refetchProperties();
    } catch (error: any) {
      logError('Error saving property', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property? This will affect all associated rooms and bookings.')) return;

    try {
      const { error } = await supabase.from('properties').delete().eq('id', propertyId);
      if (error) throw error;
      toast.success('Property deleted');
      fetchProperties();
      refetchProperties();
    } catch (error: any) {
      logError('Error deleting property', error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  const toggleStatus = async (property: Property) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ is_active: !property.is_active })
        .eq('id', property.id);
      if (error) throw error;
      toast.success(`Property ${property.is_active ? 'deactivated' : 'activated'}`);
      fetchProperties();
      refetchProperties();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout title="Properties">
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Only administrators can manage properties.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Properties">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-muted-foreground">
            Manage hotels, villas, and resorts in your portfolio
          </p>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
                <DialogDescription>
                  {editingProperty ? 'Update property details' : 'Add a new hotel, villa, or resort'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="name">Property Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="King's Bay Villa"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="propertyType">Property Type</Label>
                    <Select value={propertyType} onValueChange={(v) => setPropertyType(v as Property['property_type'])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Colombo, Sri Lanka"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Beach Road, Colombo 03"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+94 11 234 5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@property.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A beautiful beachfront property..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="isActive">Active Property</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editingProperty ? 'Update' : 'Add Property'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No properties added yet.</p>
              <Button
                variant="link"
                onClick={() => setDialogOpen(true)}
                className="mt-2"
              >
                Add your first property
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => {
              const TypeIcon = propertyTypes.find((t) => t.value === property.property_type)?.icon || Building2;
              
              return (
                <Card key={property.id} className={`relative ${!property.is_active ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <TypeIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{property.name}</CardTitle>
                          <p className="text-sm text-muted-foreground capitalize">{property.property_type}</p>
                        </div>
                      </div>
                      <Badge variant={property.is_active ? 'default' : 'secondary'}>
                        {property.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {property.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{property.location}</span>
                      </div>
                    )}
                    {property.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{property.phone}</span>
                      </div>
                    )}
                    {property.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 shrink-0" />
                        <span className="truncate">{property.email}</span>
                      </div>
                    )}
                    {property.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{property.description}</p>
                    )}
                    
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(property)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(property)}
                      >
                        {property.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(property.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
