import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CalendarDays, LogIn, AlertTriangle, Wrench, Wifi, Megaphone, Info,
  ChevronRight, Trash2, CheckCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface Notification {
  id: string;
  property_id: string | null;
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

type FilterTab = 'all' | 'high' | 'medium' | 'low' | 'booking' | 'system';

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
  { key: 'booking', label: 'Bookings' },
  { key: 'system', label: 'System' },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case 'booking': return <CalendarDays className="h-5 w-5" />;
    case 'checkin_checkout': return <LogIn className="h-5 w-5" />;
    case 'availability': return <AlertTriangle className="h-5 w-5" />;
    case 'maintenance': return <Wrench className="h-5 w-5" />;
    case 'channel_sync': return <Wifi className="h-5 w-5" />;
    case 'general': return <Megaphone className="h-5 w-5" />;
    default: return <Info className="h-5 w-5" />;
  }
}

function getPriorityColor(p: string) {
  switch (p) {
    case 'high': return 'text-destructive';
    case 'medium': return 'text-warning';
    default: return 'text-muted-foreground';
  }
}

function getPriorityDot(p: string) {
  switch (p) {
    case 'high': return 'bg-destructive';
    case 'medium': return 'bg-warning';
    default: return 'bg-muted-foreground';
  }
}

function getPriorityBorder(p: string) {
  switch (p) {
    case 'high': return 'border-l-destructive';
    case 'medium': return 'border-l-warning';
    default: return 'border-l-muted';
  }
}

function getActionLabel(a: string | null) {
  switch (a) {
    case 'check_in': return 'Check In';
    case 'check_out': return 'Check Out';
    case 'view_booking': return 'View Booking';
    case 'retry_sync': return 'Retry Sync';
    case 'view_room': return 'View Room';
    case 'assign_staff': return 'Assign Staff';
    default: return null;
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { selectedProperty, showAllProperties } = useProperty();
  const { canWrite, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const fetchNotifications = async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

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

  useEffect(() => { fetchNotifications(); }, [selectedProperty, showAllProperties]);

  useEffect(() => {
    const channel = supabase
      .channel('notifications-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedProperty, showAllProperties]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'high': return notifications.filter((n) => n.priority === 'high');
      case 'medium': return notifications.filter((n) => n.priority === 'medium');
      case 'low': return notifications.filter((n) => n.priority === 'low');
      case 'booking': return notifications.filter((n) => ['booking', 'checkin_checkout'].includes(n.category));
      case 'system': return notifications.filter((n) => ['channel_sync', 'maintenance', 'availability'].includes(n.category));
      default: return notifications;
    }
  }, [notifications, activeFilter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    if (error) { toast.error('Failed'); return; }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('All marked as read');
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) return;
    const { error } = await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Failed to delete'); return; }
    setNotifications([]);
    toast.success('All notifications deleted');
  };

  const formatTime = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  return (
    <DashboardLayout title="Notifications">
      <div className="max-w-3xl mx-auto space-y-4 p-4 sm:p-6 pb-24 md:pb-6">
        {/* Stats bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              {unreadCount} unread · {notifications.length} total
            </span>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleMarkAllRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            {isAdmin && notifications.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={handleDeleteAll}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear all</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                activeFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Separator />

        {/* Notification cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No notifications to show</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <Card
                key={n.id}
                className={cn(
                  'p-4 cursor-pointer border-l-4 transition-all hover:shadow-md',
                  getPriorityBorder(n.priority),
                  !n.is_read && 'bg-accent/20'
                )}
                onClick={() => handleClick(n)}
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className={cn(
                    'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-muted',
                    getPriorityColor(n.priority)
                  )}>
                    {getCategoryIcon(n.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', getPriorityDot(n.priority))} />
                        <p className={cn('text-sm truncate', !n.is_read ? 'font-semibold' : 'font-medium')}>
                          {n.title}
                        </p>
                      </div>
                      {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                    </div>

                    {n.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 ml-3.5">{n.message}</p>
                    )}

                    <div className="flex items-center justify-between mt-2 ml-3.5">
                      <p className="text-[11px] text-muted-foreground">{formatTime(n.created_at)}</p>
                      {n.action_type && canWrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1"
                          onClick={(e) => { e.stopPropagation(); if (n.link) navigate(n.link); }}
                        >
                          {getActionLabel(n.action_type)}
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
