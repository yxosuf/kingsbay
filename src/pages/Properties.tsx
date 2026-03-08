import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Building2, Hotel, Home, Building, Warehouse, MapPin, Phone, Mail, MoreVertical, Power } from 'lucide-react';
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

const typeGradients: Record<string, string> = {
  hotel: 'from-primary/20 to-primary/5',
  villa: 'from-success/20 to-success/5',
  resort: 'from-info/20 to-info/5',
  apartment: 'from-warning/20 to-warning/5',
  guesthouse: 'from-accent/40 to-accent/10',
};

export default function Properties() {
  const { isAdmin } = useAuth();
  const { refetchProperties } = useProperty();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<Property['property_type']>('hotel');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { fetchProperties(); }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase.from('properties').select('*').order('name');
      if (error) throw error;
      setProperties((data as Property[]) || []);
    } catch (error) { console.error('Error fetching properties:', error); toast.error('Failed to load properties'); } finally { setLoading(false); }
  };

  const resetForm = () => { setName(''); setPropertyType('hotel'); setLocation(''); setAddress(''); setPhone(''); setEmail(''); setDescription(''); setIsActive(true); setEditingProperty(null); };

  const openEditDialog = (property: Property) => {
    setEditingProperty(property); setName(property.name); setPropertyType(property.property_type);
    setLocation(property.location || ''); setAddress(property.address || ''); setPhone(property.phone || '');
    setEmail(property.email || ''); setDescription(property.description || ''); setIsActive(property.is_active); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Property name is required'); return; }
    setSaving(true);
    try {
      const propertyData = { name: name.trim(), property_type: propertyType, location: location.trim() || null, address: address.trim() || null, phone: phone.trim() || null, email: email.trim() || null, description: description.trim() || null, is_active: isActive };
      if (editingProperty) {
        const { error } = await supabase.from('properties').update(propertyData).eq('id', editingProperty.id);
        if (error) throw error;
        toast.success('Property updated successfully');
      } else {
        const { error } = await supabase.from('properties').insert(propertyData);
        if (error) throw error;
        toast.success('Property added successfully');
      }
      setDialogOpen(false); resetForm(); fetchProperties(); refetchProperties();
    } catch (error: any) { logError('Error saving property', error); toast.error(getSafeErrorMessage(error)); } finally { setSaving(false); }
  };

  const handleDelete = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property? This will affect all associated rooms and bookings.')) return;
    try {
      const { error } = await supabase.from('properties').delete().eq('id', propertyId);
      if (error) throw error;
      toast.success('Property deleted'); fetchProperties(); refetchProperties();
    } catch (error: any) { logError('Error deleting property', error); toast.error(getSafeErrorMessage(error)); }
  };

  const toggleStatus = async (property: Property) => {
    try {
      const { error } = await supabase.from('properties').update({ is_active: !property.is_active }).eq('id', property.id);
      if (error) throw error;
      toast.success(`Property ${property.is_active ? 'deactivated' : 'activated'}`);
      fetchProperties(); refetchProperties();
    } catch { toast.error('Failed to update status'); }
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
      <div className="space-y-4 sm:space-y-6 animate-page-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-muted-foreground">Manage hotels, villas, and resorts in your portfolio</p>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Property</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
                <DialogDescription>{editingProperty ? 'Update property details' : 'Add a new hotel, villa, or resort'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="name">Property Name *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="King's Bay Villa" />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="propertyType">Property Type</Label>
                    <Select value={propertyType} onValueChange={(v) => setPropertyType(v as Property['property_type'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2"><type.icon className="h-4 w-4" />{type.label}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Colombo, Sri Lanka" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Beach Road, Colombo 03" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 11 234 5678" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@property.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A beautiful beachfront property..." rows={3} />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="isActive">Active Property</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingProperty ? 'Update' : 'Add Property'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No properties added yet.</p>
              <Button variant="link" onClick={() => setDialogOpen(true)} className="mt-2">Add your first property</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => {
              const TypeIcon = propertyTypes.find((t) => t.value === property.property_type)?.icon || Building2;
              const gradient = typeGradients[property.property_type] || typeGradients.hotel;

              return (
                <Card key={property.id} className={`relative overflow-hidden transition-all ${!property.is_active ? 'opacity-50 grayscale-[30%]' : ''}`}>
                  {/* Gradient Header Band */}
                  <div className={`bg-gradient-to-r ${gradient} p-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm truncate max-w-[160px]">{property.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{property.property_type}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/60 hover:bg-background/80">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(property)}>
                          <Edit className="h-4 w-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(property)}>
                          <Power className="h-4 w-4 mr-2" />{property.is_active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(property.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardContent className="pt-4 pb-4 space-y-3">
                    {/* Contact Row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {property.location && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{property.location}</span>
                        </div>
                      )}
                      {property.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{property.phone}</span>
                        </div>
                      )}
                      {property.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{property.email}</span>
                        </div>
                      )}
                    </div>

                    {property.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{property.description}</p>
                    )}

                    {/* Status Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={property.is_active}
                          onCheckedChange={() => toggleStatus(property)}
                          className="scale-90"
                        />
                        <span className="text-xs text-muted-foreground">{property.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <Badge variant={property.is_active ? 'success' : 'secondary'} className="text-[10px]">
                        {property.is_active ? 'Live' : 'Off'}
                      </Badge>
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
