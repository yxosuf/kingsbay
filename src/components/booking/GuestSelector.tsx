import { memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countries, getDialCodeByCountry } from '@/lib/countryData';

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface GuestSelectorProps {
  existingGuests: Guest[];
  filteredGuests: Guest[];
  selectedGuest: Guest | null;
  guestSearch: string;
  showGuestSearch: boolean;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestIdPassport: string;
  guestNationality: string;
  phoneCountryCode: string;
  onGuestSearchChange: (value: string) => void;
  onShowGuestSearchChange: (show: boolean) => void;
  onSelectGuest: (guest: Guest) => void;
  onGuestNameChange: (value: string) => void;
  onGuestPhoneChange: (value: string) => void;
  onGuestEmailChange: (value: string) => void;
  onGuestIdPassportChange: (value: string) => void;
  onGuestNationalityChange: (value: string) => void;
  onPhoneCountryCodeChange: (value: string) => void;
}

const GuestSelectorComponent = ({
  existingGuests,
  filteredGuests,
  selectedGuest,
  guestSearch,
  showGuestSearch,
  guestName,
  guestPhone,
  guestEmail,
  guestIdPassport,
  guestNationality,
  phoneCountryCode,
  onGuestSearchChange,
  onShowGuestSearchChange,
  onSelectGuest,
  onGuestNameChange,
  onGuestPhoneChange,
  onGuestEmailChange,
  onGuestIdPassportChange,
  onGuestNationalityChange,
  onPhoneCountryCodeChange,
}: GuestSelectorProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Guest Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Guest Search Toggle */}
        {existingGuests.length > 0 && !selectedGuest && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={showGuestSearch ? 'default' : 'outline'}
              onClick={() => onShowGuestSearchChange(!showGuestSearch)}
              className="flex-1"
            >
              <Search className="h-4 w-4 mr-2" />
              Search Existing Guest
            </Button>
            <Button
              type="button"
              variant={!showGuestSearch ? 'default' : 'outline'}
              onClick={() => onShowGuestSearchChange(false)}
              className="flex-1"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              New Guest
            </Button>
          </div>
        )}

        {/* Guest Search */}
        {showGuestSearch && !selectedGuest && (
          <div className="space-y-2">
            <Label>Search by name, phone, or email</Label>
            <Input
              placeholder="Type to search..."
              value={guestSearch}
              onChange={(e) => onGuestSearchChange(e.target.value)}
            />
            {filteredGuests.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {filteredGuests.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => onSelectGuest(guest)}
                    className="w-full text-left p-3 hover:bg-muted transition-colors border-b last:border-0"
                  >
                    <p className="font-medium">{guest.name}</p>
                    <p className="text-sm text-muted-foreground">{guest.phone}</p>
                    {guest.email && (
                      <p className="text-sm text-muted-foreground">{guest.email}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            {guestSearch && filteredGuests.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No guests found</p>
            )}
          </div>
        )}

        {/* Selected Guest Display */}
        {selectedGuest && (
          <div className="bg-primary/10 p-3 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedGuest.name}</p>
              <p className="text-sm text-muted-foreground">{selectedGuest.phone}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onSelectGuest(null as any);
                onGuestNameChange('');
                onGuestPhoneChange('');
                onGuestEmailChange('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Guest Form Fields */}
        {!showGuestSearch && !selectedGuest && (
          <>
            <div className="space-y-2">
              <Label htmlFor="guestName">
                Guest Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => onGuestNameChange(e.target.value)}
                placeholder="Enter guest name"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneCountryCode">Country Code</Label>
                <Select value={phoneCountryCode} onValueChange={onPhoneCountryCodeChange}>
                  <SelectTrigger id="phoneCountryCode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={getDialCodeByCountry(country.name)}>
                        {country.flag} {country.name} ({getDialCodeByCountry(country.name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestPhone">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => onGuestPhoneChange(e.target.value)}
                  placeholder="Enter phone number"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestEmail">Email (Optional)</Label>
              <Input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => onGuestEmailChange(e.target.value)}
                placeholder="guest@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestNationality">Nationality</Label>
              <Select value={guestNationality} onValueChange={onGuestNationalityChange}>
                <SelectTrigger id="guestNationality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.name}>
                      {country.flag} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestIdPassport">ID/Passport Number (Optional)</Label>
              <Input
                id="guestIdPassport"
                value={guestIdPassport}
                onChange={(e) => onGuestIdPassportChange(e.target.value)}
                placeholder="Enter ID or passport number"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const GuestSelector = memo(GuestSelectorComponent);
