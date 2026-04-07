import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Building2, BedDouble, DollarSign, Users, CheckCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

const STEPS = [
  { icon: Building2, title: 'Create Property', description: 'Set up your first property' },
  { icon: BedDouble, title: 'Add Rooms', description: 'Add rooms to your property' },
  { icon: DollarSign, title: 'Set Rate Plan', description: 'Configure your pricing' },
  { icon: Users, title: 'Invite Staff', description: 'Invite your team (optional)' },
];

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { saveSettings } = useUserSettings();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Property
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState<string>('hotel');
  const [propertyLocation, setPropertyLocation] = useState('');
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);

  // Step 2: Rooms
  const [rooms, setRooms] = useState([{ number: '101', type: 'Standard' }]);

  // Step 3: Rate Plan
  const [ratePlanName, setRatePlanName] = useState('Standard Rate');
  const [basePrice, setBasePrice] = useState('5000');

  // Step 4: Invite
  const [inviteEmail, setInviteEmail] = useState('');

  const handleCreateProperty = async () => {
    if (!propertyName.trim()) {
      toast.error('Property name is required');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('properties').insert({
        name: propertyName.trim(),
        property_type: propertyType as any,
        location: propertyLocation.trim() || null,
      }).select('id').single();

      if (error) throw error;
      setCreatedPropertyId(data.id);

      // Create inventory settings
      await supabase.from('property_inventory_settings').insert({
        property_id: data.id,
      });

      toast.success('Property created!');
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create property');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRooms = async () => {
    if (!createdPropertyId) return;
    const validRooms = rooms.filter(r => r.number.trim());
    if (validRooms.length === 0) {
      toast.error('Add at least one room');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('rooms').insert(
        validRooms.map(r => ({
          room_number: r.number.trim(),
          room_type: r.type,
          property_id: createdPropertyId,
          status: 'available' as any,
        }))
      );
      if (error) throw error;
      toast.success(`${validRooms.length} room(s) added!`);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add rooms');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRatePlan = async () => {
    if (!createdPropertyId) return;
    if (!ratePlanName.trim() || !basePrice) {
      toast.error('Rate plan name and base price are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('rate_plans').insert({
        name: ratePlanName.trim(),
        base_price: parseFloat(basePrice),
        property_id: createdPropertyId,
      });
      if (error) throw error;
      toast.success('Rate plan created!');
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rate plan');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    await saveSettings({ onboarding_completed: true } as any);
    toast.success('Onboarding complete! Welcome to Kings Bay PMS 🎉');
    onOpenChange(false);
    navigate('/');
  };

  const handleSkip = async () => {
    await saveSettings({ onboarding_completed: true } as any);
    onOpenChange(false);
  };

  const addRoom = () => {
    const nextNum = (parseInt(rooms[rooms.length - 1]?.number || '100') + 1).toString();
    setRooms([...rooms, { number: nextNum, type: 'Standard' }]);
  };

  const removeRoom = (idx: number) => {
    if (rooms.length <= 1) return;
    setRooms(rooms.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Welcome to Kings Bay PMS</DialogTitle>
          <DialogDescription>Let's set up your property in a few quick steps</DialogDescription>
        </DialogHeader>

        {/* Progress Indicators */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary/20 text-primary border-2 border-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="py-2">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
            {STEPS[step].title}
          </h3>

          {/* Step 1: Property */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Property Name *</Label>
                <Input value={propertyName} onChange={e => setPropertyName(e.target.value)} placeholder="e.g., Kings Bay Beach Resort" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="villa">Villa</SelectItem>
                      <SelectItem value="hostel">Hostel</SelectItem>
                      <SelectItem value="resort">Resort</SelectItem>
                      <SelectItem value="guesthouse">Guesthouse</SelectItem>
                      <SelectItem value="apartment">Apartment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={propertyLocation} onChange={e => setPropertyLocation(e.target.value)} placeholder="e.g., Arugam Bay" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Rooms */}
          {step === 1 && (
            <div className="space-y-3">
              {rooms.map((room, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Room #</Label>
                    <Input value={room.number} onChange={e => {
                      const r = [...rooms]; r[i].number = e.target.value; setRooms(r);
                    }} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={room.type} onValueChange={v => {
                      const r = [...rooms]; r[i].type = v; setRooms(r);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Deluxe">Deluxe</SelectItem>
                        <SelectItem value="Suite">Suite</SelectItem>
                        <SelectItem value="Family">Family</SelectItem>
                        <SelectItem value="Dorm">Dorm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {rooms.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeRoom(i)} className="shrink-0">×</Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRoom}>+ Add Room</Button>
            </div>
          )}

          {/* Step 3: Rate Plan */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rate Plan Name *</Label>
                <Input value={ratePlanName} onChange={e => setRatePlanName(e.target.value)} placeholder="e.g., Standard Rate" />
              </div>
              <div className="space-y-2">
                <Label>Base Price (LKR per night) *</Label>
                <Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="5000" />
              </div>
              <p className="text-xs text-muted-foreground">You can add more rate plans and pricing rules later in Settings.</p>
            </div>
          )}

          {/* Step 4: Invite */}
          {step === 3 && (
            <div className="space-y-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-4 text-center">
                  <CheckCircle className="h-12 w-12 text-primary mx-auto mb-3" />
                  <p className="font-semibold text-lg">Your property is ready!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can invite staff members from Settings → Users anytime.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip Setup
          </Button>
          <div className="flex gap-2">
            {step > 0 && step < 3 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step === 0 && (
              <Button onClick={handleCreateProperty} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Create & Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 1 && (
              <Button onClick={handleAddRooms} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add Rooms <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleCreateRatePlan} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Set Price <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleComplete}>
                Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
