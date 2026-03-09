import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Search, Plus, User, AlertTriangle, UserPlus } from 'lucide-react';
import { format, differenceInDays, startOfDay, eachDayOfInterval, addMonths } from 'date-fns';
import { parseLocalDate, toDateString } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { sendGuestEmail } from '@/lib/guestEmail';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { ServiceSelector, SelectedService } from '@/components/booking/ServiceSelector';
import { checkRoomAvailability } from '@/lib/availabilityCheck';
import { countries, getDialCodeByCountry } from '@/lib/countryData';
import { postBookingConfirmed, postPayment } from '@/lib/ledgerUtils';
import { calculateStayTotal, getActiveRatePlans, type StayTotal } from '@/lib/rateEngine';


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
  const [searchParams] = useSearchParams();
  const isWalkIn = searchParams.get('walkin') === 'true';
  const { user } = useAuth();
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingGuests, setExistingGuests] = useState<Guest[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [debouncedGuestSearch, setDebouncedGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Walk-in: check-in immediately toggle
  const [checkInImmediately, setCheckInImmediately] = useState(isWalkIn);

  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestIdPassport, setGuestIdPassport] = useState('');
  const [roomId, setRoomId] = useState('');

  // Walk-in defaults: today check-in, tomorrow check-out
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [checkIn, setCheckIn] = useState<Date | undefined>(isWalkIn ? today : undefined);
  const [checkOut, setCheckOut] = useState<Date | undefined>(isWalkIn ? tomorrow : undefined);
  const [numAdults, setNumAdults] = useState(1);
  const [numChildren, setNumChildren] = useState(0);
  const numGuests = numAdults + numChildren;
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [guestNationality, setGuestNationality] = useState('Sri Lanka');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+94');

  // Additional services state
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);

  // Rate management state
  const [ratePlans, setRatePlans] = useState<any[]>([]);
  const [selectedRatePlanId, setSelectedRatePlanId] = useState<string>('');
  const [stayBreakdown, setStayBreakdown] = useState<StayTotal | null>(null);
  const [calculatingRate, setCalculatingRate] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discountError, setDiscountError] = useState('');

  // Booked dates for calendar indicators
  const [bookedDateSet, setBookedDateSet] = useState<Set<string>>(new Set());

  // OTA pricing state
  const [bookingSource, setBookingSource] = useState<string>(isWalkIn ? 'direct' : 'direct');
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

  // Fetch rate plans
  useEffect(() => {
    if (!selectedProperty?.id) return;
    getActiveRatePlans(selectedProperty.id).then(setRatePlans);
  }, [selectedProperty?.id]);

  // Calculate rate breakdown when inputs change
  useEffect(() => {
    if (!selectedProperty?.id || !checkIn || !checkOut || !roomId) {
      setStayBreakdown(null);
      return;
    }
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    setCalculatingRate(true);
    setDiscountError('');
    calculateStayTotal(
      selectedProperty.id,
      room.room_type,
      room.price,
      format(checkIn, 'yyyy-MM-dd'),
      format(checkOut, 'yyyy-MM-dd'),
      selectedRatePlanId || null,
      numGuests,
      discountCode.trim() || null,
    ).then(breakdown => {
      setStayBreakdown(breakdown);
      if (discountCode.trim() && !breakdown.discountCode) {
        setDiscountError('Invalid or expired discount code');
      }
      setCalculatingRate(false);
    }).catch(() => setCalculatingRate(false));
  }, [selectedProperty?.id, checkIn, checkOut, roomId, selectedRatePlanId, numGuests, rooms, discountCode]);

  // Fetch booked dates for calendar indicators
  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!selectedProperty?.id) return;
      const rangeStart = format(new Date(), 'yyyy-MM-dd');
      const rangeEnd = format(addMonths(new Date(), 6), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('property_id', selectedProperty.id)
        .in('status', ['confirmed', 'checked_in', 'pending', 'needs_review'])
        .lt('check_in', rangeEnd)
        .gt('check_out', rangeStart);

      const dates = new Set<string>();
      (data || []).forEach(b => {
        const start = parseLocalDate(b.check_in);
        const end = parseLocalDate(b.check_out);
        // Block [check_in, check_out) 
        const days = eachDayOfInterval({ start, end: new Date(end.getTime() - 86400000) });
        days.forEach(d => dates.add(toDateString(d)));
      });
      setBookedDateSet(dates);
    };
    fetchBookedDates();
  }, [selectedProperty?.id]);

  const fetchAvailableRooms = async () => {
    try {
      let query = supabase.from('rooms').select('id, room_number, room_type, price, status, max_guests').neq('status', 'maintenance');
      if (selectedProperty?.id) {
        query = query.eq('property_id', selectedProperty.id);
      }
      const { data: allRooms } = await query;

      // If dates are selected, exclude rooms with conflicting bookings
      if (checkIn && checkOut && selectedProperty?.id) {
        const checkInStr = format(checkIn, 'yyyy-MM-dd');
        const checkOutStr = format(checkOut, 'yyyy-MM-dd');

        const { data: conflicting } = await supabase
          .from('bookings')
          .select('room_id')
          .eq('property_id', selectedProperty.id)
          .in('status', ['confirmed', 'checked_in', 'pending', 'needs_review'])
          .lt('check_in', checkOutStr)
          .gt('check_out', checkInStr);

        const bookedRoomIds = new Set((conflicting || []).map(b => b.room_id));
        setRooms((allRooms || []).filter(r => !bookedRoomIds.has(r.id)));
      } else {
        setRooms(allRooms || []);
      }
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
    // Use rate engine breakdown if available
    if (stayBreakdown) return stayBreakdown.total;
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

    // CLOSED DATE CHECK: Block booking if any night is closed
    if (stayBreakdown && stayBreakdown.nights.some(n => n.closed)) {
      toast.error('Room is closed for one or more selected dates. Please choose different dates.');
      setLoading(false);
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

      // Build immutable price breakdown for storage
      const priceBreakdown = stayBreakdown ? {
        nights: stayBreakdown.nights,
        subtotal: stayBreakdown.subtotal,
        discount: stayBreakdown.discount,
        discountCode: stayBreakdown.discountCode,
        total: stayBreakdown.total,
        ratePlanName: stayBreakdown.ratePlanName,
        extraGuestFee: stayBreakdown.extraGuestFee,
      } : null;

      // Create booking
      const bookingStatus = checkInImmediately ? 'checked_in' : 'confirmed';
      const { data: newBooking, error: bookingError } = await supabase.from('bookings').insert({
        guest_id: guestId,
        room_id: roomId,
        check_in: format(checkIn!, 'yyyy-MM-dd'),
        check_out: format(checkOut!, 'yyyy-MM-dd'),
        num_guests: numGuests,
        num_adults: numAdults,
        num_children: numChildren,
        status: bookingStatus as any,
        checked_in_at: checkInImmediately ? new Date().toISOString() : null,
        special_requests: specialRequests.trim() || null,
        total_amount: effectiveTotal,
        created_by: user?.id,
        booking_source: bookingSource as any,
        ota_price: netOtaPrice,
        commission_rate: bookingSource !== 'direct' ? parseFloat(commissionRate) || null : null,
        commission_amount: commissionAmt,
        ota_reference: bookingSource !== 'direct' ? otaReference.trim() || null : null,
        property_id: selectedProperty.id,
        rate_plan_id: selectedRatePlanId || null,
        discount_code_id: stayBreakdown?.discountCodeId || null,
        discount_amount: stayBreakdown?.discount || 0,
        price_breakdown: priceBreakdown,
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

      // Update room status
      if (checkInImmediately) {
        // Walk-in immediate check-in: set room to occupied
        await supabase.from('rooms').update({ 
          status: 'occupied',
          housekeeping_status: 'occupied' as any,
        }).eq('id', roomId);
      } else {
        await supabase.from('rooms').update({ status: 'reserved' }).eq('id', roomId);
      }

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

      // Track discount code usage
      if (newBooking && stayBreakdown?.discountCodeId) {
        await supabase.from('discount_code_usages').insert({
          discount_code_id: stayBreakdown.discountCodeId,
          booking_id: newBooking.id,
        });
      }

      toast.success(checkInImmediately ? 'Walk-in guest checked in!' : 'Booking created successfully!');
      // Send booking confirmation email (fire-and-forget)
      if (newBooking) {
        sendGuestEmail(newBooking.id, 'booking_confirmation').catch(() => {});
      }
      navigate(isWalkIn ? '/front-desk' : '/bookings');
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
    <DashboardLayout title={isWalkIn ? "Walk-in Booking" : "New Booking"}>
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
                        modifiers={{ booked: (date) => bookedDateSet.has(toDateString(date)) }}
                        modifiersClassNames={{ booked: 'calendar-booked-dot' }}
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
                        modifiers={{ booked: (date) => bookedDateSet.has(toDateString(date)) }}
                        modifiersClassNames={{ booked: 'calendar-booked-dot' }}
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

                {/* Rate Plan Selector */}
                {ratePlans.length > 0 && roomId && (
                  <div className="space-y-2">
                    <Label>Rate Plan</Label>
                    <Select value={selectedRatePlanId} onValueChange={setSelectedRatePlanId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Default pricing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Default (room price)</SelectItem>
                        {ratePlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} — Rs. {plan.base_price.toLocaleString()}/night
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Rate Breakdown */}
                {stayBreakdown && stayBreakdown.nights.length > 0 && checkIn && checkOut && (
                  <div className="col-span-full p-3 bg-muted/50 rounded-lg border text-sm space-y-2">
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                      Nightly Rate Breakdown
                      {stayBreakdown.ratePlanName && <span className="ml-2 normal-case">({stayBreakdown.ratePlanName})</span>}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                      {stayBreakdown.nights.map((n) => (
                        <div
                          key={n.date}
                          className={cn(
                            'px-2 py-1 rounded text-xs flex justify-between items-center',
                            n.closed ? 'bg-destructive/10 text-destructive' :
                            n.override ? 'bg-blue-500/10' :
                            n.seasonal ? 'bg-orange-500/10' :
                            n.dayOfWeek ? 'bg-purple-500/10' :
                            'bg-background'
                          )}
                        >
                          <span>{n.date.slice(5)}</span>
                          <span className="font-medium">Rs. {n.finalPrice.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 border-t text-sm font-medium">
                      <span>Room Total ({stayBreakdown.nights.length} night{stayBreakdown.nights.length > 1 ? 's' : ''})</span>
                      <span>Rs. {stayBreakdown.subtotal.toLocaleString()}</span>
                    </div>
                    {stayBreakdown.discount > 0 && (
                      <div className="flex justify-between text-sm text-success">
                        <span>Discount ({stayBreakdown.discountCode})</span>
                        <span>- Rs. {stayBreakdown.discount.toLocaleString()}</span>
                      </div>
                    )}
                    {stayBreakdown.discount > 0 && (
                      <div className="flex justify-between text-sm font-bold">
                        <span>After Discount</span>
                        <span>Rs. {stayBreakdown.total.toLocaleString()}</span>
                      </div>
                    )}
                    {stayBreakdown.nights.some(n => n.closed) && (
                      <div className="flex items-center gap-2 text-destructive text-xs mt-1 p-2 bg-destructive/10 rounded">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Room is closed for one or more selected dates
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Adults *</Label>
                  <Select
                    value={numAdults.toString()}
                    onValueChange={(v) => setNumAdults(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} {n === 1 ? 'adult' : 'adults'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Children */}
                <div className="space-y-2">
                  <Label>Children</Label>
                  <Select
                    value={numChildren.toString()}
                    onValueChange={(v) => setNumChildren(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} {n === 1 ? 'child' : 'children'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Discount Code */}
                {bookingSource === 'direct' && (
                  <div className="space-y-2">
                    <Label>Discount Code</Label>
                    <Input
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SUMMER20"
                      className="font-mono"
                    />
                    {discountError && (
                      <p className="text-xs text-destructive">{discountError}</p>
                    )}
                    {stayBreakdown?.discountCode && (
                      <p className="text-xs text-success">✓ Discount applied: {stayBreakdown.discountCode}</p>
                    )}
                  </div>
                )}

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

              {/* Passport Photo Warning for OTA */}
              {bookingSource !== 'direct' && !guestIdPassport && (
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">Passport photo recommended</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      OTA bookings should have passport/ID information for compliance. You can still proceed without it.
                    </p>
                  </div>
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
                {/* Check-in Immediately Toggle */}
                <div className="flex items-center gap-3 py-2 px-1">
                  <Switch
                    id="check-in-immediately"
                    checked={checkInImmediately}
                    onCheckedChange={setCheckInImmediately}
                  />
                  <Label htmlFor="check-in-immediately" className="text-sm cursor-pointer">
                    Check-in immediately
                  </Label>
                  {checkInImmediately && (
                    <span className="text-xs text-success font-medium">Guest will be checked in now</span>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button type="button" variant="outline" onClick={() => navigate(isWalkIn ? '/front-desk' : '/bookings')} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                    {loading ? 'Creating...' : checkInImmediately ? 'Check In Now' : 'Create Booking'}
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
