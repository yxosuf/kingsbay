import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, Plus, User } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { ServiceSelector, SelectedService } from '@/components/booking/ServiceSelector';
import { checkRoomAvailability } from '@/lib/availabilityCheck';
import { countries, getDialCodeByCountry } from '@/lib/countryData';
import { postBookingConfirmed, postPayment } from '@/lib/ledgerUtils';
import { AlertTriangle } from 'lucide-react';

const bookingSchema = z.object({
  guestName: z.string().trim().min(2, 'Guest name is required'),
  guestPhone: z.string().trim().min(5, 'Phone number is required'),
  guestEmail: z.string().email().optional().or(z.literal('')),
  roomId: z.string().min(1, 'Please select a room'),
  checkIn: z.date({ required_error: 'Check-in date is required' }),
  checkOut: z.date({ required_error: 'Check-out date is required' }),
  numGuests: z.number().min(1, 'At least 1 guest required'),
});

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
  max_guests: number;
}

interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export default function NewBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingGuests, setExistingGuests] = useState<Guest[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);

  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestIdPassport, setGuestIdPassport] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [numAdults, setNumAdults] = useState(1);
  const [numChildren, setNumChildren] = useState(0);
  const numGuests = numAdults + numChildren;
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [guestNationality, setGuestNationality] = useState('Sri Lanka');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+94');

  // Additional services state
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);

  // OTA pricing state
  const [bookingSource, setBookingSource] = useState<string>('direct');
  const [otaPrice, setOtaPrice] = useState<string>('');
  const [commissionRate, setCommissionRate] = useState<string>('');
  const [otaReference, setOtaReference] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customTotalAmount, setCustomTotalAmount] = useState<string>('');

  const OTA_COMMISSION_RATES: Record<string, number> = {
    booking_com: 15,
    airbnb: 3,
    agoda: 18,
    expedia: 20,
    other_ota: 15,
  };

  useEffect(() => {
    fetchAvailableRooms();
    fetchExistingGuests();
  }, [checkIn, checkOut, selectedProperty]);

  const fetchAvailableRooms = async () => {
    try {
      let query = supabase.from('rooms').select('*').eq('status', 'available');
      if (selectedProperty?.id) {
        query = query.eq('property_id', selectedProperty.id);
      }
      const { data } = await query;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchExistingGuests = async () => {
    try {
      const { data } = await supabase
        .from('guests')
        .select('id, name, phone, email')
        .order('name');
      setExistingGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    }
  };

  const handleSelectGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setGuestName(guest.name);
    setGuestPhone(guest.phone || '');
    setGuestEmail(guest.email || '');
    setShowGuestSearch(false);
    setGuestSearch('');
  };

  const calculateSystemTotal = () => {
    if (!checkIn || !checkOut || !roomId) return 0;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return 0;
    const nights = differenceInDays(checkOut, checkIn);
    return room.price * Math.max(nights, 1);
  };

  const calculateServicesTotal = () => {
    return selectedServices.reduce((sum, s) => sum + s.totalPrice, 0);
  };

  const calculateCommission = () => {
    const rate = parseFloat(commissionRate) || OTA_COMMISSION_RATES[bookingSource] || 0;
    const price = useCustomPrice ? parseFloat(customTotalAmount) || 0 : calculateSystemTotal();
    return (price * rate) / 100;
  };

  const getEffectiveTotal = () => {
    if (useCustomPrice && customTotalAmount) {
      return parseFloat(customTotalAmount) || 0;
    }
    return calculateSystemTotal();
  };

  const getGrandTotal = () => {
    return getEffectiveTotal() + calculateServicesTotal();
  };

  const getOtaNetPrice = () => {
    if (bookingSource === 'direct') return null;
    const total = getEffectiveTotal();
    const commission = calculateCommission();
    return total - commission;
  };

  // Auto-set commission rate when booking source changes
  useEffect(() => {
    if (bookingSource !== 'direct' && OTA_COMMISSION_RATES[bookingSource]) {
      setCommissionRate(OTA_COMMISSION_RATES[bookingSource].toString());
    } else if (bookingSource === 'direct') {
      setCommissionRate('');
      setOtaPrice('');
      setOtaReference('');
    }
  }, [bookingSource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = bookingSchema.safeParse({
      guestName,
      guestPhone,
      guestEmail: guestEmail || undefined,
      roomId,
      checkIn,
      checkOut,
      numGuests,
    });

    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    if (checkOut && checkIn && checkOut <= checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }

    setLoading(true);

    try {
      // CONFLICT DETECTION: Check room availability before booking
      const availability = await checkRoomAvailability(roomId, checkIn!, checkOut!);
      
      if (!availability.isAvailable) {
        const conflicts = [];
        
        if (availability.conflictingBookings.length > 0) {
          const bookingConflicts = availability.conflictingBookings.map(b => 
            `${b.guestName} (${b.checkIn} to ${b.checkOut})`
          ).join(', ');
          conflicts.push(`Existing bookings: ${bookingConflicts}`);
        }
        
        if (availability.blockedDates.length > 0) {
          const blockedList = availability.blockedDates.map(b => 
            `${b.date} (${b.reason})`
          ).join(', ');
          conflicts.push(`Blocked dates: ${blockedList}`);
        }
        
        toast.error(`Room is not available. ${conflicts.join('. ')}`);
        setLoading(false);
        return;
      }

      let guestId = selectedGuest?.id;

      // Create new guest if not selected from existing
      if (!guestId) {
        const fullPhone = `${phoneCountryCode} ${guestPhone.trim()}`.trim();
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert({
            name: guestName.trim(),
            phone: fullPhone,
            email: guestEmail.trim() || null,
            id_passport: guestIdPassport.trim() || null,
            nationality: guestNationality || null,
            country: guestNationality || 'Sri Lanka',
            property_id: selectedProperty?.id || null,
          })
          .select()
          .single();

        if (guestError) throw guestError;
        guestId = newGuest.id;
      }

      // Calculate OTA values
      const effectiveTotal = getEffectiveTotal();
      const commissionAmt = bookingSource !== 'direct' ? calculateCommission() : null;
      const netOtaPrice = bookingSource !== 'direct' ? getOtaNetPrice() : null;

      // Validate property is selected before creating booking
      if (!selectedProperty?.id) {
        toast.error('Property mismatch: Please select a property before creating a booking.');
        setLoading(false);
        return;
      }

      // Create booking
      const { data: newBooking, error: bookingError } = await supabase.from('bookings').insert({
        guest_id: guestId,
        room_id: roomId,
        check_in: format(checkIn!, 'yyyy-MM-dd'),
        check_out: format(checkOut!, 'yyyy-MM-dd'),
        num_guests: numGuests,
        num_adults: numAdults,
        num_children: numChildren,
        status: 'confirmed' as const,
        special_requests: specialRequests.trim() || null,
        total_amount: effectiveTotal,
        created_by: user?.id,
        booking_source: bookingSource as any,
        ota_price: netOtaPrice,
        commission_rate: bookingSource !== 'direct' ? parseFloat(commissionRate) || null : null,
        commission_amount: commissionAmt,
        ota_reference: bookingSource !== 'direct' ? otaReference.trim() || null : null,
        property_id: selectedProperty.id,
      } as any).select().single();

      if (bookingError) throw bookingError;

      // Add selected services to guest_services
      if (selectedServices.length > 0 && newBooking) {
        const serviceInserts = selectedServices.map((service) => ({
          booking_id: newBooking.id,
          service_id: service.serviceId,
          quantity: service.quantity,
          unit_price: service.unitPrice,
          total_price: service.totalPrice,
          service_date: format(checkIn!, 'yyyy-MM-dd'),
          created_by: user?.id,
          property_id: selectedProperty?.id || null,
        }));

        const { error: servicesError } = await supabase
          .from('guest_services')
          .insert(serviceInserts);

        if (servicesError) {
          console.error('Error adding services:', servicesError);
          // Don't fail the whole booking, just warn
          toast.warning('Booking created but some services could not be added');
        }
      }

      // Update room status to reserved
      await supabase.from('rooms').update({ status: 'reserved' }).eq('id', roomId);

      // Airbnb auto-pay: create invoice + payment transaction + mark as paid
      if (bookingSource === 'airbnb' && newBooking && selectedProperty?.id) {
        const serviceChargesTotal = calculateServicesTotal();
        const taxRate = 0.1;
        const taxAmt = (effectiveTotal + serviceChargesTotal) * taxRate;
        const invoiceTotal = effectiveTotal + serviceChargesTotal + taxAmt;

        // Create invoice
        const { data: invoice } = await supabase
          .from('invoices')
          .insert({
            invoice_number: `INV-${Date.now()}`,
            booking_id: newBooking.id,
            room_charges: effectiveTotal,
            service_charges: serviceChargesTotal,
            tax_amount: taxAmt,
            total_amount: invoiceTotal,
            payment_status: 'paid' as const,
            created_by: user?.id,
            property_id: selectedProperty.id,
          })
          .select('id')
          .single();

        // Create payment transaction
        if (invoice) {
          const { data: txn } = await supabase
            .from('booking_transactions')
            .insert({
              booking_id: newBooking.id,
              transaction_type: 'payment' as any,
              amount: invoiceTotal,
              currency: 'LKR',
              method: 'online' as any,
              notes: 'Airbnb prepaid',
              created_by: user?.id,
              property_id: selectedProperty.id,
            })
            .select('id')
            .single();

          // Create payment record
          await supabase.from('payments').insert({
            invoice_id: invoice.id,
            amount: invoiceTotal,
            method: 'online' as any,
            notes: 'Airbnb prepaid',
            property_id: selectedProperty.id,
            received_by: user?.id,
          });

          // Post ledger entries
          if (txn) {
            await postBookingConfirmed(newBooking.id, effectiveTotal, serviceChargesTotal, taxAmt, selectedProperty.id, user?.id);
            await postPayment(txn.id, invoiceTotal, 'online', selectedProperty.id, newBooking.id, user?.id);
          }
        }
      }

      toast.success('Booking created successfully!');
      navigate('/bookings');
    } catch (error: any) {
      logError('Error creating booking', error);
      
      // Check for overlap error from DB trigger
      if (error.message?.includes('already booked')) {
        toast.error('Room is already booked for these dates. Please choose different dates or another room.');
      } else {
        toast.error(getSafeErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredGuests = existingGuests.filter(
    (g) =>
      g.name.toLowerCase().includes(guestSearch.toLowerCase()) ||
      g.phone?.includes(guestSearch)
  );

  const selectedRoom = rooms.find((r) => r.id === roomId);

  return (
    <DashboardLayout title="New Booking">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Guest Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <span className="text-lg">Guest Information</span>
                  <p className="text-sm text-muted-foreground font-normal mt-0.5">Search existing or create a new guest</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search existing guest */}
              <div className="relative">
                <Label>Search Existing Guest</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={guestSearch}
                    onChange={(e) => {
                      setGuestSearch(e.target.value);
                      setShowGuestSearch(true);
                    }}
                    onFocus={() => setShowGuestSearch(true)}
                    className="pl-10"
                  />
                </div>
                {showGuestSearch && guestSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredGuests.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        No guests found. Fill in details below to create new.
                      </div>
                    ) : (
                      filteredGuests.map((guest) => (
                        <button
                          key={guest.id}
                          type="button"
                          onClick={() => handleSelectGuest(guest)}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex justify-between items-center"
                        >
                          <span className="font-medium">{guest.name}</span>
                          <span className="text-sm text-muted-foreground">{guest.phone}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedGuest && (
                <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedGuest.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedGuest.phone}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedGuest(null);
                      setGuestName('');
                      setGuestPhone('');
                      setGuestEmail('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}

              {!selectedGuest && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">Full Name *</Label>
                    <Input
                      id="guestName"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestNationality">Nationality / Country</Label>
                    <Select 
                      value={guestNationality} 
                      onValueChange={(v) => {
                        setGuestNationality(v);
                        const dialCode = getDialCodeByCountry(v);
                        setPhoneCountryCode(dialCode);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.name}>
                            {c.name} ({c.dialCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestPhone">Phone *</Label>
                    <div className="flex gap-2">
                      <Input
                        className="w-20 shrink-0"
                        value={phoneCountryCode}
                        onChange={(e) => setPhoneCountryCode(e.target.value)}
                        placeholder="+94"
                      />
                      <Input
                        id="guestPhone"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="77 123 4567"
                        required
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestEmail">Email</Label>
                    <Input
                      id="guestEmail"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestIdPassport">ID / Passport</Label>
                    <Input
                      id="guestIdPassport"
                      value={guestIdPassport}
                      onChange={(e) => setGuestIdPassport(e.target.value)}
                      placeholder="Passport number"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Booking Details */}
          <Card className="step-connector">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <span className="text-lg">Stay Details</span>
                  <p className="text-sm text-muted-foreground font-normal mt-0.5">
                    Dates, room, and pricing
                    {checkIn && checkOut && (
                      <span className="ml-2 text-primary font-medium">
                        · {differenceInDays(checkOut, checkIn)} night{differenceInDays(checkOut, checkIn) !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check-in Date */}
                <div className="space-y-2">
                  <Label>Check-in Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !checkIn && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkIn ? format(checkIn, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={checkIn}
                        onSelect={setCheckIn}
                        disabled={(date) => date < startOfDay(new Date())}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check-out Date */}
                <div className="space-y-2">
                  <Label>Check-out Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !checkOut && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkOut ? format(checkOut, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={checkOut}
                        onSelect={setCheckOut}
                        disabled={(date) => date <= (checkIn || startOfDay(new Date()))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Room Selection */}
                <div className="space-y-2">
                  <Label>Select Room *</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select available room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No rooms available
                        </SelectItem>
                      ) : (
                        rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} - {room.room_type} (Rs.{' '}
                            {room.price.toLocaleString()}/night)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Number of Guests */}
                <div className="space-y-2">
                  <Label>Number of Guests</Label>
                  <Select
                    value={numGuests.toString()}
                    onValueChange={(v) => setNumGuests(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} {n === 1 ? 'guest' : 'guests'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Booking Source */}
                <div className="space-y-2">
                  <Label>Booking Source *</Label>
                  <Select value={bookingSource} onValueChange={setBookingSource}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct Booking</SelectItem>
                      <SelectItem value="booking_com">Booking.com</SelectItem>
                      <SelectItem value="airbnb">Airbnb</SelectItem>
                      <SelectItem value="agoda">Agoda</SelectItem>
                      <SelectItem value="expedia">Expedia</SelectItem>
                      <SelectItem value="other_ota">Other OTA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="online">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* OTA Pricing Section */}
              {bookingSource !== 'direct' && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border space-y-4">
                  <h4 className="font-medium text-sm">OTA Pricing Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="otaReference">OTA Booking Reference</Label>
                      <Input
                        id="otaReference"
                        value={otaReference}
                        onChange={(e) => setOtaReference(e.target.value)}
                        placeholder="e.g., BK-12345678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                      <Input
                        id="commissionRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        placeholder="15"
                      />
                    </div>
                  </div>

                  {/* Manual Price Override */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useCustomPrice"
                      checked={useCustomPrice}
                      onChange={(e) => setUseCustomPrice(e.target.checked)}
                      className="rounded border-input"
                    />
                    <Label htmlFor="useCustomPrice" className="text-sm font-normal cursor-pointer">
                      Override calculated price (use OTA price)
                    </Label>
                  </div>

                  {useCustomPrice && (
                    <div className="space-y-2">
                      <Label htmlFor="customTotalAmount">Custom Total Amount (Rs.)</Label>
                      <Input
                        id="customTotalAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={customTotalAmount}
                        onChange={(e) => setCustomTotalAmount(e.target.value)}
                        placeholder="Enter the actual OTA booking price"
                      />
                    </div>
                  )}

                  {/* Commission Summary */}
                  {(commissionRate || OTA_COMMISSION_RATES[bookingSource]) && (
                    <div className="pt-3 border-t space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross Amount:</span>
                        <span>Rs. {getEffectiveTotal().toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Commission ({commissionRate || OTA_COMMISSION_RATES[bookingSource]}%):</span>
                        <span>- Rs. {calculateCommission().toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>Net Revenue:</span>
                        <span className="text-success">Rs. {getOtaNetPrice()?.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Special Requests */}
              <div className="space-y-2">
                <Label>Special Requests</Label>
                <Textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements or notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Services */}
          <ServiceSelector
            selectedServices={selectedServices}
            onServicesChange={setSelectedServices}
          />

          {/* Sticky Summary Footer */}
          <Card className="sticky bottom-4 z-20 shadow-lg border-primary/20 step-connector">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">4</div>
                  <div>
                    {selectedRoom && checkIn && checkOut ? (
                      <div className="space-y-0.5">
                        <p className="text-sm text-muted-foreground">
                          Room {selectedRoom.room_number} × {differenceInDays(checkOut, checkIn)} nights
                          {selectedServices.length > 0 && ` + ${selectedServices.length} service${selectedServices.length > 1 ? 's' : ''}`}
                        </p>
                        <p className="text-2xl font-bold">
                          Rs. {getGrandTotal().toLocaleString()}
                        </p>
                        {bookingSource !== 'direct' && getOtaNetPrice() !== null && (
                          <p className="text-xs text-success">Net: Rs. {getOtaNetPrice()?.toLocaleString()}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Complete the form to see total</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button type="button" variant="outline" onClick={() => navigate('/bookings')} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                    {loading ? 'Creating...' : 'Create Booking'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
