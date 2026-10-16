import { useState } from 'react';
import { Building2, LogIn } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Shown to a signed-in user who isn't part of any company yet. */
export function CreateCompany({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState<string>((user?.user_metadata?.company_name as string) || '');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (name.trim().length < 2) {
      toast.error('Please enter your company name');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('create_organization_with_owner', {
      p_name: name.trim(),
      p_user_agent: navigator.userAgent,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Your company is ready');
    qc.invalidateQueries();
    window.location.assign('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Create your business account</CardTitle>
          <CardDescription>
            Set up your company to start adding properties, rooms and staff. If you were invited by a company,
            ask their admin to add you instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunset Villas" maxLength={100} />
          </div>
          <Button className="w-full" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create company'}</Button>
          <Button variant="outline" className="w-full" onClick={onSignOut}><LogIn className="h-4 w-4" /> Return to login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
