import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Info, AlertTriangle,
  CalendarDays, LogIn, Wrench, Wifi, Megaphone,
  ChevronRight, BellRing,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  property_id: string | null;
  user_id: string | null;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  target_roles: string[] | null;
  action_type: string | null;
  action_entity_id: string | null;
  expires_at: string | null;
}

type FilterTab = 'all' | 'high' | 'booking' | 'system';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'booking', label: 'Bookings' },
  { key: 'system', label: 'System' },
];

// Role-based action permissions
const ACTION_ROLE_MAP: Record<string, string[]> = {
  check_in: ['admin', 'manager', 'front_desk'],
  check_out: ['admin', 'manager', 'front_desk'],
  view_booking: ['admin', 'manager', 'front_desk', 'viewer'],
  retry_sync: ['admin', 'manager'],
  view_room: ['admin', 'manager', 'front_desk', 'viewer'],
  assign_staff: ['admin', 'manager'],
};

function getCategoryIcon(category: string) {
  switch (category) {
    case 'booking': return <CalendarDays className="h-4 w-4" />;
    case 'checkin_checkout': return <LogIn className="h-4 w-4" />;
    case 'availability': return <AlertTriangle className="h-4 w-4" />;
    case 'maintenance': return <Wrench className="h-4 w-4" />;
    case 'channel_sync': return <Wifi className="h-4 w-4" />;
    case 'general': return <Megaphone className="h-4 w-4" />;
    default: return <Info className="h-4 w-4" />;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return 'text-destructive';
    case 'medium': return 'text-warning';
    default: return 'text-muted-foreground';
  }
}

function getPriorityDot(priority: string) {
  switch (priority) {
    case 'high': return 'bg-destructive';
    case 'medium': return 'bg-warning';
    default: return 'bg-muted-foreground';
  }
}

function getActionLabel(actionType: string | null): string | null {
  switch (actionType) {
    case 'check_in': return 'Check In';
    case 'check_out': return 'Check Out';
    case 'view_booking': return 'View';
    case 'retry_sync': return 'Retry';
    case 'view_room': return 'View Room';
    case 'assign_staff': return 'Assign';
    default: return null;
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { selectedProperty, showAllProperties } = useProperty();
  const { role } = useAuth();
  const { permission, requestPermission } = useBrowserNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const fetchNotifications = async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (selectedProperty && !showAllProperties) {
        query = query.eq('property_id', selectedProperty.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setNotifications(
        (data || []).map((n: any) => ({
          ...n,
          category: n.category || n.type || 'general',
          priority: n.priority || 'medium',
          target_roles: n.target_roles || null,
          action_type: n.action_type || null,
          action_entity_id: n.action_entity_id || null,
          expires_at: n.expires_at || null,
        }))
      );
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [selectedProperty, showAllProperties]);

  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedProperty, showAllProperties]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'high':
        return notifications.filter((n) => n.priority === 'high');
      case 'booking':
        return notifications.filter((n) => ['booking', 'checkin_checkout'].includes(n.category));
      case 'system':
        return notifications.filter((n) => ['channel_sync', 'maintenance', 'availability'].includes(n.category));
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    }
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const handleAction = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark notifications as read');
    }
  };

  const canPerformAction = (actionType: string | null): boolean => {
    if (!actionType || !role) return false;
    return (ACTION_ROLE_MAP[actionType] || []).includes(role);
  };

  const formatTime = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-10 sm:w-10">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-2">
            {permission === 'default' && (
              <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-primary gap-1" onClick={requestPermission}>
                <BellRing className="h-3 w-3" />
                Enable push
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-muted-foreground" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-muted-foreground" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              View all
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 pb-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                activeFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Separator />

        {/* List */}
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    'w-full flex gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors',
                    !n.is_read && 'bg-accent/30'
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className={cn('flex-shrink-0 mt-0.5', getPriorityColor(n.priority))}>
                    {getCategoryIcon(n.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', getPriorityDot(n.priority))} />
                      <p className={cn('text-sm truncate', !n.is_read ? 'font-medium' : 'text-foreground')}>
                        {n.title}
                      </p>
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 ml-3">{n.message}</p>
                    )}
                    <div className="flex items-center justify-between mt-1 ml-3">
                      <p className="text-[10px] text-muted-foreground">{formatTime(n.created_at)}</p>
                      {n.action_type && canPerformAction(n.action_type) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-0.5 text-[10px] text-primary hover:text-primary font-medium gap-1"
                          onClick={(e) => handleAction(e, n)}
                        >
                          {getActionLabel(n.action_type)}
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {!n.is_read && (
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
