import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { 
  Plus, UserPlus, Trash2, Shield, Hotel, Users, Clock, UtensilsCrossed, 
  Link2, FileText, AlertTriangle, ShieldCheck, Building2, User, 
  Megaphone, Lock, ChevronRight, HeartPulse
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { ServicesSettings } from '@/components/settings/ServicesSettings';
import { ChannelsSettings } from '@/components/settings/ChannelsSettings';
import { ReportsSettings } from '@/components/settings/ReportsSettings';
import { GuestsSettings } from '@/components/settings/GuestsSettings';
import { DangerZoneSettings } from '@/components/settings/DangerZoneSettings';
import { SystemHealthSettings } from '@/components/settings/SystemHealthSettings';
import { HotelSettings } from '@/components/settings/HotelSettings';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

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

type SettingsSection = 'access' | 'property' | 'guests' | 'services' | 'channels' | 'reports' | 'security';

const SETTINGS_NAV: { id: SettingsSection; label: string; icon: typeof Shield; description: string; adminOnly?: boolean }[] = [
  { id: 'access', label: 'Access & Roles', icon: ShieldCheck, description: 'Users, staff, and permissions' },
  { id: 'property', label: 'Property', icon: Building2, description: 'Name, times, currency, tax' },
  { id: 'guests', label: 'Guest Settings', icon: User, description: 'Guest list and management' },
  { id: 'services', label: 'Services', icon: UtensilsCrossed, description: 'Service catalog and pricing' },
  { id: 'channels', label: 'Channel Manager', icon: Megaphone, description: 'OTA connections and sync' },
  { id: 'reports', label: 'Reports', icon: FileText, description: 'Reports and data exports' },
  { id: 'security', label: 'Security & Data', icon: Lock, description: 'Data management and danger zone', adminOnly: true },
];

// Map old tab names to new section IDs for backward compatibility
const TAB_ALIAS: Record<string, SettingsSection> = {
  users: 'access',
  staff: 'access',
  hotel: 'property',
  danger: 'security',
};

export default function Settings() {
  const { isAdmin, user, canWrite } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const rawTab = searchParams.get('tab') || 'access';
  const activeSection: SettingsSection = (TAB_ALIAS[rawTab] || rawTab) as SettingsSection;

  const setActiveSection = (section: SettingsSection) => {
    setSearchParams({ tab: section });
  };

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
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId);
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
      const { error } = await supabase.from('user_roles').update({ role }).eq('user_id', userId);
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
      viewer: 'bg-muted text-muted-foreground border-muted-foreground/30',
    };
    return (
      <Badge variant="outline" className={variants[role] || ''}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const visibleNav = SETTINGS_NAV.filter(item => !item.adminOnly || isAdmin);

  const renderContent = () => {
    switch (activeSection) {
      case 'access':
        return renderAccessRoles();
      case 'property':
        return <HotelSettings />;
      case 'guests':
        return <GuestsSettings />;
      case 'services':
        return <ServicesSettings />;
      case 'channels':
        return <ChannelsSettings />;
      case 'reports':
        return <ReportsSettings />;
      case 'security':
        return isAdmin ? <DangerZoneSettings /> : null;
      default:
        return renderAccessRoles();
    }
  };

  const renderAccessRoles = () => (
    <div className="space-y-6">
      {/* Pending Users */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Users
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingUsers.length}
                </Badge>
              )}
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
                        <Button size="sm" onClick={() => openAssignRoleDialog(pendingUser)}>
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

      {/* Staff Members */}
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
                <Button variant="link" onClick={() => setShowAddStaff(true)} className="ml-1">
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
                            <SelectItem value="viewer">Viewer</SelectItem>
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

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { role: 'admin', title: 'Admin', desc: 'Full access to all features including staff management, room configuration, and service settings.' },
              { role: 'manager', title: 'Manager', desc: 'Can manage bookings, view reports, update room status. Cannot manage staff or system settings.' },
              { role: 'front_desk', title: 'Front Desk', desc: 'Can create/edit bookings, check-in/out guests, add services to guest accounts.' },
              { role: 'viewer', title: 'Viewer', desc: 'Read-only access. Can view dashboard, bookings, availability, guests, and reports. Cannot create, edit, or delete anything.' },
            ].map(({ role, title, desc }) => (
              <div key={role} className="flex items-start gap-4">
                {getRoleBadge(role)}
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardLayout title="Settings">
      <div className={cn(
        "flex gap-6",
        isMobile ? "flex-col" : "flex-row"
      )}>
        {/* Vertical Sidebar Navigation */}
        {isMobile ? (
          // Mobile: horizontal scroll nav
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : (
          // Desktop: vertical sidebar
          <div className="w-64 shrink-0">
            <nav className="sticky top-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
                Settings
              </p>
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const showBadge = item.id === 'access' && pendingUsers.length > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      item.id === 'security' && !isActive && "text-destructive/70 hover:text-destructive"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.label}</span>
                      {!isActive && (
                        <p className="text-xs opacity-60 truncate mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {showBadge && (
                      <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                        {pendingUsers.length}
                      </Badge>
                    )}
                    <ChevronRight className={cn(
                      "h-4 w-4 shrink-0 transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                    )} />
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
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
                  <SelectItem value="viewer">Viewer</SelectItem>
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
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
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
