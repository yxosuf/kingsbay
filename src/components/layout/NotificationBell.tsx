import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Info, AlertTriangle,
  CalendarDays, LogIn, Wrench, Wifi, Megaphone,
  ChevronRight, BellRing, Settings2, FileStack,
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
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
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
  image_url: string | null;
  actions: any[] | null;
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
  const { shouldShowNotification } = useNotificationPreferences();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showDigest, setShowDigest] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

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
          image_url: n.image_url || null,
          actions: n.actions || null,
        }))
      );
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [selectedProperty, showAllProperties]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime sync across devices
  useEffect(() => {
    const channel = supabase
      .channel('notifications-bell-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const n = payload.new as any;
          setNotifications(prev => [{
            ...n,
            category: n.category || n.type || 'general',
            priority: n.priority || 'medium',
            target_roles: n.target_roles || null,
            action_type: n.action_type || null,
            action_entity_id: n.action_entity_id || null,
            expires_at: n.expires_at || null,
            image_url: n.image_url || null,
            actions: n.actions || null,
          }, ...prev].slice(0, 50));
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          setNotifications(prev => prev.map(n => n.id === updated.id ? {
            ...n,
            ...updated,
            category: updated.category || updated.type || 'general',
            image_url: updated.image_url || null,
            actions: updated.actions || null,
          } : n));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as any;
          setNotifications(prev => prev.filter(n => n.id !== deleted.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedProperty, showAllProperties]);

  // Separate notifications into visible vs digest based on preferences
  const { visibleNotifications, digestNotifications } = useMemo(() => {
    const visible: Notification[] = [];
    const digest: Notification[] = [];
    for (const n of notifications) {
      if (shouldShowNotification(n.category, n.priority)) {
        visible.push(n);
      } else {
        digest.push(n);
      }
    }
    return { visibleNotifications: visible, digestNotifications: digest };
  }, [notifications, shouldShowNotification]);

  const filtered = useMemo(() => {
    const source = showDigest ? digestNotifications : visibleNotifications;
    switch (activeFilter) {
      case 'high':
        return source.filter((n) => n.priority === 'high');
      case 'booking':
        return source.filter((n) => ['booking', 'checkin_checkout'].includes(n.category));
      case 'system':
        return source.filter((n) => ['channel_sync', 'maintenance', 'availability'].includes(n.category));
      default:
        return source;
    }
  }, [visibleNotifications, digestNotifications, activeFilter, showDigest]);

  const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;
  const digestUnread = digestNotifications.filter(n => !n.is_read).length;

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
          <div className="flex items-center gap-1">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { setOpen(false); navigate('/settings?tab=notifications'); }}
              title="Notification settings"
            >
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Digest toggle */}
        {digestNotifications.length > 0 && (
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowDigest(!showDigest)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors border',
                showDigest
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <FileStack className="h-3.5 w-3.5" />
              <span className="flex-1 text-left font-medium">
                {showDigest ? 'Showing digest' : 'Digest summary'}
              </span>
              <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5">
                {digestUnread > 0 ? `${digestUnread} new` : `${digestNotifications.length} items`}
              </span>
            </button>
          </div>
        )}

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
              <p className="text-sm text-muted-foreground">
                {showDigest ? 'No digest items' : 'No notifications'}
              </p>
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
                  {/* Icon or image */}
                  <div className={cn('flex-shrink-0 mt-0.5', getPriorityColor(n.priority))}>
                    {n.image_url ? (
                      <img src={n.image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      getCategoryIcon(n.category)
                    )}
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
                      {/* Render action buttons from actions array or fallback to action_type */}
                      {n.actions && Array.isArray(n.actions) && n.actions.length > 0 ? (
                        <div className="flex gap-1">
                          {n.actions.slice(0, 2).map((action: any, i: number) => (
                            <Button
                              key={i}
                              variant="ghost"
                              size="sm"
                              className="h-auto px-2 py-0.5 text-[10px] text-primary hover:text-primary font-medium gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (action.link) { setOpen(false); navigate(action.link); }
                                else handleAction(e, n);
                              }}
                            >
                              {action.label}
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          ))}
                        </div>
                      ) : n.action_type && canPerformAction(n.action_type) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-0.5 text-[10px] text-primary hover:text-primary font-medium gap-1"
                          onClick={(e) => handleAction(e, n)}
                        >
                          {getActionLabel(n.action_type)}
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      ) : null}
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
