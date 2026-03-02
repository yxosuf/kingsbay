import { 
  LayoutDashboard, 
  CalendarPlus, 
  BookOpen, 
  BedDouble, 
  Users,
  Settings,
  Crown,
  LogOut,
  Building2
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProperty } from '@/hooks/useProperty';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const mainNavItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'New Booking', url: '/bookings/new', icon: CalendarPlus },
  { title: 'Bookings', url: '/bookings', icon: BookOpen },
  { title: 'Room Status', url: '/rooms', icon: BedDouble },
  { title: 'Availability', url: '/availability', icon: CalendarPlus },
];

const systemNavItems = [
  { title: 'Properties', url: '/properties', icon: Building2, adminOnly: true },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, role, isAdmin } = useAuth();
  const { selectedProperty } = useProperty();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/bookings') return location.pathname === '/bookings';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (url: string) => {
    navigate(url);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter system nav items based on role
  const filteredSystemNavItems = systemNavItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className={cn(
        "border-b border-sidebar-border",
        collapsed && !isMobile ? "p-2 flex justify-center" : "p-4"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex",
            collapsed && !isMobile ? "h-8 w-8" : "h-10 w-10"
          )}>
            <Crown className={cn(collapsed && !isMobile ? "h-4 w-4" : "h-5 w-5")} />
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sidebar-foreground truncate">
                {selectedProperty?.name || "King's Bay"}
              </span>
              <span className="text-xs text-sidebar-foreground/60 capitalize">
                {selectedProperty?.property_type || 'Villa'}
              </span>
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
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => handleNavClick(item.url)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
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
              {filteredSystemNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => handleNavClick(item.url)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {(!collapsed || isMobile) && (
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
            size={(collapsed && !isMobile) ? 'icon' : 'sm'}
            onClick={handleSignOut}
            className={cn(
              "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              (!collapsed || isMobile) && "w-full justify-start"
            )}
          >
            <LogOut className="h-4 w-4" />
            {(!collapsed || isMobile) && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
