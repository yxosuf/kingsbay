import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PropertySelector } from './PropertySelector';
import { NotificationBell } from './NotificationBell';
import { useProperty } from '@/hooks/useProperty';

interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { properties } = useProperty();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Colombo',
    });
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-card px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-base sm:text-xl font-semibold text-foreground truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Property Selector - only show if properties exist */}
        {properties.length > 0 && <PropertySelector />}
        
        {/* Time Widget */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs text-muted-foreground">Sri Lanka Time</span>
          <span className="text-sm font-mono font-medium text-foreground">
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Notification Bell */}
        <NotificationBell />
      </div>
    </header>
  );
}
