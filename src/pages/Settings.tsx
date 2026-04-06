import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, UserPlus, Trash2, Shield, Hotel, Users, Clock, UtensilsCrossed, 
  Link2, FileText, AlertTriangle, ShieldCheck, Building2, User, 
  Megaphone, Lock, ChevronRight, HeartPulse, ArrowLeft, BellRing, SlidersHorizontal, DollarSign,
  Search, Star, StarOff, Command
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
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { SystemHealthSettings } from '@/components/settings/SystemHealthSettings';
import { HotelSettings } from '@/components/settings/HotelSettings';
import { OtherSettings } from '@/components/settings/OtherSettings';
import { RateManagementSettings } from '@/components/settings/RateManagementSettings';
import { AuditLogViewer } from '@/components/settings/AuditLogViewer';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserSettings } from '@/hooks/useUserSettings';

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

type SettingsSection = 'access' | 'property' | 'rates' | 'notifications' | 'guests' | 'services' | 'channels' | 'reports' | 'security' | 'audit-logs' | 'system-health' | 'other';

interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: typeof Shield;
  description: string;
  keywords: string[];
  adminOnly?: boolean;
}

interface GroupConfig {
  id: string;
  label: string;
  sections: SectionConfig[];
}

const SECTION_CONFIG: SectionConfig[] = [
  { id: 'property', label: 'Property', icon: Building2, description: 'Name, times, currency, tax', keywords: ['hotel', 'name', 'check-in', 'checkout', 'currency', 'tax', 'timezone'] },
  { id: 'other', label: 'Other Settings', icon: SlidersHorizontal, description: 'Pages, theme, preferences', keywords: ['theme', 'dark mode', 'light mode', 'sidebar', 'landing page'] },
  { id: 'rates', label: 'Rate Management', icon: DollarSign, description: 'Plans, seasons, pricing', keywords: ['pricing', 'rates', 'seasons', 'discounts', 'occupancy'], adminOnly: true },
  { id: 'services', label: 'Services', icon: UtensilsCrossed, description: 'Service catalog and pricing', keywords: ['services', 'amenities', 'extras', 'add-ons'] },
  { id: 'channels', label: 'Channel Manager', icon: Megaphone, description: 'OTA connections and sync', keywords: ['ota', 'booking.com', 'airbnb', 'expedia', 'agoda', 'ical'] },
  { id: 'access', label: 'Access & Roles', icon: ShieldCheck, description: 'Users, staff, and permissions', keywords: ['users', 'staff', 'roles', 'permissions', 'admin', 'manager'] },
  { id: 'guests', label: 'Guest Settings', icon: User, description: 'Guest list and management', keywords: ['guests', 'customers', 'vip', 'blacklist'] },
  { id: 'notifications', label: 'Notifications', icon: BellRing, description: 'Alert preferences & delivery', keywords: ['alerts', 'notifications', 'push', 'email'] },
  { id: 'reports', label: 'Reports', icon: FileText, description: 'Reports and data exports', keywords: ['reports', 'export', 'analytics', 'statistics'] },
  { id: 'security', label: 'Security & Data', icon: Lock, description: 'Data management and danger zone', keywords: ['danger', 'delete', 'reset', 'clear data', 'security'], adminOnly: true },
  { id: 'audit-logs', label: 'Audit Logs', icon: FileText, description: 'Activity history and tracking', keywords: ['audit', 'logs', 'history', 'activity', 'tracking'], adminOnly: true },
  { id: 'system-health', label: 'System Health', icon: HeartPulse, description: 'Diagnostics and validation', keywords: ['health', 'diagnostics', 'validation', 'errors'], adminOnly: true },
];

const GROUPS: GroupConfig[] = [
  { id: 'basics', label: 'Basics', sections: SECTION_CONFIG.filter(s => ['property', 'other'].includes(s.id)) },
  { id: 'operations', label: 'Operations', sections: SECTION_CONFIG.filter(s => ['rates', 'services', 'channels'].includes(s.id)) },
  { id: 'people', label: 'People', sections: SECTION_CONFIG.filter(s => ['access', 'guests'].includes(s.id)) },
  { id: 'comms', label: 'Comms & Insights', sections: SECTION_CONFIG.filter(s => ['notifications', 'reports'].includes(s.id)) },
  { id: 'advanced', label: 'Advanced', sections: SECTION_CONFIG.filter(s => ['security', 'audit-logs', 'system-health'].includes(s.id)) },
];

// Map old tab names to new section IDs for backward compatibility
const TAB_ALIAS: Record<string, SettingsSection> = {
  users: 'access',
  staff: 'access',
  hotel: 'property',
  danger: 'security',
};

