import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
import { Search, Eye, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Guest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  bookings: { id: string; status: string }[];
}

export default function Guests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const filterActive = searchParams.get('filter') === 'active';

  useEffect(() => {
    fetchGuests();
  }, []);

  const fetchGuests = async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select(`
          id,
          name,
          phone,
          email,
          created_at,
          bookings (id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast.error('Failed to load guests');
    } finally {
      setLoading(false);
    }
  };

  const getActiveBooking = (guest: Guest) => {
    return guest.bookings?.find((b) => b.status === 'checked_in');
  };

  let filteredGuests = guests.filter(
    (guest) =>
      guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.phone?.includes(searchTerm) ||
      guest.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filterActive) {
    filteredGuests = filteredGuests.filter((g) => getActiveBooking(g));
  }

  return (
    <DashboardLayout title="Guests">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {filterActive && (
            <Badge variant="secondary" className="self-start">
              Showing checked-in guests only
            </Badge>
          )}
        </div>

        {/* Guests Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Guests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredGuests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No guests found.</p>
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
                  {filteredGuests.map((guest) => {
                    const activeBooking = getActiveBooking(guest);
                    return (
                      <TableRow key={guest.id}>
                        <TableCell className="font-medium">{guest.name}</TableCell>
                        <TableCell>
                          <div>
                            <p>{guest.phone || 'No phone'}</p>
                            <p className="text-sm text-muted-foreground">
                              {guest.email || 'No email'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{guest.bookings?.length || 0}</TableCell>
                        <TableCell>
                          {activeBooking ? (
                            <Badge className="bg-success/20 text-success border-success">
                              Checked In
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Staying</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/guests/${guest.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
