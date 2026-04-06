import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, ChevronDown, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { exportToPdf, exportToExcel } from '@/lib/exportUtils';
import { parseLocalDate } from '@/lib/dateUtils';

const PAGE_SIZE = 25;

export function AuditLogViewer() {
  const { selectedProperty, showAllProperties } = useProperty();
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const propertyId = selectedProperty?.id ?? null;

  // Count
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['audit-logs-count', propertyId, showAllProperties, actionFilter],
    queryFn: async () => {
      let query = supabase.from('audit_logs').select('*', { count: 'exact', head: true });
      if (!showAllProperties && propertyId) query = query.eq('property_id', propertyId);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: logs = [], isLoading, isFetching } = useQuery({
    queryKey: ['audit-logs', propertyId, showAllProperties, actionFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('id, action, details, created_at, user_id, property_id')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (!showAllProperties && propertyId) query = query.eq('property_id', propertyId);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Get distinct actions for filter
  const { data: distinctActions = [] } = useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(500);
      if (error) throw error;
      return [...new Set((data || []).map(d => d.action))].sort();
    },
    staleTime: 120_000,
  });

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(
      l => l.action.toLowerCase().includes(term) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = [
    { header: 'Timestamp', accessor: (r: any) => new Date(r.created_at).toLocaleString() },
    { header: 'Action', accessor: 'action' },
    { header: 'Details', accessor: (r: any) => JSON.stringify(r.details || {}).slice(0, 100) },
    { header: 'User ID', accessor: (r: any) => r.user_id?.slice(0, 8) + '...' },
  ];

  const handleExportPdf = () => exportToPdf(filteredLogs, columns, 'Audit Logs');
  const handleExportExcel = () => exportToExcel(filteredLogs, columns, 'audit_logs');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Audit Logs</h3>
            <p className="text-sm text-muted-foreground">Track all system actions and changes</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48 rounded-xl">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {distinctActions.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="px-3 sm:px-6 pt-4 sm:pt-6">
          {isLoading ? (
            <TableSkeleton rows={8} columns={4} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No audit logs"
              description="No activity has been recorded yet."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <Collapsible key={log.id} open={expandedRows.has(log.id)} onOpenChange={() => toggleRow(log.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.has(log.id) ? 'rotate-180' : ''}`} />
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-mono">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {log.user_id?.slice(0, 8)}…
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30">
                              <pre className="text-xs overflow-auto max-h-40 p-3 rounded-lg bg-background border">
                                {JSON.stringify(log.details, null, 2) || 'No details'}
                              </pre>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                hasNextPage={page < totalPages - 1}
                hasPreviousPage={page > 0}
                onNextPage={() => setPage(p => Math.min(p + 1, totalPages - 1))}
                onPreviousPage={() => setPage(p => Math.max(p - 1, 0))}
                onGoToPage={setPage}
                isFetching={isFetching}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
