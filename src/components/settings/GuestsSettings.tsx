import { useState, useEffect } from 'react';
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
import { Search, Eye, User, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { PropertyBadge } from '@/components/layout/PropertyBadge';

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

      // Apply filter
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
          // No filter
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
    if (guest.archived_at) return <Badge variant="secondary">Archived</Badge>;
    const active = getActiveBooking(guest);
    if (active) return <Badge className="bg-success/20 text-success border-success">Checked In</Badge>;
    return <Badge variant="secondary">Active</Badge>;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as GuestFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">
              {filter === 'active' ? 'Active' : filter === 'archived' ? 'Archived' : filter === 'deleted' ? 'Deleted' : 'All'} Guests
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredGuests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No guests found.</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredGuests.map((guest) => (
                  <Card key={guest.id} className="border-border/50">
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
                    <TableRow key={guest.id}>
                      <TableCell className="font-medium">{guest.name}</TableCell>
                      <TableCell>
                        <div>
                          <p>{guest.phone || 'No phone'}</p>
                          <p className="text-sm text-muted-foreground">{guest.email || 'No email'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{guest.bookings?.length || 0}</TableCell>
                      <TableCell>{getGuestStatusBadge(guest)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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