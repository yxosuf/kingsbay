import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { Activity, Bell, CalendarCheck, UserPlus, LogIn, LogOut, Ban } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface FeedItem {
  id: string;
  type: 'audit' | 'notification';
  title: string;
  detail: string | null;
  timestamp: string;
  icon: 'booking' | 'checkin' | 'checkout' | 'cancel' | 'guest' | 'general';
}

const iconMap = {
  booking: CalendarCheck,
  checkin: LogIn,
  checkout: LogOut,
  cancel: Ban,
  guest: UserPlus,
  general: Bell,
};

function classifyAction(action: string): FeedItem['icon'] {
  if (action.includes('check_in') || action.includes('checked_in')) return 'checkin';
  if (action.includes('check_out') || action.includes('checked_out')) return 'checkout';
  if (action.includes('cancel')) return 'cancel';
  if (action.includes('booking') || action.includes('reservation')) return 'booking';
  if (action.includes('guest')) return 'guest';
  return 'general';
}

export function ActivityFeed() {
  const { selectedProperty } = useProperty();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeed();
  }, [selectedProperty]);

  const fetchFeed = async () => {
    setLoading(true);

    const [{ data: notifications }, { data: audits }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, message, created_at, category')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('audit_logs')
        .select('id, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    const feed: FeedItem[] = [];

    notifications?.forEach(n => {
      feed.push({
        id: `n-${n.id}`,
        type: 'notification',
        title: n.title,
        detail: n.message,
        timestamp: n.created_at,
        icon: classifyAction(n.category || ''),
      });
    });

    audits?.forEach(a => {
      feed.push({
        id: `a-${a.id}`,
        type: 'audit',
        title: a.action.replace(/_/g, ' '),
        detail: null,
        timestamp: a.created_at,
        icon: classifyAction(a.action),
      });
    });

    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(feed.slice(0, 20));
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[340px]">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const Icon = iconMap[item.icon];
                return (
                  <div key={item.id} className="flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate capitalize">{item.title}</p>
                      {item.detail && (
                        <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
