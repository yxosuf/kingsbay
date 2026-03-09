import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, BedDouble, Users, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
  max_guests: number;
}

interface RoomDateSelectorProps {
  rooms: Room[];
  roomId: string;
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  numAdults: number;
  numChildren: number;
  bookedDateSet: Set<string>;
  onRoomChange: (value: string) => void;
  onCheckInChange: (date: Date | undefined) => void;
  onCheckOutChange: (date: Date | undefined) => void;
  onNumAdultsChange: (value: number) => void;
  onNumChildrenChange: (value: number) => void;
}

const RoomDateSelectorComponent = ({
  rooms,
  roomId,
  checkIn,
  checkOut,
  numAdults,
  numChildren,
  bookedDateSet,
  onRoomChange,
  onCheckInChange,
  onCheckOutChange,
  onNumAdultsChange,
  onNumChildrenChange,
}: RoomDateSelectorProps) => {
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const numGuests = numAdults + numChildren;
  const exceedsCapacity = selectedRoom && numGuests > selectedRoom.max_guests;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BedDouble className="h-5 w-5" />
          Room & Dates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Room Selection */}
        <div className="space-y-2">
          <Label htmlFor="room">
            Select Room <span className="text-destructive">*</span>
          </Label>
          <Select value={roomId} onValueChange={onRoomChange}>
            <SelectTrigger id="room">
              <SelectValue placeholder="Choose a room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  {checkIn && checkOut
                    ? 'No rooms available for selected dates'
                    : 'Select check-in and check-out dates first'}
                </div>
              ) : (
                rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.room_number} - {room.room_type} (Rs. {room.price.toLocaleString()}/night, max {room.max_guests} guests)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Check-In <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !checkIn && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkIn ? format(checkIn, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkIn}
                  onSelect={onCheckInChange}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  modifiers={{
                    booked: (date) => bookedDateSet.has(format(date, 'yyyy-MM-dd')),
                  }}
                  modifiersClassNames={{
                    booked: 'bg-warning/20 text-warning-foreground',
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>
              Check-Out <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !checkOut && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkOut ? format(checkOut, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOut}
                  onSelect={onCheckOutChange}
                  disabled={(date) => {
                    if (!checkIn) return date < new Date(new Date().setHours(0, 0, 0, 0));
                    return date <= checkIn;
                  }}
                  modifiers={{
                    booked: (date) => bookedDateSet.has(format(date, 'yyyy-MM-dd')),
                  }}
                  modifiersClassNames={{
                    booked: 'bg-warning/20 text-warning-foreground',
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Guest Count */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Number of Guests <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numAdults" className="text-sm">Adults</Label>
              <Input
                id="numAdults"
                type="number"
                min="1"
                value={numAdults}
                onChange={(e) => onNumAdultsChange(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numChildren" className="text-sm">Children</Label>
              <Input
                id="numChildren"
                type="number"
                min="0"
                value={numChildren}
                onChange={(e) => onNumChildrenChange(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          {exceedsCapacity && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Guest count ({numGuests}) exceeds room capacity ({selectedRoom.max_guests}).
                Please select a different room or reduce the number of guests.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const RoomDateSelector = memo(RoomDateSelectorComponent);
