import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, DollarSign, Calendar, Sun, Tag, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function RateManagementSettings() {
  const { selectedProperty } = useProperty();
  const { isAdmin } = useAuth();
  const propertyId = selectedProperty?.id;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Rate Management</h2>
        <p className="text-muted-foreground">Configure pricing plans, seasonal adjustments, and promotions.</p>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="plans"><DollarSign className="h-4 w-4 mr-1" />Rate Plans</TabsTrigger>
          <TabsTrigger value="seasonal"><Sun className="h-4 w-4 mr-1" />Seasonal</TabsTrigger>
          <TabsTrigger value="dayofweek"><Calendar className="h-4 w-4 mr-1" />Day of Week</TabsTrigger>
          <TabsTrigger value="discounts"><Tag className="h-4 w-4 mr-1" />Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <RatePlansTab propertyId={propertyId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="seasonal">
          <SeasonalRulesTab propertyId={propertyId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="dayofweek">
          <DayOfWeekTab propertyId={propertyId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="discounts">
          <DiscountCodesTab propertyId={propertyId} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ RATE PLANS TAB ============

function RatePlansTab({ propertyId, isAdmin }: { propertyId?: string; isAdmin: boolean }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', description: '', base_price: '', is_refundable: true,
    min_stay: '1', max_stay: '', included_guests: '2', extra_guest_fee: '0',
  });

  const fetchPlans = async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('property_id', propertyId)
      .order('name');
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, [propertyId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', base_price: '', is_refundable: true, min_stay: '1', max_stay: '', included_guests: '2', extra_guest_fee: '0' });
    setShowDialog(true);
  };

  const openEdit = (plan: any) => {
    setEditing(plan);
    setForm({
      name: plan.name, description: plan.description || '', base_price: String(plan.base_price),
      is_refundable: plan.is_refundable, min_stay: String(plan.min_stay),
      max_stay: plan.max_stay ? String(plan.max_stay) : '',
      included_guests: String(plan.included_guests), extra_guest_fee: String(plan.extra_guest_fee),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!propertyId || !form.name || !form.base_price) {
      toast.error('Name and base price are required');
      return;
    }
    const payload = {
      property_id: propertyId,
      name: form.name,
      description: form.description || null,
      base_price: parseFloat(form.base_price),
      is_refundable: form.is_refundable,
      min_stay: parseInt(form.min_stay) || 1,
      max_stay: form.max_stay ? parseInt(form.max_stay) : null,
      included_guests: parseInt(form.included_guests) || 2,
      extra_guest_fee: parseFloat(form.extra_guest_fee) || 0,
    };

    if (editing) {
      const { error } = await supabase.from('rate_plans').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Rate plan updated');
    } else {
      const { error } = await supabase.from('rate_plans').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Rate plan created');
    }
    setShowDialog(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rate plan?')) return;
    const { error } = await supabase.from('rate_plans').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Rate plan deleted');
    fetchPlans();
  };

  const toggleActive = async (plan: any) => {
    await supabase.from('rate_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    fetchPlans();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Rate Plans</CardTitle>
          <CardDescription>Define pricing strategies for your room types</CardDescription>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Plan</Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No rate plans yet. Create one to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Min Stay</TableHead>
                <TableHead>Refundable</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell><CurrencyDisplay amount={plan.base_price} /></TableCell>
                  <TableCell>{plan.min_stay} night{plan.min_stay > 1 ? 's' : ''}</TableCell>
                  <TableCell>
                    <Badge variant={plan.is_refundable ? 'default' : 'secondary'}>
                      {plan.is_refundable ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={plan.is_active} onCheckedChange={() => toggleActive(plan)} disabled={!isAdmin} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(plan.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rate Plan' : 'Create Rate Plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard Rate" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Price (LKR)</Label>
                <Input type="number" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Min Stay (nights)</Label>
                <Input type="number" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Stay</Label>
                <Input type="number" value={form.max_stay} onChange={(e) => setForm({ ...form, max_stay: e.target.value })} placeholder="No limit" />
              </div>
              <div className="space-y-2">
                <Label>Included Guests</Label>
                <Input type="number" value={form.included_guests} onChange={(e) => setForm({ ...form, included_guests: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Extra Guest Fee (LKR/night)</Label>
              <Input type="number" value={form.extra_guest_fee} onChange={(e) => setForm({ ...form, extra_guest_fee: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_refundable} onCheckedChange={(v) => setForm({ ...form, is_refundable: v })} />
              <Label>Refundable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ SEASONAL RULES TAB ============

function SeasonalRulesTab({ propertyId, isAdmin }: { propertyId?: string; isAdmin: boolean }) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', start_date: undefined as Date | undefined, end_date: undefined as Date | undefined,
    modifier_type: 'percent', modifier_value: '', priority: '0',
  });

  const fetchRules = async () => {
    if (!propertyId) return;
    const { data } = await supabase.from('seasonal_rules').select('*').eq('property_id', propertyId).order('start_date');
    setRules(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, [propertyId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', start_date: undefined, end_date: undefined, modifier_type: 'percent', modifier_value: '', priority: '0' });
    setShowDialog(true);
  };

  const openEdit = (rule: any) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      start_date: new Date(rule.start_date + 'T00:00:00'),
      end_date: new Date(rule.end_date + 'T00:00:00'),
      modifier_type: rule.modifier_type,
      modifier_value: String(rule.modifier_value),
      priority: String(rule.priority),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!propertyId || !form.name || !form.start_date || !form.end_date || !form.modifier_value) {
      toast.error('All fields are required');
      return;
    }
    const payload = {
      property_id: propertyId,
      name: form.name,
      start_date: format(form.start_date, 'yyyy-MM-dd'),
      end_date: format(form.end_date, 'yyyy-MM-dd'),
      modifier_type: form.modifier_type,
      modifier_value: parseFloat(form.modifier_value),
      priority: parseInt(form.priority) || 0,
    };

    if (editing) {
      const { error } = await supabase.from('seasonal_rules').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Seasonal rule updated');
    } else {
      const { error } = await supabase.from('seasonal_rules').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Seasonal rule created');
    }
    setShowDialog(false);
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this seasonal rule?')) return;
    await supabase.from('seasonal_rules').delete().eq('id', id);
    toast.success('Deleted');
    fetchRules();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Seasonal Pricing</CardTitle>
          <CardDescription>Adjust prices for peak/off-peak seasons</CardDescription>
        </div>
        {isAdmin && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Rule</Button>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sun className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No seasonal rules defined.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Modifier</TableHead>
                <TableHead>Priority</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.start_date} → {rule.end_date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {rule.modifier_value > 0 ? '+' : ''}{rule.modifier_value}{rule.modifier_type === 'percent' ? '%' : ' LKR'}
                    </Badge>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(rule.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Seasonal Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer Peak" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !form.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarUI mode="single" selected={form.start_date} onSelect={(d) => setForm({ ...form, start_date: d })} className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !form.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarUI mode="single" selected={form.end_date} onSelect={(d) => setForm({ ...form, end_date: d })} className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modifier Type</Label>
                <Select value={form.modifier_type} onValueChange={(v) => setForm({ ...form, modifier_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (LKR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" value={form.modifier_value} onChange={(e) => setForm({ ...form, modifier_value: e.target.value })} placeholder="e.g. 20" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Priority (higher = applied first)</Label>
              <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ DAY OF WEEK TAB ============

function DayOfWeekTab({ propertyId, isAdmin }: { propertyId?: string; isAdmin: boolean }) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ day_of_week: '5', modifier_type: 'percent', modifier_value: '' });

  const fetchRules = async () => {
    if (!propertyId) return;
    const { data } = await supabase.from('day_of_week_rules').select('*').eq('property_id', propertyId).order('day_of_week');
    setRules(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, [propertyId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ day_of_week: '5', modifier_type: 'percent', modifier_value: '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!propertyId || !form.modifier_value) { toast.error('Value is required'); return; }
    const payload = {
      property_id: propertyId,
      day_of_week: parseInt(form.day_of_week),
      modifier_type: form.modifier_type,
      modifier_value: parseFloat(form.modifier_value),
    };

    if (editing) {
      const { error } = await supabase.from('day_of_week_rules').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Updated');
    } else {
      const { error } = await supabase.from('day_of_week_rules').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Created');
    }
    setShowDialog(false);
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await supabase.from('day_of_week_rules').delete().eq('id', id);
    toast.success('Deleted');
    fetchRules();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Day of Week Pricing</CardTitle>
          <CardDescription>Set price adjustments for specific days</CardDescription>
        </div>
        {isAdmin && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Rule</Button>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No day-of-week rules defined.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{DAY_NAMES[rule.day_of_week]}</p>
                    <Badge variant="outline" className="mt-1">
                      {rule.modifier_value > 0 ? '+' : ''}{rule.modifier_value}{rule.modifier_type === 'percent' ? '%' : ' LKR'}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Day-of-Week Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.modifier_type} onValueChange={(v) => setForm({ ...form, modifier_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" value={form.modifier_value} onChange={(e) => setForm({ ...form, modifier_value: e.target.value })} placeholder="e.g. 20" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ DISCOUNT CODES TAB ============

function DiscountCodesTab({ propertyId, isAdmin }: { propertyId?: string; isAdmin: boolean }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: '', discount_type: 'percent', discount_value: '', max_usage: '',
    start_date: undefined as Date | undefined, end_date: undefined as Date | undefined,
  });

  const fetchCodes = async () => {
    if (!propertyId) return;
    const { data } = await supabase.from('discount_codes').select('*').eq('property_id', propertyId).order('code');
    setCodes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, [propertyId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', discount_type: 'percent', discount_value: '', max_usage: '', start_date: undefined, end_date: undefined });
    setShowDialog(true);
  };

  const openEdit = (dc: any) => {
    setEditing(dc);
    setForm({
      code: dc.code, discount_type: dc.discount_type, discount_value: String(dc.discount_value),
      max_usage: dc.max_usage ? String(dc.max_usage) : '',
      start_date: dc.start_date ? new Date(dc.start_date + 'T00:00:00') : undefined,
      end_date: dc.end_date ? new Date(dc.end_date + 'T00:00:00') : undefined,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!propertyId || !form.code || !form.discount_value) {
      toast.error('Code and value are required');
      return;
    }
    const payload = {
      property_id: propertyId,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_usage: form.max_usage ? parseInt(form.max_usage) : null,
      start_date: form.start_date ? format(form.start_date, 'yyyy-MM-dd') : null,
      end_date: form.end_date ? format(form.end_date, 'yyyy-MM-dd') : null,
    };

    if (editing) {
      const { error } = await supabase.from('discount_codes').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Discount code updated');
    } else {
      const { error } = await supabase.from('discount_codes').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Discount code created');
    }
    setShowDialog(false);
    fetchCodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount code?')) return;
    await supabase.from('discount_codes').delete().eq('id', id);
    toast.success('Deleted');
    fetchCodes();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Discount Codes</CardTitle>
          <CardDescription>Create promotional codes for direct bookings</CardDescription>
        </div>
        {isAdmin && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Code</Button>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No discount codes yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Max Usage</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((dc) => (
                <TableRow key={dc.id}>
                  <TableCell className="font-mono font-bold">{dc.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {dc.discount_value}{dc.discount_type === 'percent' ? '%' : ' LKR'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dc.start_date && dc.end_date
                      ? `${dc.start_date} → ${dc.end_date}`
                      : 'No expiry'}
                  </TableCell>
                  <TableCell>{dc.max_usage || '∞'}</TableCell>
                  <TableCell>
                    <Badge variant={dc.is_active ? 'default' : 'secondary'}>
                      {dc.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(dc)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(dc.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Discount Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SUMMER20" className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (LKR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !form.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, 'PPP') : 'Optional'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarUI mode="single" selected={form.start_date} onSelect={(d) => setForm({ ...form, start_date: d })} className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !form.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, 'PPP') : 'Optional'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarUI mode="single" selected={form.end_date} onSelect={(d) => setForm({ ...form, end_date: d })} className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max Usage (leave empty for unlimited)</Label>
              <Input type="number" value={form.max_usage} onChange={(e) => setForm({ ...form, max_usage: e.target.value })} placeholder="Unlimited" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
