import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { GuestLayout } from '@/components/guest/GuestLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, BedDouble, Tag, Check } from 'lucide-react';
import { format, addDays, differenceInDays, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';
import { calculateStayTotal, fetchRateEngineData, type RatePlan } from '@/lib/rateEngine';
import { parseLocalDate, toDateString } from '@/lib/dateUtils';

interface AvailableRoom {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  max_guests: number | null;
  description: string | null;
  property_id: string;
}

export default function GuestBooking() {
  const navigate = useNavigate();
  const { guestId } = useAuth();
  
  // Step state
  const [step, setStep] = useState(1);
  
  // Step 1: Property & dates
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  
  // Step 2: Room selection
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Step 3: Rate & discount
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [selectedRatePlanId, setSelectedRatePlanId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{ id: string; type: string; value: number } | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loadingPrice, setLoadingPrice] = useState(false);
  
  // Step 4: Confirm
  const [numAdults, setNumAdults] = useState(1);
  const [numChildren, setNumChildren] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load properties on mount
  useEffect(() => {
    supabase.from('properties').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) {
        setProperties(data);
        if (data.length === 1) setSelectedPropertyId(data[0].id);
      }
    });
  }, []);

  // Set default dates
  useEffect(() => {
    if (!checkIn) {
      const tomorrow = addDays(new Date(), 1);
      setCheckIn(toDateString(tomorrow));
      setCheckOut(toDateString(addDays(tomorrow, 2)));
    }
  }, []);

  // Search available rooms
  const searchRooms = async () => {
    if (!selectedPropertyId || !checkIn || !checkOut) {
      toast.error('Please select property and dates');
      return;
    }
    if (checkOut <= checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }

    setLoadingRooms(true);
    // Get all rooms for property
    const { data: allRooms } = await supabase
      .from('rooms')
      .select('id, room_number, room_type, price, max_guests, description, property_id')
      .eq('property_id', selectedPropertyId)
      .neq('status', 'maintenance');

    if (!allRooms || allRooms.length === 0) {
      setRooms([]);
      setLoadingRooms(false);
      return;
    }

    // Get bookings that conflict with selected dates [check_in, check_out)
    const { data: conflicting } = await supabase
      .from('bookings')
      .select('room_id')
      .eq('property_id', selectedPropertyId)
      .in('status', ['confirmed', 'checked_in', 'pending', 'needs_review'])
      .lt('check_in', checkOut)
      .gt('check_out', checkIn);

    const bookedRoomIds = new Set(conflicting?.map(b => b.room_id) || []);

    // Get blocked rooms
    const dates = eachDayOfInterval({ 
      start: parseLocalDate(checkIn), 
      end: new Date(parseLocalDate(checkOut).getTime() - 86400000) 
    });
    const dateStrings = dates.map(d => toDateString(d));

    const { data: blocked } = await supabase
      .from('room_availability')
      .select('room_id')
      .in('room_id', allRooms.map(r => r.id))
      .eq('is_available', false)
      .in('date', dateStrings);

    const blockedRoomIds = new Set(blocked?.map(b => b.room_id) || []);

    const available = allRooms.filter(r => !bookedRoomIds.has(r.id) && !blockedRoomIds.has(r.id));
    setRooms(available);
    setLoadingRooms(false);
    setStep(2);
  };

  // Load rate plans when room selected
  useEffect(() => {
    if (selectedRoom && selectedPropertyId) {
      supabase
        .from('rate_plans')
        .select('*')
        .eq('property_id', selectedPropertyId)
        .eq('is_active', true)
        .then(({ data }) => {
          if (data) {
            setRatePlans(data as RatePlan[]);
            // Default to first rate plan
            if (data.length > 0 && !selectedRatePlanId) {
              setSelectedRatePlanId(data[0].id);
            }
          }
        });
    }
  }, [selectedRoom, selectedPropertyId]);

  // Recalculate price when rate plan changes
  useEffect(() => {
    if (selectedRoom && selectedRatePlanId && checkIn && checkOut) {
      calculatePrice();
    }
  }, [selectedRatePlanId, selectedRoom, checkIn, checkOut, numAdults, numChildren, discountApplied]);

  const calculatePrice = async () => {
    if (!selectedRoom || !selectedRatePlanId || !checkIn || !checkOut) return;
    setLoadingPrice(true);

    try {
      const rateData = await fetchRateEngineData(selectedPropertyId, selectedRatePlanId);
      const nights = differenceInDays(parseLocalDate(checkOut), parseLocalDate(checkIn));
      const totalGuests = numAdults + numChildren;
      
      const result = calculateStayTotal({
        checkIn,
        checkOut,
        roomType: selectedRoom.room_type,
        totalGuests,
        propertyId: selectedPropertyId,
        ratePlan: rateData.ratePlan,
        roomTypeOverrides: rateData.roomTypeOverrides,
        overrides: rateData.overrides,
        seasonalRules: rateData.seasonalRules,
        dayOfWeekRules: rateData.dayOfWeekRules,
        occupancyRules: rateData.occupancyRules,
        totalPropertyRooms: rateData.totalPropertyRooms,
        currentBookedRooms: rateData.currentBookedRooms,
      });

      let finalTotal = result.totalAmount;
      if (discountApplied) {
        if (discountApplied.type === 'percent') {
          finalTotal = finalTotal * (1 - discountApplied.value / 100);
        } else {
          finalTotal = Math.max(0, finalTotal - discountApplied.value);
        }
      }

      setPriceBreakdown(result);
      setTotalAmount(Math.round(finalTotal));
    } catch (err) {
      console.error('Price calculation error:', err);
    }
    setLoadingPrice(false);
  };

  const applyDiscount = async () => {
    if (!discountCode.trim() || !selectedPropertyId) return;
    
    const { data } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('property_id', selectedPropertyId)
      .eq('code', discountCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (!data) {
      toast.error('Invalid discount code');
      return;
    }

    // Check dates
    const today = toDateString(new Date());
    if (data.start_date && today < data.start_date) { toast.error('Discount not yet active'); return; }
    if (data.end_date && today > data.end_date) { toast.error('Discount expired'); return; }

    setDiscountApplied({ id: data.id, type: data.discount_type, value: data.discount_value });
    toast.success(`Discount applied: ${data.discount_type === 'percent' ? `${data.discount_value}%` : `LKR ${data.discount_value}`} off`);
  };

  const handleBook = async () => {
    if (!guestId || !selectedRoom || !selectedRatePlanId) return;
    setIsSubmitting(true);

    const { data, error } = await supabase.from('bookings').insert({
      guest_id: guestId,
      room_id: selectedRoom.id,
      property_id: selectedPropertyId,
      check_in: checkIn,
      check_out: checkOut,
      num_adults: numAdults,
      num_children: numChildren,
      status: 'confirmed',
      booking_source: 'direct' as any,
      total_amount: totalAmount,
      rate_plan_id: selectedRatePlanId,
      discount_code_id: discountApplied?.id || null,
      discount_amount: discountApplied ? (priceBreakdown?.totalAmount || 0) - totalAmount : 0,
      special_requests: specialRequests.trim() || null,
      price_breakdown: priceBreakdown,
    }).select('id').single();

    if (error) {
      toast.error(error.message || 'Failed to create booking');
      setIsSubmitting(false);
      return;
    }

    // Record discount usage
    if (discountApplied && data) {
      await supabase.from('discount_code_usages').insert({
        discount_code_id: discountApplied.id,
        booking_id: data.id,
      });
    }

    // Send confirmation email
    try {
      await supabase.functions.invoke('guest-email', {
        body: { booking_id: data?.id, email_type: 'booking_confirmation' },
      });
    } catch (e) {
      // Non-blocking
    }

    toast.success('Booking confirmed!');
    navigate(`/guest/bookings/${data?.id}`);
    setIsSubmitting(false);
  };

  const nights = checkIn && checkOut ? differenceInDays(parseLocalDate(checkOut), parseLocalDate(checkIn)) : 0;

  return (
    <GuestLayout title="Book a Room">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Step indicators */}
        <div className="flex items-center gap-2 text-sm">
          {['Dates', 'Room', 'Rate & Discount', 'Confirm'].map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step > i + 1 ? 'bg-primary text-primary-foreground' :
                step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={step === i + 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
              {i < 3 && <span className="text-muted-foreground mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Property & Dates */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Select Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {properties.length > 1 && (
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Check-in</Label>
                  <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} min={toDateString(new Date())} />
                </div>
                <div className="space-y-2">
                  <Label>Check-out</Label>
                  <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} min={checkIn || toDateString(new Date())} />
                </div>
              </div>
              {nights > 0 && <p className="text-sm text-muted-foreground">{nights} night{nights !== 1 ? 's' : ''}</p>}
              <Button onClick={searchRooms} disabled={loadingRooms} className="w-full">
                {loadingRooms ? 'Searching...' : 'Search Available Rooms'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Room Selection */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" /> Select a Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rooms.length === 0 ? (
                <p className="text-muted-foreground">No rooms available for these dates. Try different dates.</p>
              ) : (
                rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { setSelectedRoom(room); setStep(3); }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedRoom?.id === room.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Room {room.room_number}</p>
                        <p className="text-sm text-muted-foreground capitalize">{room.room_type}{room.max_guests ? ` • Up to ${room.max_guests} guests` : ''}</p>
                        {room.description && <p className="text-xs text-muted-foreground mt-1">{room.description}</p>}
                      </div>
                      <span className="text-sm font-medium">from LKR {room.price.toLocaleString()}/night</span>
                    </div>
                  </button>
                ))
              )}
              <Button variant="outline" onClick={() => setStep(1)}>← Back to Dates</Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Rate Plan & Discount */}
        {step === 3 && selectedRoom && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Rate & Discount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Rate Plan</Label>
                <Select value={selectedRatePlanId} onValueChange={setSelectedRatePlanId}>
                  <SelectTrigger><SelectValue placeholder="Select rate plan" /></SelectTrigger>
                  <SelectContent>
                    {ratePlans.map(rp => (
                      <SelectItem key={rp.id} value={rp.id}>
                        {rp.name} – LKR {rp.base_price.toLocaleString()}/night{!rp.is_refundable ? ' (Non-refundable)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adults</Label>
                  <Input type="number" min={1} max={selectedRoom.max_guests || 10} value={numAdults} onChange={e => setNumAdults(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Children</Label>
                  <Input type="number" min={0} max={5} value={numChildren} onChange={e => setNumChildren(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Discount Code (optional)</Label>
                <div className="flex gap-2">
                  <Input value={discountCode} onChange={e => setDiscountCode(e.target.value)} placeholder="Enter code" />
                  <Button variant="outline" onClick={applyDiscount} disabled={!discountCode.trim()}>Apply</Button>
                </div>
                {discountApplied && (
                  <Badge variant="default" className="text-xs">
                    ✓ Discount applied: {discountApplied.type === 'percent' ? `${discountApplied.value}%` : `LKR ${discountApplied.value}`}
                  </Badge>
                )}
              </div>

              {loadingPrice ? (
                <p className="text-sm text-muted-foreground">Calculating price...</p>
              ) : totalAmount > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex justify-between font-semibold">
                    <span>Total ({nights} night{nights !== 1 ? 's' : ''})</span>
                    <span>LKR {totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                <Button onClick={() => setStep(4)} disabled={!totalAmount} className="flex-1">Continue to Confirm</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && selectedRoom && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Your Booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Property</span><span>{properties.find(p => p.id === selectedPropertyId)?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span>{selectedRoom.room_number} ({selectedRoom.room_type})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dates</span><span>{format(parseLocalDate(checkIn), 'MMM d')} – {format(parseLocalDate(checkOut), 'MMM d, yyyy')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Guests</span><span>{numAdults} adult{numAdults !== 1 ? 's' : ''}{numChildren > 0 ? `, ${numChildren} child${numChildren !== 1 ? 'ren' : ''}` : ''}</span></div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-border"><span>Total</span><span>LKR {totalAmount.toLocaleString()}</span></div>
              </div>

              <div className="space-y-2">
                <Label>Special Requests (optional)</Label>
                <Textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Early check-in, extra pillows..." rows={3} />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
                <Button onClick={handleBook} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </GuestLayout>
  );
}
