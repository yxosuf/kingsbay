import { 
  LayoutDashboard, 
  CalendarPlus, 
  BookOpen, 
  BedDouble, 
  UtensilsCrossed, 
  Users,
  FileText,
  Settings,
  Crown,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const mainNavItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'New Booking', url: '/bookings/new', icon: CalendarPlus },
  { title: 'Bookings', url: '/bookings', icon: BookOpen },
  { title: 'Room Status', url: '/rooms', icon: BedDouble },
  { title: 'Services', url: '/services', icon: UtensilsCrossed },
  { title: 'Guests', url: '/guests', icon: Users },
  { title: 'Reports', url: '/reports', icon: FileText },
];

const systemNavItems = [
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, profile, role } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    // For /bookings, only match exact path (not /bookings/new or /bookings/:id)
    if (path === '/bookings') return location.pathname === '/bookings';
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Crown className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">King's Bay</span>
              <span className="text-xs text-sidebar-foreground/60">Villa</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'Staff Member'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {role?.replace('_', ' ') || 'No role'}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={handleSignOut}
            className={cn(
              "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              !collapsed && "w-full justify-start"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