export default function Settings() {
  const { isAdmin, user, canWrite, loading: authLoading, role } = useAuth();
  const { settings: userSettings, saveSettings: saveUserSettings } = useUserSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const rawTab = searchParams.get('tab') || 'property';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-expand group containing active section
  useEffect(() => {
    const group = GROUPS.find(g => g.sections.some(s => s.id === activeSection));
    if (group && !expandedGroups.includes(group.id)) {
      setExpandedGroups(prev => [...prev, group.id]);
    }
  }, [activeSection]);

  useEffect(() => {
    if (!authLoading && (!user || !role)) {
      navigate('/auth');
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    fetchStaff();
    fetchPendingUsers();
  }, []);

  const favoriteSettings = userSettings.favorite_settings || [];

  const toggleFavorite = (sectionId: string) => {
    const newFavorites = favoriteSettings.includes(sectionId)
      ? favoriteSettings.filter(f => f !== sectionId)
      : [...favoriteSettings, sectionId];
    saveUserSettings({ favorite_settings: newFavorites });
  };

  const visibleSections = useMemo(() => {
    return SECTION_CONFIG.filter(s => !s.adminOnly || isAdmin);
  }, [isAdmin]);

  const filteredGroups = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return GROUPS.map(g => ({
        ...g,
        sections: g.sections.filter(s => !s.adminOnly || isAdmin)
      })).filter(g => g.sections.length > 0);
    }

    const query = debouncedSearch.toLowerCase();
    return GROUPS.map(g => ({
      ...g,
      sections: g.sections.filter(s => {
        if (s.adminOnly && !isAdmin) return false;
        return (
          s.label.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.keywords.some(k => k.toLowerCase().includes(query))
        );
      })
    })).filter(g => g.sections.length > 0);
  }, [debouncedSearch, isAdmin]);

  const favoriteSections = useMemo(() => {
    return visibleSections.filter(s => favoriteSettings.includes(s.id));
  }, [visibleSections, favoriteSettings]);

  const currentSection = SECTION_CONFIG.find(s => s.id === activeSection);
  const currentGroup = GROUPS.find(g => g.sections.some(s => s.id === activeSection));

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

  const renderContent = () => {
    switch (activeSection) {
      case 'access':
        return renderAccessRoles();
      case 'property':
        return <HotelSettings />;
      case 'rates':
        return isAdmin ? <RateManagementSettings /> : null;
      case 'notifications':
        return <NotificationSettings />;
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
      case 'system-health':
        return isAdmin ? <SystemHealthSettings /> : null;
      case 'other':
        return <OtherSettings />;
      default:
        return <HotelSettings />;
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
                            size="sm"
                            className="text-destructive hover:text-destructive"
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
    </div>
  );

  const renderSidebar = () => (
    <div className="flex flex-col h-full">
      {/* Favorites Section */}
      {favoriteSections.length > 0 && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            <Star className="h-3 w-3" />
            Favorites
          </div>
          <div className="flex flex-wrap gap-1.5">
            {favoriteSections.map(section => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {section.label}
                </Button>
              );
            })}
          </div>
          <Separator className="mt-3" />
        </div>
      )}

      {/* Groups Accordion */}
      <ScrollArea className="flex-1">
        <Accordion
          type="multiple"
          value={expandedGroups}
          onValueChange={setExpandedGroups}
          className="px-2"
        >
          {filteredGroups.map(group => (
            <AccordionItem key={group.id} value={group.id} className="border-none">
              <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded-lg text-sm font-medium">
                <span className="flex items-center gap-2">
                  {group.label}
                  <Badge variant="secondary" className="h-5 text-[10px] font-normal">
                    {group.sections.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-1 pt-0">
                <div className="flex flex-col gap-0.5 pl-2">
                  {group.sections.map(section => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    const isFavorite = favoriteSettings.includes(section.id);
                    return (
                      <div
                        key={section.id}
                        className={cn(
                          'group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                        )}
                        onClick={() => setActiveSection(section.id)}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{section.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{section.description}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(section.id);
                          }}
                          className={cn(
                            'opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background',
                            isFavorite && 'opacity-100'
                          )}
                        >
                          {isFavorite ? (
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          ) : (
                            <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
          <div className="flex-1 max-w-md ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-16"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar - Desktop */}
        {!isMobile && (
          <div className="w-72 border-r bg-muted/30 flex-shrink-0">
            {renderSidebar()}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-4xl mx-auto">
            {/* Breadcrumbs */}
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
                </BreadcrumbItem>
                {currentGroup && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-muted-foreground">{currentGroup.label}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
                {currentSection && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentSection.label}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Mobile Navigation */}
            {isMobile && (
              <div className="mb-6">
                <Accordion
                  type="multiple"
                  value={expandedGroups}
                  onValueChange={setExpandedGroups}
                >
                  {filteredGroups.map(group => (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger className="text-sm">
                        <span className="flex items-center gap-2">
                          {group.label}
                          <Badge variant="secondary" className="h-5 text-[10px]">
                            {group.sections.length}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col gap-1">
                          {group.sections.map(section => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                              <Button
                                key={section.id}
                                variant={isActive ? 'secondary' : 'ghost'}
                                className="justify-start h-auto py-2"
                                onClick={() => setActiveSection(section.id)}
                              >
                                <Icon className="h-4 w-4 mr-2" />
                                <div className="text-left">
                                  <div className="font-medium">{section.label}</div>
                                  <div className="text-xs text-muted-foreground">{section.description}</div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {/* Section Content */}
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Add a new staff member by their email. They must have signed up first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="staff@hotel.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
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

      <Dialog open={showAssignRole} onOpenChange={setShowAssignRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assign-role">Role</Label>
              <Select value={assignRole} onValueChange={(v: any) => setAssignRole(v)}>
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
            <Button variant="outline" onClick={() => setShowAssignRole(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={saving}>
              {saving ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
