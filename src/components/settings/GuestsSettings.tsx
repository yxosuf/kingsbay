import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Eye, User, Trash2, RotateCcw, Users, UserCheck, Archive, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { cn } from '@/lib/utils';

interface Guest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  property_id: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  bookings: { id: string; status: string; property_id: string | null }[];
}

type GuestFilter = 'active' | 'archived' | 'deleted' | 'all';

const filterConfig: Record<GuestFilter, { label: string; icon: React.ElementType; color: string }> = {
  active: { label: 'Active', icon: UserCheck, color: 'text-success' },
  archived: { label: 'Archived', icon: Archive, color: 'text-warning' },
  deleted: { label: 'Deleted', icon: UserX, color: 'text-destructive' },
  all: { label: 'All', icon: Users, color: 'text-muted-foreground' },
};

export function GuestsSettings() {
  const navigate = useNavigate();
  const { selectedProperty, showAllProperties } = useProperty();
  const { isAdmin, canWrite } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('active');
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchGuests();
  }, [selectedProperty, showAllProperties, filter]);

  const fetchGuests = async () => {
    try {
      let query = supabase
        .from('guests')
        .select(`
          id, name, phone, email, created_at, property_id, archived_at, deleted_at,
          bookings (id, status, property_id)
        `)
        .order('created_at', { ascending: false });

      switch (filter) {
        case 'active':
          query = query.is('deleted_at', null).is('archived_at', null);
          break;
        case 'archived':
          query = query.is('deleted_at', null).not('archived_at', 'is', null);
          break;
        case 'deleted':
          query = query.not('deleted_at', 'is', null);
          break;
        case 'all':
          break;
      }

      if (!showAllProperties && selectedProperty?.id) {
        query = query.eq('property_id', selectedProperty.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const filteredData = (data || []).map(guest => ({
        ...guest,
        archived_at: (guest as any).archived_at || null,
        deleted_at: (guest as any).deleted_at || null,
        bookings: !showAllProperties && selectedProperty?.id
          ? guest.bookings?.filter(b => b.property_id === selectedProperty.id) || []
          : guest.bookings || []
      }));

      setGuests(filteredData as Guest[]);
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast.error('Failed to load guests');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGuest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('guests')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast.success(`Guest "${deleteTarget.name}" archived`);
      setDeleteTarget(null);
      fetchGuests();
    } catch (error: any) {
      console.error('Error archiving guest:', error);
      toast.error('Failed to archive guest');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (guest: Guest) => {
    try {
      const { error } = await supabase
        .from('guests')
        .update({ archived_at: null, deleted_at: null } as any)
        .eq('id', guest.id);

      if (error) throw error;
      toast.success(`Guest "${guest.name}" restored`);
      fetchGuests();
    } catch (error) {
      console.error('Error restoring guest:', error);
      toast.error('Failed to restore guest');
    }
  };

  const getActiveBooking = (guest: Guest) =>
    guest.bookings?.find((b) => b.status === 'checked_in');

  const filteredGuests = guests.filter(
    (guest) =>
      guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.phone?.includes(searchTerm) ||
      guest.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGuestStatusBadge = (guest: Guest) => {
    if (guest.deleted_at) return <Badge variant="destructive">Deleted</Badge>;
    if (guest.archived_at) return <Badge variant="warning">Archived</Badge>;
    const active = getActiveBooking(guest);
    if (active) return <Badge variant="success">Checked In</Badge>;
    return <Badge variant="secondary">Active</Badge>;
  };

  const currentFilter = filterConfig[filter];
  const FilterIcon = currentFilter.icon;

  return (
    <>
      <div className="space-y-5">
        {/* Header with property badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Guest Management</h3>
              <p className="text-sm text-muted-foreground">View and manage guest records</p>
            </div>
          </div>
          <PropertyBadge />
        </div>

        {/* Filter summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(filterConfig) as [GuestFilter, typeof filterConfig['active']][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-md",
                  isActive ? "bg-primary/15" : "bg-muted"
                )}>
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : cfg.color)} />
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Guest list */}
        <Card className="border-border/60">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FilterIcon className={cn("h-4 w-4", currentFilter.color)} />
                {currentFilter.label} Guests
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {filteredGuests.length} result{filteredGuests.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredGuests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 opacity-40" />
                </div>
                <p className="font-medium">No guests found</p>
                <p className="text-sm mt-1">Try adjusting your search or filter</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredGuests.map((guest) => (
                  <Card key={guest.id} className="border-border/50 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{guest.name}</p>
                            <p className="text-sm text-muted-foreground">{guest.phone || 'No phone'}</p>
                          </div>
                          {getGuestStatusBadge(guest)}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <p className="text-sm text-muted-foreground">
                            {guest.bookings?.length || 0} booking{guest.bookings?.length !== 1 ? 's' : ''}
                          </p>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/guests/${guest.id}`)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {isAdmin && (guest.archived_at || guest.deleted_at) && (
                              <Button variant="outline" size="sm" onClick={() => handleRestore(guest)}>
                                <RotateCcw className="h-4 w-4 mr-1" /> Restore
                              </Button>
                            )}
                            {isAdmin && !guest.deleted_at && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(guest)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Total Bookings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuests.map((guest) => (
                    <TableRow key={guest.id} className="group">
                      <TableCell className="font-medium">{guest.name}</TableCell>
                      <TableCell>
                        <div>
                          <p>{guest.phone || 'No phone'}</p>
                          <p className="text-sm text-muted-foreground">{guest.email || 'No email'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {guest.bookings?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>{getGuestStatusBadge(guest)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/guests/${guest.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && (guest.archived_at || guest.deleted_at) && (
                            <Button variant="ghost" size="icon" onClick={() => handleRestore(guest)}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && !guest.deleted_at && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget(guest)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Guest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{deleteTarget?.name}</strong>?
              The guest will be hidden from the list but booking history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGuest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Archiving...' : 'Archive Guest'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
