import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { GuestLayout } from '@/components/guest/GuestLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, MapPin, Pencil, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { GuestPassportUpload } from '@/components/guest/GuestPassportUpload';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface GuestBooking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number | null;
  room: { room_number: string; room_type: string } | null;
  property: { name: string } | null;
}

interface GuestProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  passport_photo_path: string | null;
}

export default function GuestDashboard() {
  const { user, guestId } = useAuth();
  const [bookings, setBookings] = useState<GuestBooking[]>([]);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    if (guestId) fetchData();
  }, [guestId]);

  const fetchData = async () => {
    if (!guestId) return;
    setLoading(true);
    
    const [{ data: bookingsData }, { data: guestData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, check_in, check_out, status, total_amount, room:rooms(room_number, room_type), property:properties(name)')
        .eq('guest_id', guestId)
        .order('check_in', { ascending: false })
        .limit(50),
      supabase
        .from('guests')
        .select('id, name, email, phone, passport_photo_path')
        .eq('id', guestId)
        .single(),
    ]);

    if (bookingsData) {
      setBookings(bookingsData.map(b => ({
        ...b,
        room: Array.isArray(b.room) ? b.room[0] : b.room,
        property: Array.isArray(b.property) ? b.property[0] : b.property,
      })) as GuestBooking[]);
    }
    if (guestData) {
      setProfile(guestData);
      setEditName(guestData.name);
      setEditPhone(guestData.phone || '');
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!guestId) return;
    const { error } = await supabase
      .from('guests')
      .update({ name: editName.trim(), phone: editPhone.trim() || null })
      .eq('id', guestId);
    
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      setEditingProfile(false);
      fetchData();
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter(b => b.check_in >= today && !['cancelled', 'checked_out', 'no_show'].includes(b.status));
  const past = bookings.filter(b => b.check_in < today || ['checked_out', 'cancelled', 'no_show'].includes(b.status));

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'checked_in': return 'default';
      case 'checked_out': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'pending': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <GuestLayout title="My Dashboard">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">My Profile</CardTitle>
              {!editingProfile ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingProfile(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleSaveProfile}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingProfile ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={profile?.email || ''} disabled className="opacity-60" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{profile?.name}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{profile?.email}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{profile?.phone || '—'}</span></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Book Now CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-semibold text-foreground">Ready to book your stay?</p>
                <p className="text-sm text-muted-foreground">Browse available rooms and rates</p>
              </div>
              <Button asChild>
                <Link to="/guest/book">
                  <CalendarDays className="h-4 w-4 mr-2" /> Book Now
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Bookings */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Upcoming Bookings</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming bookings</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(b => (
                  <Link key={b.id} to={`/guest/bookings/${b.id}`}>
                    <Card className="hover:border-primary/40 transition-colors">
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium text-sm">
                              {format(parseISO(b.check_in), 'MMM d')} – {format(parseISO(b.check_out), 'MMM d, yyyy')}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {b.property && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.property.name}</span>}
                              {b.room && <span>Room {b.room.room_number} ({b.room.room_type})</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {b.total_amount && <span className="text-sm font-medium">LKR {b.total_amount.toLocaleString()}</span>}
                          <Badge variant={statusColor(b.status)}>{b.status.replace('_', ' ')}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Past Bookings */}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Booking History</h2>
              <div className="space-y-2">
                {past.map(b => (
                  <Link key={b.id} to={`/guest/bookings/${b.id}`}>
                    <Card className="opacity-80 hover:opacity-100 transition-opacity">
                      <CardContent className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm">
                            {format(parseISO(b.check_in), 'MMM d')} – {format(parseISO(b.check_out), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {b.property?.name} {b.room && `• Room ${b.room.room_number}`}
                          </p>
                        </div>
                        <Badge variant={statusColor(b.status)}>{b.status.replace('_', ' ')}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GuestLayout>
  );
}
