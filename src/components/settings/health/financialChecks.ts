import { createElement } from 'react';
import { BookOpen, Receipt, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { HealthCheck } from './types';

export async function runFinancialChecks(): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];

  // Ledger Balance
  try {
    const { data: ledgerLines } = await supabase.from('ledger_lines').select('entry_id, debit, credit');
    if (ledgerLines && ledgerLines.length > 0) {
      const entryTotals: Record<string, { debit: number; credit: number }> = {};
      for (const line of ledgerLines) {
        const eid = line.entry_id;
        if (!entryTotals[eid]) entryTotals[eid] = { debit: 0, credit: 0 };
        entryTotals[eid].debit += Number(line.debit);
        entryTotals[eid].credit += Number(line.credit);
      }
      const imbalanced = Object.values(entryTotals).filter(t => Math.abs(t.debit - t.credit) > 0.01);
      results.push({ name: 'Ledger Balance', description: 'All journal entries balanced', status: imbalanced.length === 0 ? 'pass' : 'fail', detail: imbalanced.length === 0 ? `${Object.keys(entryTotals).length} entries, all balanced` : `${imbalanced.length} imbalanced entries!`, icon: createElement(BookOpen, { className: 'h-4 w-4' }) });
    } else {
      results.push({ name: 'Ledger Balance', description: 'All journal entries balanced', status: 'pass', detail: 'No ledger entries yet', icon: createElement(BookOpen, { className: 'h-4 w-4' }) });
    }
  } catch {
    results.push({ name: 'Ledger Balance', description: 'Journal entries balanced', status: 'fail', detail: 'Could not query ledger', icon: createElement(BookOpen, { className: 'h-4 w-4' }) });
  }

  // Transaction Coverage
  try {
    const { count: paymentCount } = await supabase.from('payments').select('id', { count: 'exact', head: true });
    const { count: txnCount } = await supabase.from('booking_transactions').select('id', { count: 'exact', head: true }).eq('transaction_type', 'payment');
    const payments = paymentCount ?? 0;
    const txns = txnCount ?? 0;
    results.push({ name: 'Transaction Coverage', description: 'All payments have transaction records', status: payments <= txns ? 'pass' : 'warn', detail: payments <= txns ? `${payments} payments, ${txns} transaction records` : `${payments} payments but only ${txns} records`, icon: createElement(Receipt, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Transaction Coverage', description: 'Payment transaction records', status: 'fail', detail: 'Could not query transactions', icon: createElement(Receipt, { className: 'h-4 w-4' }) });
  }

  // Duplicate invoice numbers
  try {
    const { data: invoices } = await supabase.from('invoices').select('invoice_number');
    if (invoices && invoices.length > 0) {
      const numbers = invoices.map(i => i.invoice_number);
      const dupes = numbers.length - new Set(numbers).size;
      results.push({ name: 'Invoice Numbering', description: 'No duplicate invoice numbers', status: dupes === 0 ? 'pass' : 'fail', detail: dupes === 0 ? `${numbers.length} invoices, all unique` : `${dupes} duplicate invoice number(s)!`, icon: createElement(FileText, { className: 'h-4 w-4' }) });
    } else {
      results.push({ name: 'Invoice Numbering', description: 'Invoice numbers unique', status: 'pass', detail: 'No invoices yet', icon: createElement(FileText, { className: 'h-4 w-4' }) });
    }
  } catch {
    results.push({ name: 'Invoice Numbering', description: 'Invoice numbering', status: 'fail', detail: 'Could not query invoices', icon: createElement(FileText, { className: 'h-4 w-4' }) });
  }

  return results;
}
