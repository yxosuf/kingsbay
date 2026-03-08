import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, ShieldAlert, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PropertyBadge } from '@/components/layout/PropertyBadge';

export function DangerZoneSettings() {
  const { selectedProperty } = useProperty();
  const { isAdmin, user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'confirm' | 'password'>('confirm');
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  if (!isAdmin) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="py-10 text-center">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Only administrators can access the Danger Zone.</p>
        </CardContent>
      </Card>
    );
  }

  const handleStartClear = () => { setStep('confirm'); setPassword(''); setResult(null); setShowConfirm(true); };
  const handleConfirmStep = () => { setStep('password'); };

  const handleClearData = async () => {
    if (!selectedProperty?.id || !user?.email) return;
    setClearing(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (authError) { toast.error('Incorrect password. Operation cancelled.'); return; }
      const { data, error } = await supabase.rpc('clear_property_data', { p_property_id: selectedProperty.id });
      if (error) throw error;
      await supabase.from('audit_logs').insert({ user_id: user.id, property_id: selectedProperty.id, action: 'clear_property_data', details: data as any });
      setResult(data as any);
      toast.success('Property data cleared successfully');
    } catch (error: any) {
      console.error('Error clearing data:', error);
      toast.error(error.message || 'Failed to clear property data');
    } finally { setClearing(false); setPassword(''); }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Irreversible Actions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Actions in this section permanently delete data and cannot be undone. Proceed with extreme caution.
            </p>
          </div>
        </div>

        <Card className="border-destructive/30 overflow-hidden">
          {/* Red top band */}
          <div className="h-1.5 bg-destructive/60" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete data for the selected property
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Target Property:</span>
              <PropertyBadge />
            </div>

            {!selectedProperty ? (
              <p className="text-sm text-muted-foreground">Select a property first.</p>
            ) : (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 space-y-4">
                <div>
                  <h4 className="font-medium text-sm">Clear All Property Data</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently delete all guests, bookings, invoices, payments, reports, and room availability
                    for <strong>{selectedProperty.name}</strong>. Rooms and property settings will be preserved.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="destructive" size="sm" onClick={handleStartClear}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Property Data
                  </Button>
                  <span className="text-[10px] text-muted-foreground">Requires password verification</span>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Clear Result</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(result).map(([key, value]) => (
                    <div key={key} className="text-center p-3 rounded-lg bg-background border">
                      <div className="text-lg font-bold">{value}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{key.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={(open) => { if (!open) { setShowConfirm(false); setStep('confirm'); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {step === 'confirm' ? 'Are you absolutely sure?' : 'Enter your password'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {step === 'confirm' ? (
                <>This will permanently delete <strong>ALL</strong> data for <strong>{selectedProperty?.name}</strong> including guests, bookings, invoices, payments, and room availability history. This action cannot be undone.</>
              ) : (
                'Enter your admin password to confirm this destructive action.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {step === 'password' && (
            <div className="py-4 space-y-2">
              <Label>Admin Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoFocus />
            </div>
          )}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            {step === 'confirm' ? (
              <Button variant="destructive" onClick={handleConfirmStep}>Yes, I understand — proceed</Button>
            ) : (
              <Button variant="destructive" onClick={handleClearData} disabled={clearing || !password}>
                {clearing ? 'Clearing...' : 'Confirm & Clear All Data'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
