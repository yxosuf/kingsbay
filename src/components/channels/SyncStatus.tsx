import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';

interface SyncLog {
  id: string;
  channel_id: string;
  direction: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  created_at: string;
}

interface ChannelConnection {
  id: string;
  channel_type: string;
}

interface ChannelInfo {
  name: string;
  icon: string;
  description: string;
}

interface SyncStatusProps {
  logs: SyncLog[];
  channels: ChannelConnection[];
  getChannelInfo: (type: string) => ChannelInfo;
}

export function SyncStatus({ logs, channels, getChannelInfo }: SyncStatusProps) {
  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      return getChannelInfo(channel.channel_type).name;
    }
    return 'Unknown';
  };

  const getChannelIcon = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      return getChannelInfo(channel.channel_type).icon;
    }
    return '📡';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: 'bg-green-500/10 text-green-500 border-green-500/20',
      failed: 'bg-red-500/10 text-red-500 border-red-500/20',
      partial: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };

    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {status}
      </Badge>
    );
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' 
      ? <ArrowDownToLine className="h-4 w-4 text-blue-500" />
      : <ArrowUpFromLine className="h-4 w-4 text-purple-500" />;
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Sync History</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Sync logs will appear here once you enable channels and start syncing calendars
            with external booking platforms.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group logs by date
  const logsByDate = logs.reduce((acc, log) => {
    const date = format(new Date(log.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, SyncLog[]>);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Successful Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(l => l.status === 'success').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Failed Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(l => l.status === 'failed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Total Records Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.reduce((sum, l) => sum + l.records_synced, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Activity</CardTitle>
          <CardDescription>
            Last 20 synchronization events across all channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getChannelIcon(log.channel_id)}</span>
                        <span>{getChannelName(log.channel_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDirectionIcon(log.direction)}
                        <span className="capitalize">{log.direction}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {getStatusBadge(log.status)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {log.records_synced}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {log.error_message ? (
                        <span className="text-sm text-red-500 truncate block" title={log.error_message}>
                          {log.error_message}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
