import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Mail, MessageSquare, StickyNote, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Communication {
  id: string;
  comm_type: string;
  subject: string | null;
  body: string | null;
  recipient_email: string | null;
  sent_at: string;
  sent_by: string | null;
  profile?: { full_name: string | null } | null;
}

const typeIcon = {
  email: Mail,
  sms: MessageSquare,
  note: StickyNote,
};

const typeColor = {
  email: 'default' as const,
  sms: 'secondary' as const,
  note: 'outline' as const,
};

interface GuestCommunicationLogProps {
  guestId: string;
}

export function GuestCommunicationLog({ guestId }: GuestCommunicationLogProps) {
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComms();
  }, [guestId]);

  const fetchComms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guest_communications')
      .select('id, comm_type, subject, body, recipient_email, sent_at, sent_by')
      .eq('guest_id', guestId)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (data) {
      // Fetch sender names
      const senderIds = [...new Set(data.filter(d => d.sent_by).map(d => d.sent_by!))];
      let profileMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds);
        profiles?.forEach(p => { profileMap[p.id] = p.full_name || 'Staff'; });
      }

      setComms(data.map(d => ({
        ...d,
        profile: d.sent_by ? { full_name: profileMap[d.sent_by] || null } : null,
      })));
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Communications ({comms.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : comms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No communications logged yet</p>
          ) : (
            <div className="divide-y divide-border">
              {comms.map((comm) => {
                const Icon = typeIcon[comm.comm_type as keyof typeof typeIcon] || Mail;
                return (
                  <div key={comm.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={typeColor[comm.comm_type as keyof typeof typeColor] || 'default'} className="text-xs">
                            {comm.comm_type}
                          </Badge>
                          {comm.subject && (
                            <span className="text-sm font-medium truncate">{comm.subject}</span>
                          )}
                        </div>
                        {comm.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{comm.body}</p>
                        )}
                        {comm.recipient_email && (
                          <p className="text-xs text-muted-foreground mt-1">To: {comm.recipient_email}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(parseISO(comm.sent_at), 'MMM d, yyyy h:mm a')}</span>
                          {comm.profile?.full_name && (
                            <span>• by {comm.profile.full_name}</span>
                          )}
                        </div>
                      </div>
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
