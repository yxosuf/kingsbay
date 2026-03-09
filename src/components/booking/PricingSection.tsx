import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Tag, TrendingUp, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { StayTotal } from '@/lib/rateEngine';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
  max_guests: number;
}

interface PricingSectionProps {
  rooms: Room[];
  roomId: string;
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  ratePlans: any[];
  selectedRatePlanId: string;
  stayBreakdown: StayTotal | null;
  calculatingRate: boolean;
  discountCode: string;
  discountError: string;
  bookingSource: string;
  useCustomPrice: boolean;
  customTotalAmount: string;
  commissionRate: string;
  otaReference: string;
  onRatePlanChange: (value: string) => void;
  onDiscountCodeChange: (value: string) => void;
  onBookingSourceChange: (value: string) => void;
  onUseCustomPriceChange: (value: boolean) => void;
  onCustomTotalAmountChange: (value: string) => void;
  onCommissionRateChange: (value: string) => void;
  onOtaReferenceChange: (value: string) => void;
}

const PricingSectionComponent = ({
  rooms,
  roomId,
  checkIn,
  checkOut,
  ratePlans,
  selectedRatePlanId,
  stayBreakdown,
  calculatingRate,
  discountCode,
  discountError,
  bookingSource,
  useCustomPrice,
  customTotalAmount,
  commissionRate,
  otaReference,
  onRatePlanChange,
  onDiscountCodeChange,
  onBookingSourceChange,
  onUseCustomPriceChange,
  onCustomTotalAmountChange,
  onCommissionRateChange,
  onOtaReferenceChange,
}: PricingSectionProps) => {
  const selectedRoom = rooms.find((r) => r.id === roomId);

  const calculateSystemTotal = () => {
    if (stayBreakdown) return stayBreakdown.total;
    if (!checkIn || !checkOut || !selectedRoom) return 0;
    const nights = differenceInDays(checkOut, checkIn);
    return selectedRoom.price * Math.max(nights, 1);
  };

  const getEffectiveTotal = () => {
    if (useCustomPrice && customTotalAmount) {
      return parseFloat(customTotalAmount) || 0;
    }
    return calculateSystemTotal();
  };

  const calculateCommission = () => {
    const rate = parseFloat(commissionRate) || 0;
    const total = getEffectiveTotal();
    return (total * rate) / 100;
  };

  const getNetPrice = () => {
    if (bookingSource === 'direct') return null;
    return getEffectiveTotal() - calculateCommission();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pricing & Rate Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Source */}
        <div className="space-y-2">
          <Label htmlFor="bookingSource">Booking Source</Label>
          <Select value={bookingSource} onValueChange={onBookingSourceChange}>
            <SelectTrigger id="bookingSource">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="booking_com">Booking.com</SelectItem>
              <SelectItem value="airbnb">Airbnb</SelectItem>
              <SelectItem value="agoda">Agoda</SelectItem>
              <SelectItem value="expedia">Expedia</SelectItem>
              <SelectItem value="other_ota">Other OTA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* OTA Fields */}
        {bookingSource !== 'direct' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission Rate (%)</Label>
              <Input
                id="commissionRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => onCommissionRateChange(e.target.value)}
                placeholder="e.g., 15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otaReference">OTA Reference/Confirmation Number</Label>
              <Input
                id="otaReference"
                value={otaReference}
                onChange={(e) => onOtaReferenceChange(e.target.value)}
                placeholder="Enter OTA reference number"
              />
            </div>
          </>
        )}

        {/* Rate Plan Selection */}
        {ratePlans.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="ratePlan">Rate Plan (Optional)</Label>
            <Select value={selectedRatePlanId} onValueChange={onRatePlanChange}>
              <SelectTrigger id="ratePlan">
                <SelectValue placeholder="Standard Rate (No plan)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Standard Rate (No plan)</SelectItem>
                {ratePlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - Rs. {plan.base_price.toLocaleString()}/night
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Discount Code */}
        <div className="space-y-2">
          <Label htmlFor="discountCode" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Discount Code (Optional)
          </Label>
          <Input
            id="discountCode"
            value={discountCode}
            onChange={(e) => onDiscountCodeChange(e.target.value.toUpperCase())}
            placeholder="Enter discount code"
          />
          {discountError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {discountError}
            </p>
          )}
        </div>

        {/* Custom Price Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="customPrice" className="text-sm font-medium">Override with Custom Price</Label>
            <p className="text-xs text-muted-foreground">Manually set the total amount</p>
          </div>
          <Switch
            id="customPrice"
            checked={useCustomPrice}
            onCheckedChange={onUseCustomPriceChange}
          />
        </div>

        {useCustomPrice && (
          <div className="space-y-2">
            <Label htmlFor="customAmount">Custom Total Amount (LKR)</Label>
            <Input
              id="customAmount"
              type="number"
              min="0"
              step="0.01"
              value={customTotalAmount}
              onChange={(e) => onCustomTotalAmountChange(e.target.value)}
              placeholder="Enter custom amount"
            />
          </div>
        )}

        <Separator />

        {/* Price Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Price Breakdown
          </h4>

          {calculatingRate ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : stayBreakdown && !useCustomPrice ? (
            <div className="space-y-2 text-sm">
              {stayBreakdown.nights.map((night, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {format(new Date(night.date), 'MMM d')}
                    {night.seasonal && <span className="ml-1 text-xs">({night.seasonal})</span>}
                    {night.override && <span className="ml-1 text-xs text-primary">(override)</span>}
                    {night.closed && <span className="ml-1 text-xs text-destructive">(CLOSED)</span>}
                  </span>
                  <span className={cn(night.closed && 'text-destructive')}>
                    Rs. {night.finalPrice.toLocaleString()}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({stayBreakdown.nights.length} nights)</span>
                <span>Rs. {stayBreakdown.subtotal.toLocaleString()}</span>
              </div>
              {stayBreakdown.discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount ({stayBreakdown.discountCode})</span>
                  <span>- Rs. {stayBreakdown.discount.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>Rs. {stayBreakdown.total.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>Rs. {getEffectiveTotal().toLocaleString()}</span>
            </div>
          )}

          {/* OTA Commission Display */}
          {bookingSource !== 'direct' && (
            <>
              <Separator />
              <div className="space-y-2 text-sm bg-muted/30 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guest Pays (Gross)</span>
                  <span className="font-medium">Rs. {getEffectiveTotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Commission ({commissionRate}%)</span>
                  <span>- Rs. {calculateCommission().toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Net Revenue</span>
                  <span className="text-success">Rs. {(getNetPrice() || 0).toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const PricingSection = memo(PricingSectionComponent);
