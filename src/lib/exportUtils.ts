import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ExportColumn {
  header: string;
  accessor: string | ((row: any) => any);
}

/**
 * Download a CSV string as a file and show a success toast.
 *
 * Replaces the repeated Blob→createObjectURL→click→revokeObjectURL
 * boilerplate found in every report component.
 */
export function downloadCsv(csvContent: string, filename: string, successMessage = 'CSV exported') {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(successMessage);
}

/**
 * Build a dated CSV filename.
 * e.g. buildCsvFilename('Revenue_Report') → "Revenue_Report_2024-06-01.csv"
 */
export function buildCsvFilename(baseName: string): string {
  return `${baseName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
}

function resolveValue(row: any, accessor: ExportColumn['accessor']): string {
  if (typeof accessor === 'function') return String(accessor(row) ?? '');
  const keys = accessor.split('.');
  let val: any = row;
  for (const k of keys) {
    val = val?.[k];
  }
  return val != null ? String(val) : '';
}

export function exportToPdf(data: any[], columns: ExportColumn[], title: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

  autoTable(doc, {
    startY: 30,
    head: [columns.map(c => c.header)],
    body: data.map(row => columns.map(c => resolveValue(row, c.accessor))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportToExcel(data: any[], columns: ExportColumn[], filename: string) {
  const rows = data.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach(c => {
      obj[c.header] = resolveValue(row, c.accessor);
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-width columns
  const maxWidths = columns.map((c, i) => {
    const headerLen = c.header.length;
    const maxDataLen = Math.max(...rows.map(r => String(r[c.header] || '').length), 0);
    return Math.min(Math.max(headerLen, maxDataLen) + 2, 40);
  });
  ws['!cols'] = maxWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
