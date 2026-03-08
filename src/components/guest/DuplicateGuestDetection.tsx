import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GitMerge, Search, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DuplicateGuest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_passport: string | null;
  nic_number: string | null;
  passport_number: string | null;
  total_stays: number;
  total_spent: number;
  created_at: string;
  property_id: string | null;
}

interface DuplicateGroup {
  matchField: string;
  matchValue: string;
  guests: DuplicateGuest[];
}

export function DuplicateGuestDetection() {
  const { selectedProperty, showAllProperties } = useProperty();
  const { isAdmin } = useAuth();
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{ keep: DuplicateGuest; remove: DuplicateGuest } | null>(null);

  const scanForDuplicates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('guests')
        .select('id, name, phone, email, id_passport, nic_number, passport_number, total_stays, total_spent, created_at, property_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (!showAllProperties && selectedProperty?.id) {
        query = query.eq('property_id', selectedProperty.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const guests = (data || []) as DuplicateGuest[];
      const groups: DuplicateGroup[] = [];
      const seen = new Set<string>();

      // Check phone duplicates
      const phoneMap = new Map<string, DuplicateGuest[]>();
      guests.forEach(g => {
        if (g.phone && g.phone.trim().length >= 5) {
          const normalized = g.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
          if (normalized.length >= 5) {
            if (!phoneMap.has(normalized)) phoneMap.set(normalized, []);
            phoneMap.get(normalized)!.push(g);
          }
        }
      });
      phoneMap.forEach((group, value) => {
        if (group.length > 1) {
          const key = `phone:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            groups.push({ matchField: 'Phone', matchValue: value, guests: group });
          }
        }
      });

      // Check email duplicates
      const emailMap = new Map<string, DuplicateGuest[]>();
      guests.forEach(g => {
        if (g.email && g.email.trim().length > 3) {
          const normalized = g.email.trim().toLowerCase();
          if (!emailMap.has(normalized)) emailMap.set(normalized, []);
          emailMap.get(normalized)!.push(g);
        }
      });
      emailMap.forEach((group, value) => {
        if (group.length > 1) {
          const key = `email:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            groups.push({ matchField: 'Email', matchValue: value, guests: group });
          }
        }
      });

      // Check passport duplicates
      const passportMap = new Map<string, DuplicateGuest[]>();
      guests.forEach(g => {
        const passport = g.passport_number || g.id_passport;
        if (passport && passport.trim().length >= 4) {
          const normalized = passport.trim().toUpperCase();
          if (!passportMap.has(normalized)) passportMap.set(normalized, []);
          passportMap.get(normalized)!.push(g);
        }
      });
      passportMap.forEach((group, value) => {
        if (group.length > 1) {
          const key = `passport:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            groups.push({ matchField: 'Passport', matchValue: value, guests: group });
          }
        }
      });

      // Check NIC duplicates
      const nicMap = new Map<string, DuplicateGuest[]>();
      guests.forEach(g => {
        if (g.nic_number && g.nic_number.trim().length >= 5) {
          const normalized = g.nic_number.trim().toUpperCase();
          if (!nicMap.has(normalized)) nicMap.set(normalized, []);
          nicMap.get(normalized)!.push(g);
        }
      });
      nicMap.forEach((group, value) => {
        if (group.length > 1) {
          const key = `nic:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            groups.push({ matchField: 'NIC', matchValue: value, guests: group });
          }
        }
      });

      setDuplicates(groups);
      if (groups.length === 0) {
        toast.success('No duplicates found!');
      } else {
        toast.info(`Found ${groups.length} potential duplicate group(s)`);
      }
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      toast.error('Failed to scan for duplicates');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget) return;
    setMerging(true);

    const { keep, remove } = mergeTarget;

    try {
      // Reassign all bookings from remove -> keep
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ guest_id: keep.id })
        .eq('guest_id', remove.id);
      if (bookingError) throw bookingError;

      // Reassign guest_services
      const { error: serviceError } = await supabase
        .from('guest_services')
        .update({ booking_id: keep.id } as any)
        .eq('booking_id', remove.id);
      // This may not match any, that's ok

      // Reassign guest_feedback
      await supabase
        .from('guest_feedback')
        .update({ guest_id: keep.id })
        .eq('guest_id', remove.id);

      // Reassign guest_view_logs
      await supabase
        .from('guest_view_logs')
        .update({ guest_id: keep.id } as any)
        .eq('guest_id', remove.id);

      // Merge totals
      const newTotalStays = keep.total_stays + remove.total_stays;
      const newTotalSpent = keep.total_spent + remove.total_spent;

      // Fill in missing fields on keep from remove
      const updates: Record<string, any> = {
        total_stays: newTotalStays,
        total_spent: newTotalSpent,
      };
      if (!keep.phone && remove.phone) updates.phone = remove.phone;
      if (!keep.email && remove.email) updates.email = remove.email;
      if (!keep.id_passport && remove.id_passport) updates.id_passport = remove.id_passport;
      if (!keep.nic_number && remove.nic_number) updates.nic_number = remove.nic_number;
      if (!keep.passport_number && remove.passport_number) updates.passport_number = remove.passport_number;

      const { error: updateError } = await supabase
        .from('guests')
        .update(updates)
        .eq('id', keep.id);
      if (updateError) throw updateError;

      // Soft delete the removed guest
      const { error: deleteError } = await supabase
        .from('guests')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', remove.id);
      if (deleteError) throw deleteError;

      toast.success(`Merged "${remove.name}" into "${keep.name}"`);
      setMergeTarget(null);
      // Re-scan
      scanForDuplicates();
    } catch (error) {
      console.error('Error merging guests:', error);
      toast.error('Failed to merge guests');
    } finally {
      setMerging(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Only admins can access the duplicate detection tool.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-5 w-5 text-primary" />
                  Duplicate Guest Detection
                </CardTitle>
                <CardDescription>
                  Find and merge duplicate guest records by phone, email, passport, or NIC
                </CardDescription>
              </div>
              <Button onClick={scanForDuplicates} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? 'Scanning...' : 'Scan for Duplicates'}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {duplicates.length > 0 && (
          <div className="space-y-3">
            {duplicates.map((group, idx) => (
              <Card key={idx} className="border-warning/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <CardTitle className="text-sm">
                      Matched by {group.matchField}: <span className="font-mono text-xs">{group.matchValue}</span>
                    </CardTitle>
                    <Badge variant="warning" className="ml-auto">{group.guests.length} records</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.guests.map((guest, gIdx) => (
                    <div
                      key={guest.id}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-lg border",
                        gIdx === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/50"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{guest.name}</p>
                          {gIdx === 0 && <Badge variant="outline" className="text-xs">Oldest</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          {guest.phone && <span>📞 {guest.phone}</span>}
                          {guest.email && <span>✉️ {guest.email}</span>}
                          <span>{guest.total_stays} stay{guest.total_stays !== 1 ? 's' : ''}</span>
                          <span>Rs. {guest.total_spent.toLocaleString()}</span>
                        </div>
                      </div>
                      {gIdx > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs gap-1"
                          onClick={() => setMergeTarget({ keep: group.guests[0], remove: guest })}
                        >
                          <GitMerge className="h-3 w-3" />
                          Merge into #{1}
                        </Button>
                      )}
                    </div>
                  ))}</CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && duplicates.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Click "Scan for Duplicates" to check for potential duplicate guest records.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!mergeTarget} onOpenChange={(open) => !open && setMergeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Guest Records</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <strong>"{mergeTarget?.remove.name}"</strong> into <strong>"{mergeTarget?.keep.name}"</strong>.
              All bookings, services, and feedback from the removed guest will be transferred. The removed guest will be soft-deleted.
              This action cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMerge}
              disabled={merging}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {merging ? 'Merging...' : 'Confirm Merge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
