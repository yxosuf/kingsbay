import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
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
      <Card className="border-destructive/30">
        <CardContent className="py-8 text-center text-muted-foreground">
          Only administrators can access the Danger Zone.
        </CardContent>
      </Card>
    );
  }

  const handleStartClear = () => {
    setStep('confirm');
    setPassword('');
    setResult(null);
    setShowConfirm(true);
  };

  const handleConfirmStep = () => {
    setStep('password');
  };

  const handleClearData = async () => {
    if (!selectedProperty?.id || !user?.email) return;

    setClearing(true);
    try {
      // Verify password by re-authenticating
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        toast.error('Incorrect password. Operation cancelled.');
        return;
      }

      // Call the clear function
      const { data, error } = await supabase.rpc('clear_property_data', {
        p_property_id: selectedProperty.id,
      });

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        property_id: selectedProperty.id,
        action: 'clear_property_data',
        details: data as any,
      });

      setResult(data as any);
      toast.success('Property data cleared successfully');
    } catch (error: any) {
      console.error('Error clearing data:', error);
      toast.error(error.message || 'Failed to clear property data');
    } finally {
      setClearing(false);
      setPassword('');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that permanently delete data. Use with extreme caution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Property:</span>
              <PropertyBadge />
            </div>

            {!selectedProperty ? (
              <p className="text-muted-foreground">Select a property first.</p>
            ) : (
              <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
                <div>
                  <h4 className="font-medium">Clear All Property Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all guests, bookings, invoices, payments, reports, and room availability
                    for <strong>{selectedProperty.name}</strong>. Rooms and property settings will be preserved.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleStartClear}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Property Data
                </Button>
              </div>
            )}

            {result && (
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Last Clear Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    {Object.entries(result).map(([key, value]) => (
                      <div key={key} className="text-center p-2 rounded bg-muted/50">
                        <div className="font-medium">{value}</div>
                        <div className="text-xs text-muted-foreground capitalize">{key.replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                <>
                  This will permanently delete <strong>ALL</strong> data for{' '}
                  <strong>{selectedProperty?.name}</strong> including guests, bookings, invoices,
                  payments, and room availability history. This action cannot be undone.
                </>
              ) : (
                'Enter your admin password to confirm this destructive action.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {step === 'password' && (
            <div className="py-4 space-y-2">
              <Label>Admin Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoFocus
              />
            </div>
          )}

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            {step === 'confirm' ? (
              <Button variant="destructive" onClick={handleConfirmStep}>
                Yes, I understand — proceed
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleClearData}
                disabled={clearing || !password}
              >
                {clearing ? 'Clearing...' : 'Confirm & Clear All Data'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
