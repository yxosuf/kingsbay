import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  className?: string;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  renderMobileCard: (item: T) => ReactNode;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  renderMobileCard,
  emptyMessage = 'No data found.',
  emptyIcon,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <Card key={keyExtractor(item)} className="overflow-hidden">
            <CardContent className="p-4">
              {renderMobileCard(item)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col, idx) => (
            <TableHead key={idx} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={keyExtractor(item)}>
            {columns.map((col, idx) => (
              <TableCell key={idx} className={col.className}>
                {typeof col.accessor === 'function'
                  ? col.accessor(item)
                  : (item[col.accessor] as ReactNode)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
