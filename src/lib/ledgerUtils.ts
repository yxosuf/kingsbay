import { supabase } from '@/integrations/supabase/client';

// Account codes matching the seeded chart of accounts
const ACCOUNTS = {
  CASH: '1000',
  BANK: '1010',
  CARD: '1020',
  AR: '1100',
  ONLINE: '1200',
  ROOM_REVENUE: '4000',
  SERVICE_REVENUE: '4100',
  TAX_PAYABLE: '2100',
  COMMISSION_EXPENSE: '5000',
  OTA_PAYABLE: '2200',
  BANK_FEES: '5100',
} as const;

async function getAccountId(code: string): Promise<string | null> {
  const { data } = await supabase
    .from('ledger_accounts')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  return (data as any)?.id || null;
}

function methodToAccountCode(method: string): string {
  switch (method) {
    case 'cash': return ACCOUNTS.CASH;
    case 'card': return ACCOUNTS.CARD;
    case 'bank_transfer': return ACCOUNTS.BANK;
    case 'online': return ACCOUNTS.ONLINE;
    default: return ACCOUNTS.CASH;
  }
}

async function createEntry(
  description: string,
  propertyId: string,
  lines: { accountCode: string; debit: number; credit: number }[],
  bookingId?: string | null,
  transactionId?: string | null,
  createdBy?: string | null
) {
  // Resolve account IDs
  const accountIds: Record<string, string> = {};
  for (const line of lines) {
    if (!accountIds[line.accountCode]) {
      const id = await getAccountId(line.accountCode);
      if (!id) {
        console.error(`Ledger account not found: ${line.accountCode}`);
        return null;
      }
      accountIds[line.accountCode] = id;
    }
  }

  const { data: entry, error: entryErr } = await supabase
    .from('ledger_entries')
    .insert({
      description,
      property_id: propertyId,
      booking_id: bookingId || null,
      transaction_id: transactionId || null,
      created_by: createdBy || null,
    })
    .select('id')
    .single();

  if (entryErr || !entry) {
    console.error('Failed to create ledger entry:', entryErr);
    return null;
  }

  const ledgerLines = lines.map((line) => ({
    entry_id: entry.id,
    account_id: accountIds[line.accountCode],
    debit: line.debit,
    credit: line.credit,
  }));

  const { error: linesErr } = await supabase
    .from('ledger_lines')
    .insert(ledgerLines);

  if (linesErr) {
    console.error('Failed to create ledger lines:', linesErr);
    return null;
  }

  return entry.id;
}

/**
 * Post ledger entry when a booking is confirmed.
 * DR: Accounts Receivable
 * CR: Room Revenue + Tax Payable
 */
export async function postBookingConfirmed(
  bookingId: string,
  roomCharges: number,
  serviceCharges: number,
  taxAmount: number,
  propertyId: string,
  createdBy?: string
) {
  const totalReceivable = roomCharges + serviceCharges + taxAmount;
  const lines: { accountCode: string; debit: number; credit: number }[] = [
    { accountCode: ACCOUNTS.AR, debit: totalReceivable, credit: 0 },
    { accountCode: ACCOUNTS.ROOM_REVENUE, debit: 0, credit: roomCharges },
  ];

  if (serviceCharges > 0) {
    lines.push({ accountCode: ACCOUNTS.SERVICE_REVENUE, debit: 0, credit: serviceCharges });
  }

  if (taxAmount > 0) {
    lines.push({ accountCode: ACCOUNTS.TAX_PAYABLE, debit: 0, credit: taxAmount });
  }

  return createEntry(
    `Booking revenue recognized`,
    propertyId,
    lines,
    bookingId,
    null,
    createdBy
  );
}

/**
 * Post ledger entry for a payment.
 * DR: Cash/Bank/Card/Online
 * CR: Accounts Receivable
 */
export async function postPayment(
  transactionId: string,
  amount: number,
  method: string,
  propertyId: string,
  bookingId?: string,
  createdBy?: string
) {
  const assetCode = methodToAccountCode(method);
  return createEntry(
    `Payment received (${method})`,
    propertyId,
    [
      { accountCode: assetCode, debit: amount, credit: 0 },
      { accountCode: ACCOUNTS.AR, debit: 0, credit: amount },
    ],
    bookingId,
    transactionId,
    createdBy
  );
}

/**
 * Post ledger entry for OTA commission.
 * DR: Commission Expense
 * CR: OTA Payable
 */
export async function postCommission(
  bookingId: string,
  commissionAmount: number,
  propertyId: string,
  createdBy?: string
) {
  return createEntry(
    `OTA commission recorded`,
    propertyId,
    [
      { accountCode: ACCOUNTS.COMMISSION_EXPENSE, debit: commissionAmount, credit: 0 },
      { accountCode: ACCOUNTS.OTA_PAYABLE, debit: 0, credit: commissionAmount },
    ],
    bookingId,
    null,
    createdBy
  );
}

/**
 * Post ledger entry for a refund (reverse of payment).
 * DR: Accounts Receivable
 * CR: Cash/Bank/Card/Online
 */
/**
 * Post ledger entry for a card bank fee.
 * DR: Bank Fees Expense
 * CR: Cash/Bank/Card/Online (same asset account as payment)
 */
export async function postBankFee(
  transactionId: string,
  feeAmount: number,
  method: string,
  propertyId: string,
  bookingId?: string,
  createdBy?: string
) {
  const assetCode = methodToAccountCode(method);
  return createEntry(
    `Card bank fee (3%)`,
    propertyId,
    [
      { accountCode: ACCOUNTS.BANK_FEES, debit: feeAmount, credit: 0 },
      { accountCode: assetCode, debit: 0, credit: feeAmount },
    ],
    bookingId,
    transactionId,
    createdBy
  );
}

export async function postRefund(
  transactionId: string,
  amount: number,
  method: string,
  propertyId: string,
  bookingId?: string,
  createdBy?: string
) {
  const assetCode = methodToAccountCode(method);
  return createEntry(
    `Refund issued (${method})`,
    propertyId,
    [
      { accountCode: ACCOUNTS.AR, debit: amount, credit: 0 },
      { accountCode: assetCode, debit: 0, credit: amount },
    ],
    bookingId,
    transactionId,
    createdBy
  );
}
