import { 
  LayoutDashboard, 
  CalendarPlus, 
  BookOpen, 
  BedDouble, 
  Settings,
  Crown,
  LogOut,
  Building2,
  MonitorSmartphone,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useUserSettings } from '@/hooks/useUserSettings';

const mainNavItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Front Desk', url: '/front-desk', icon: MonitorSmartphone },
  { title: 'New Booking', url: '/bookings/new', icon: CalendarPlus },
  { title: 'Bookings', url: '/bookings', icon: BookOpen },
  { title: 'Room Status', url: '/rooms', icon: BedDouble },
  { title: 'Availability', url: '/availability', icon: CalendarPlus },
];

const systemNavItems = [
  { title: 'Properties', url: '/properties', icon: Building2, adminOnly: true },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, role, isAdmin } = useAuth();
  const { selectedProperty } = useProperty();
  const { settings: userSettings } = useUserSettings();
  const [popoverOpen, setPopoverOpen] = useState(false);

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
    setPopoverOpen(false);
    await signOut();
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSettingsClick = () => {
    setPopoverOpen(false);
    if (state === 'expanded' && !isMobile) {
      toggleSidebar();
    }
    navigate('/settings');
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const filteredSystemNavItems = systemNavItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const initials = (profile?.full_name || 'S')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border hidden md:flex">
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

      <div className="h-px bg-gradient-to-r from-transparent via-sidebar-ring/30 to-transparent" />

      {/* Main Navigation */}
      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      onClick={() => handleNavClick(item.url)}
                      className={cn(
                        "cursor-pointer transition-all duration-150 relative",
                        active && "font-semibold"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-ring" />
                      )}
                      <item.icon className={cn("h-4 w-4", active && "text-sidebar-ring")} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSystemNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      onClick={() => handleNavClick(item.url)}
                      className={cn(
                        "cursor-pointer transition-all duration-150 relative",
                        active && "font-semibold"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-ring" />
                      )}
                      <item.icon className={cn("h-4 w-4", active && "text-sidebar-ring")} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Popover */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 px-1 w-full rounded-lg py-1.5 hover:bg-sidebar-accent transition-colors cursor-pointer",
                collapsed && !isMobile && "justify-center px-0"
              )}
            >
              <div className={cn(
                "shrink-0 flex items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold",
                collapsed && !isMobile ? "h-8 w-8" : "h-9 w-9"
              )}>
                {initials}
              </div>
              {(!collapsed || isMobile) && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || 'Staff Member'}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">
                    {role?.replace('_', ' ') || 'No role'}
                  </p>
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side={collapsed && !isMobile ? "right" : "top"}
            align="start"
            sideOffset={8}
            className="w-56 p-0"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-medium truncate">
                {profile?.full_name || 'Staff Member'}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {role?.replace('_', ' ') || 'No role'}
              </p>
            </div>
            {/* Actions */}
            <div className="p-1">
              <button
                onClick={handleSettingsClick}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
}
