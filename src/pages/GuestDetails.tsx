import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, User, Calendar, Receipt, Edit, MapPin, Phone, Mail, CreditCard, Star, Upload, FileImage, Loader2, Trash2, AlertTriangle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/formatters';
import { format, formatDistanceToNow } from 'date-fns';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { EditGuestDialog } from '@/components/guest/EditGuestDialog';
import { useAuth } from '@/hooks/useAuth';
import { useGuestFeedback } from '@/hooks/useGuestFeedback';
import { FeedbackSummary, FeedbackCard } from '@/components/feedback/FeedbackDisplay';
import { GuestCommunicationLog } from '@/components/guest/GuestCommunicationLog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface GuestDetailsData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_passport: string | null;
  address: string | null;
  nationality: string | null;
  notes: string | null;
  created_at: string;
  property_id: string | null;
  passport_photo_path: string | null;
  passport_photo_uploaded_at: string | null;
  is_vip: boolean;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  nic_number: string | null;
  passport_number: string | null;
}

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  booking_source: string;
  rooms: { room_number: string; room_type: string } | null;
}

interface GuestService {
  id: string;
  service_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  booking_id: string;
  services: { name: string; category: string } | null;
  bookings: { check_in: string; rooms: { room_number: string } | null } | null;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

async function invokePassportFunction(functionName: string, body: any, isFormData = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/${functionName}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function GuestDetails() {
  const { canWrite, isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [guest, setGuest] = useState<GuestDetailsData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allServices, setAllServices] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string | null>(null);
  const [photoDeleted, setPhotoDeleted] = useState(false);
  const [photoPurgeDate, setPhotoPurgeDate] = useState<string | null>(null);
  const { feedback: guestFeedback, averageRating, loading: feedbackLoading } = useGuestFeedback({
    guestId: id,
  });

  useEffect(() => {
    if (id) {
      fetchGuestDetails();
      fetchBookings();
    }
  }, [id]);

  useEffect(() => {
    if (bookings.length > 0) {
      fetchAllGuestServices();
    }
  }, [bookings]);

  const fetchGuestDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGuest(data);

      // Fetch passport photo via secure edge function
      if (data?.passport_photo_path) {
        try {
          const result = await invokePassportFunction('passport-view', { guest_id: id });
          if (result.deleted) {
            setPhotoDeleted(true);
            setPhotoPurgeDate(result.purge_date);
            setPassportPhotoUrl(null);
          } else {
            setPassportPhotoUrl(result.signed_url);
            setPhotoDeleted(false);
            setPhotoPurgeDate(null);
          }
        } catch {
          setPassportPhotoUrl(null);
        }
      } else {
        setPassportPhotoUrl(null);
        setPhotoDeleted(false);
        setPhotoPurgeDate(null);
      }
    } catch (error) {
      logError('Error fetching guest', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          status,
          total_amount,
          booking_source,
          rooms (room_number, room_type)
        `)
        .eq('guest_id', id)
        .order('check_in', { ascending: false });

      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load guest bookings');
    }
  };

  const fetchAllGuestServices = async () => {
    try {
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length === 0) return;

      const { data } = await supabase
        .from('guest_services')
        .select(`
          id,
          service_date,
          quantity,
          unit_price,
          total_price,
          booking_id,
          services (name, category),
          bookings (check_in, rooms (room_number))
        `)
        .in('booking_id', bookingIds)
        .order('service_date', { ascending: false });

      setAllServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load guest services');
    }
  };

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !guest) return;

    // Client-side pre-check (server validates too)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPEG and PNG files are allowed.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('guest_id', guest.id);
      if (guest.property_id) formData.append('property_id', guest.property_id);

      const result = await invokePassportFunction('passport-upload', formData, true);

      if (result.signed_url) {
        setPassportPhotoUrl(result.signed_url);
        setPhotoDeleted(false);
        setPhotoPurgeDate(null);
      }
      toast.success('Passport photo uploaded securely');
      fetchGuestDetails();
    } catch (error: any) {
      logError('Error uploading passport photo', error);
      toast.error(error.message || 'Failed to upload passport photo');
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handlePassportDelete = async () => {
    if (!guest) return;
    setDeletingPhoto(true);
    try {
      const result = await invokePassportFunction('passport-delete', { guest_id: guest.id });
      setPassportPhotoUrl(null);
      setPhotoDeleted(true);
      setPhotoPurgeDate(result.purge_date);
      toast.success('Passport photo marked for deletion. Will be purged after 3 months.');
      fetchGuestDetails();
    } catch (error: any) {
      logError('Error deleting passport photo', error);
      toast.error(error.message || 'Failed to delete passport photo');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-warning/20 text-warning border-warning',
      confirmed: 'bg-info/20 text-info border-info',
      checked_in: 'bg-success/20 text-success border-success',
      checked_out: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive/20 text-destructive border-destructive',
    };

    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const activeBooking = bookings.find((b) => b.status === 'checked_in');
  const totalServicesValue = allServices.reduce((sum, s) => sum + Number(s.total_price), 0);
  const totalBookingsValue = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);

  const servicesByCategory = allServices.reduce((acc, service) => {
    const category = service.services?.category || 'other';
    if (!acc[category]) {
      acc[category] = { count: 0, total: 0 };
    }
    acc[category].count += service.quantity;
    acc[category].total += Number(service.total_price);
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const categoryLabels: Record<string, string> = {
    room_service: 'Room Service',
    transport: 'Transport',
    facilities: 'Facilities',
    special_request: 'Special Requests',
  };

  if (loading) {
    return (
      <DashboardLayout title="Guest Details">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!guest) {
    return (
      <DashboardLayout title="Guest Details">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Guest not found</p>
          <Button variant="link" onClick={() => navigate('/guests')}>
            Return to guests
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Guest Details">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/settings?tab=guests')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Guests
          </Button>
          {canWrite && (
            <Button variant="outline" onClick={() => setShowEditDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Guest
            </Button>
          )}
        </div>

        {/* Guest Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-4 rounded-xl bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{guest.name}</CardTitle>
              <p className="text-muted-foreground">
                Guest since {format(new Date(guest.created_at), 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {guest.is_vip && (
                <Badge className="bg-warning/20 text-warning border-warning">⭐ VIP</Badge>
              )}
              {guest.is_blacklisted && (
                <Badge variant="destructive">🚫 Blacklisted</Badge>
              )}
              {activeBooking && (
                <Badge className="bg-success/20 text-success border-success">
                  Currently Checked In
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone / WhatsApp</p>
                  <p className="font-medium">{guest.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{guest.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">ID / Passport</p>
                  <p className="font-medium">{guest.id_passport || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nationality</p>
                  <p className="font-medium">{guest.nationality || 'Not provided'}</p>
                </div>
              </div>
            </div>
            
            {(guest.address || guest.notes) && (
              <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                {guest.address && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-medium">{guest.address}</p>
                  </div>
                )}
                {guest.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-muted-foreground">{guest.notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Passport / ID Document */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileImage className="h-5 w-5" />
              Passport / ID Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {photoDeleted ? (
                <div className="w-48 h-32 rounded-lg border-2 border-dashed border-destructive/30 flex items-center justify-center bg-destructive/5">
                  <div className="text-center text-destructive">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-1 opacity-60" />
                    <p className="text-xs font-medium">Photo Deleted</p>
                    {photoPurgeDate && (
                      <p className="text-[10px] mt-1 text-muted-foreground">
                        Purges {formatDistanceToNow(new Date(photoPurgeDate), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              ) : passportPhotoUrl ? (
                <div className="relative group">
                  <img
                    src={passportPhotoUrl}
                    alt="Passport photo"
                    className="w-48 h-32 object-cover rounded-lg border"
                  />
                  {guest.passport_photo_uploaded_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploaded {format(new Date(guest.passport_photo_uploaded_at), 'PP')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-48 h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileImage className="h-8 w-8 mx-auto mb-1 opacity-40" />
                    <p className="text-xs">No photo</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 flex-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Passport #</p>
                    <p className="font-medium">{guest.passport_number || guest.id_passport || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NIC #</p>
                    <p className="font-medium">{guest.nic_number || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {canWrite && !photoDeleted && (
                    <div>
                      <label htmlFor="passport-upload">
                        <Button variant="outline" size="sm" asChild disabled={uploadingPhoto}>
                          <span className="cursor-pointer">
                            {uploadingPhoto ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {passportPhotoUrl ? 'Replace Photo' : 'Upload Photo'}
                          </span>
                        </Button>
                      </label>
                      <input
                        id="passport-upload"
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={handlePassportUpload}
                      />
                    </div>
                  )}

                  {isAdmin && passportPhotoUrl && !photoDeleted && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={deletingPhoto}>
                          {deletingPhoto ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete Photo
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Passport Photo</AlertDialogTitle>
                          <AlertDialogDescription>
                            The photo will be soft-deleted and retained for 3 months before permanent purge. 
                            During this period, the photo will not be visible but can be recovered by support if needed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePassportDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {!photoDeleted && (
                  <p className="text-xs text-muted-foreground">
                    Max 5MB. JPEG/PNG only. Stored securely via encrypted storage.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Calendar className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{bookings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CreditCard className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Room Charges</p>
                  <p className="text-2xl font-bold">{formatLKR(totalBookingsValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Receipt className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Services</p>
                  <p className="text-2xl font-bold">{formatLKR(totalServicesValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bookings">
          <TabsList className="w-full flex">
            <TabsTrigger value="bookings" className="flex-1 text-xs sm:text-sm">Bookings</TabsTrigger>
            <TabsTrigger value="services" className="flex-1 text-xs sm:text-sm">Services</TabsTrigger>
            <TabsTrigger value="feedback" className="flex-1 flex items-center justify-center gap-1 text-xs sm:text-sm">
              <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Feedback
              {guestFeedback.length > 0 && (
                <span className="text-[10px] sm:text-xs bg-warning/20 text-warning px-1 sm:px-1.5 py-0.5 rounded-full">
                  {guestFeedback.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="communications" className="flex-1 text-xs sm:text-sm">
              <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
              Comms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Booking History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No bookings found
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">Room {booking.rooms?.room_number}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {booking.rooms?.room_type}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(booking.check_in), 'PP')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(booking.check_out), 'PP')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {booking.booking_source.replace('_', '.')}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell>{formatLKR(booking.total_amount)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="mt-6 space-y-6">
            {Object.keys(servicesByCategory).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Services Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(servicesByCategory).map(([category, data]) => (
                      <div key={category} className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {categoryLabels[category] || category}
                        </p>
                        <p className="text-xl font-bold">{formatLKR(data.total)}</p>
                        <p className="text-sm text-muted-foreground">{data.count} items</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  All Services (All Stays)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allServices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No services purchased yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Stay</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allServices.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{service.services?.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {categoryLabels[service.services?.category || ''] || service.services?.category}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(service.service_date), 'PP')}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>Room {service.bookings?.rooms?.room_number}</p>
                              <p className="text-muted-foreground">
                                {service.bookings?.check_in
                                  ? format(new Date(service.bookings.check_in), 'MMM d, yyyy')
                                  : '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{service.quantity}</TableCell>
                          <TableCell>{formatLKR(Number(service.unit_price))}</TableCell>
                          <TableCell className="font-medium">
                            {formatLKR(Number(service.total_price))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback" className="mt-6 space-y-4">
            <FeedbackSummary feedback={guestFeedback} averageRating={averageRating} />
            {guestFeedback.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No feedback recorded yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Feedback can be added from the booking details page after checkout
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {guestFeedback.map((fb) => (
                  <FeedbackCard key={fb.id} feedback={fb} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="communications" className="mt-6">
            <GuestCommunicationLog guestId={id!} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Guest Dialog */}
      <EditGuestDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        guest={guest}
        onSuccess={fetchGuestDetails}
      />
    </DashboardLayout>
  );
}
