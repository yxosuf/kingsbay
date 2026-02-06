import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, UserPlus, Trash2, Shield, Hotel, Users, Clock, UtensilsCrossed, Link2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { ServicesSettings } from '@/components/settings/ServicesSettings';
import { ChannelsSettings } from '@/components/settings/ChannelsSettings';
import { ReportsSettings } from '@/components/settings/ReportsSettings';

interface StaffMember {
  user_id: string;
  role: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

interface PendingUser {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [assignRole, setAssignRole] = useState<'admin' | 'manager' | 'front_desk'>('front_desk');
  const [saving, setSaving] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('front_desk');

  useEffect(() => {
    fetchStaff();
    fetchPendingUsers();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .order('role');

      if (error) throw error;
      
      const userIds = roles?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const staffData = roles?.map(r => ({
        user_id: r.user_id,
        role: r.role,
        profiles: profiles?.find(p => p.id === r.user_id) || null
      })) || [];

      setStaff(staffData as any);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id');

      if (rolesError) throw rolesError;

      const userIdsWithRoles = new Set(roles?.map(r => r.user_id) || []);
      const pending = (allProfiles || []).filter(p => !userIdsWithRoles.has(p.id));
      
      setPendingUsers(pending);
    } catch (error) {
      console.error('Error fetching pending users:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: selectedUser.id,
        role: assignRole,
      });

      if (error) throw error;

      toast.success(`Role assigned to ${selectedUser.full_name || selectedUser.email}`);
      setShowAssignRole(false);
      setSelectedUser(null);
      setAssignRole('front_desk');
      fetchStaff();
      fetchPendingUsers();
    } catch (error: any) {
      logError('Error assigning role', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openAssignRoleDialog = (pendingUser: PendingUser) => {
    setSelectedUser(pendingUser);
    setAssignRole('front_desk');
    setShowAssignRole(true);
  };

  const handleAddStaff = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSaving(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newEmail.trim())
        .single();

      if (profileError || !profile) {
        toast.error('User not found. They must sign up first.');
        return;
      }

      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: profile.id,
        role: newRole as 'admin' | 'front_desk' | 'manager',
      });

      if (roleError) {
        if (roleError.message.includes('duplicate')) {
          toast.error('This user already has a role assigned');
        } else {
          throw roleError;
        }
        return;
      }

      toast.success('Staff member added successfully');
      setShowAddStaff(false);
      setNewEmail('');
      setNewRole('front_desk');
      fetchStaff();
    } catch (error: any) {
      logError('Error adding staff', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (userId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }

    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Staff member removed');
      fetchStaff();
    } catch (error: any) {
      logError('Error removing staff', error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  const handleChangeRole = async (userId: string, role: 'admin' | 'manager' | 'front_desk') => {
    if (userId === user?.id) {
      toast.error("You can't change your own role");
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Role updated');
      fetchStaff();
    } catch (error: any) {
      logError('Error updating role', error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, string> = {
      admin: 'bg-destructive/20 text-destructive border-destructive',
      manager: 'bg-warning/20 text-warning-foreground border-warning',
      front_desk: 'bg-info/20 text-info border-info',
    };

    return (
      <Badge variant="outline" className={variants[role] || ''}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6">
        <Tabs defaultValue="users">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="hotel" className="flex items-center gap-2">
              <Hotel className="h-4 w-4" />
              Hotel
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Users
                  </CardTitle>
                  <CardDescription>
                    Users who have signed up but haven't been assigned a role yet
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPending ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending users. All signed-up users have roles assigned.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Signed Up</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((pendingUser) => (
                        <TableRow key={pendingUser.id}>
                          <TableCell className="font-medium">
                            {pendingUser.full_name || 'No name provided'}
                          </TableCell>
                          <TableCell>{pendingUser.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(pendingUser.created_at).toLocaleDateString()}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => openAssignRoleDialog(pendingUser)}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Assign Role
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Staff Members
                  </CardTitle>
                  <CardDescription>
                    Manage staff accounts and their access levels
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={() => setShowAddStaff(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Staff
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : staff.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No staff members found.
                    {isAdmin && (
                      <Button
                        variant="link"
                        onClick={() => setShowAddStaff(true)}
                        className="ml-1"
                      >
                        Add one now
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.map((member) => (
                        <TableRow key={member.user_id}>
                          <TableCell className="font-medium">
                            {member.profiles?.full_name || 'Unknown'}
                            {member.user_id === user?.id && (
                              <span className="text-muted-foreground ml-2">(You)</span>
                            )}
                          </TableCell>
                          <TableCell>{member.profiles?.email}</TableCell>
                          <TableCell>
                            {isAdmin && member.user_id !== user?.id ? (
                              <Select
                                value={member.role}
                                onValueChange={(value: 'admin' | 'manager' | 'front_desk') =>
                                  handleChangeRole(member.user_id, value)
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="front_desk">Front Desk</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              getRoleBadge(member.role)
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              {member.user_id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => handleRemoveStaff(member.user_id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Role Permissions Info */}
            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {getRoleBadge('admin')}
                    <div>
                      <p className="font-medium">Admin</p>
                      <p className="text-sm text-muted-foreground">
                        Full access to all features including staff management, room
                        configuration, and service settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    {getRoleBadge('manager')}
                    <div>
                      <p className="font-medium">Manager</p>
                      <p className="text-sm text-muted-foreground">
                        Can manage bookings, view reports, update room status. Cannot manage
                        staff or system settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    {getRoleBadge('front_desk')}
                    <div>
                      <p className="font-medium">Front Desk</p>
                      <p className="text-sm text-muted-foreground">
                        Can create/edit bookings, check-in/out guests, add services to guest
                        accounts.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            <ServicesSettings />
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels" className="mt-6">
            <ChannelsSettings />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            <ReportsSettings />
          </TabsContent>

          {/* Hotel Tab */}
          <TabsContent value="hotel" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hotel className="h-5 w-5" />
                  Hotel Information
                </CardTitle>
                <CardDescription>
                  Configure your hotel details and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hotel Name</Label>
                    <Input value="King's Bay Villa" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value="Colombo, Sri Lanka" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input value="10" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value="LKR (Rs.)" disabled />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Contact support to update hotel information.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Add an existing user as a staff member. They must have signed up first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="staff@kingsbay.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="front_desk">Front Desk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStaff(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff} disabled={saving}>
              {saving ? 'Adding...' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={showAssignRole} onOpenChange={(open) => {
        setShowAssignRole(open);
        if (!open) {
          setSelectedUser(null);
          setAssignRole('front_desk');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {selectedUser?.full_name || selectedUser?.email || 'this user'} to grant them access to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Input
                value={`${selectedUser?.full_name || 'No name'} (${selectedUser?.email || 'No email'})`}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={assignRole} onValueChange={(v) => setAssignRole(v as 'admin' | 'manager' | 'front_desk')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                  <SelectItem value="manager">Manager - Manage bookings & reports</SelectItem>
                  <SelectItem value="front_desk">Front Desk - Basic operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignRole(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={saving}>
              {saving ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
