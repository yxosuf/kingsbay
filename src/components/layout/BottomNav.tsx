import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, BookOpen, Plus, MoreHorizontal, BedDouble, MonitorSmartphone, Building2, Settings, LogOut, Wifi, Bell } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const primaryTabs = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Availability', url: '/availability', icon: CalendarDays },
  { title: 'Bookings', url: '/bookings', icon: BookOpen },
  { title: 'New', url: '/bookings/new', icon: Plus, accent: true },
];

const moreMenuItems = [
  { title: 'Rooms', url: '/rooms', icon: BedDouble },
  { title: 'Front Desk', url: '/front-desk', icon: MonitorSmartphone },
  { title: 'Channel Manager', url: '/channels', icon: Wifi },
  { title: 'Properties', url: '/properties', icon: Building2, adminOnly: true },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (url: string) => {
    navigate(url);
    setSheetOpen(false);
  };

  const handleSignOut = async () => {
    setSheetOpen(false);
    await signOut();
  };

  const filteredMoreItems = moreMenuItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {primaryTabs.map((tab) => {
          const active = isActive(tab.url);
          return (
            <button
              key={tab.title}
              onClick={() => handleNav(tab.url)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-full px-2 transition-colors",
                tab.accent && "relative"
              )}
            >
              {tab.accent ? (
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary text-primary-foreground shadow-md -mt-3">
                  <tab.icon className="h-5 w-5" />
                </div>
              ) : (
                <>
                  <tab.icon className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}>
                    {tab.title}
                  </span>
                  {active && (
                    <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-primary" />
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* More tab with sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-full px-2 relative">
              <MoreHorizontal className={cn(
                "h-5 w-5 transition-colors",
                sheetOpen ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                sheetOpen ? "text-primary" : "text-muted-foreground"
              )}>
                More
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe-bottom">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-left">Menu</SheetTitle>
            </SheetHeader>
            <div className="space-y-1">
              {filteredMoreItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <Button
                    key={item.title}
                    variant={active ? "secondary" : "ghost"}
                    className="w-full justify-start h-12 text-base gap-3"
                    onClick={() => handleNav(item.url)}
                  >
                    <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                    {item.title}
                  </Button>
                );
              })}
            </div>
            <Separator className="my-3" />
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-base gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
