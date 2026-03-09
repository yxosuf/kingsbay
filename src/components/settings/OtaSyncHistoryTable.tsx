import { useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import type { OtaSyncLog } from '@/hooks/useOtaSync';
import { cn } from '@/lib/utils';

interface OtaSyncHistoryTableProps {
  logs: OtaSyncLog[];
  loading?: boolean;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    label: 'Success',
    variant: 'success' as const,
    className: 'text-success',
  },
  failure: {
    icon: XCircle,
    label: 'Failed',
    variant: 'destructive' as const,
    className: 'text-destructive',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    variant: 'outline' as const,
    className: 'text-muted-foreground',
  },
};

const ACTION_LABELS: Record<string, string> = {
  rate_push: 'Rate Push',
  availability_push: 'Availability Push',
  test_connection: 'Connection Test',
};

export function OtaSyncHistoryTable({ logs, loading }: OtaSyncHistoryTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterOta, setFilterOta] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const otaOptions = Array.from(new Set(logs.map((l) => l.ota_name)));

  const filtered = logs.filter((log) => {
    if (filterOta !== 'all' && log.ota_name !== filterOta) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (filterAction !== 'all' && log.action_type !== filterAction) return false;
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading sync history…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterOta} onValueChange={setFilterOta}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All OTAs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All OTAs</SelectItem>
            {otaOptions.map((ota) => (
              <SelectItem key={ota} value={ota}>
                {ota.replace('_', '.')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="rate_push">Rate Push</SelectItem>
            <SelectItem value="availability_push">Availability Push</SelectItem>
            <SelectItem value="test_connection">Connection Test</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} records
        </span>
      </div>

      {paginated.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No sync logs found matching the selected filters.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>OTA</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((log) => {
                const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedRow === log.id;

                return (
                  <>
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                    >
                      <TableCell className="py-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <ChannelIcon type={log.ota_name} size="sm" />
                          <span className="text-sm capitalize">
                            {log.ota_name.replace('_', '.')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm text-muted-foreground">
                          {ACTION_LABELS[log.action_type] || log.action_type}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn('h-4 w-4', statusConfig.className)} />
                          <Badge variant={statusConfig.variant} className="text-xs">
                            {statusConfig.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm text-muted-foreground">
                          {log.retry_count > 0 ? log.retry_count : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, HH:mm')}
                        </span>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${log.id}-expanded`} className="bg-muted/20">
                        <TableCell colSpan={6} className="py-3 px-4">
                          <div className="space-y-3">
                            {log.response_message && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
                                <pre className="text-xs bg-background rounded-lg p-3 border overflow-x-auto max-h-32">
                                  {log.response_message}
                                </pre>
                              </div>
                            )}
                            {log.error_message && (
                              <div>
                                <p className="text-xs font-medium text-destructive mb-1">Error</p>
                                <pre className="text-xs bg-destructive/5 text-destructive rounded-lg p-3 border border-destructive/20 overflow-x-auto max-h-32">
                                  {log.error_message}
                                </pre>
                              </div>
                            )}
                            {log.request_payload && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Request Payload</p>
                                <pre className="text-xs bg-background rounded-lg p-3 border overflow-x-auto max-h-32">
                                  {JSON.stringify(log.request_payload, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
