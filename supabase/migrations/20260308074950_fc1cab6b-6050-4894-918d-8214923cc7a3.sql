
-- Create enums
CREATE TYPE public.transaction_type AS ENUM ('payment', 'refund', 'commission', 'adjustment');
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- booking_transactions table
CREATE TABLE public.booking_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  transaction_type public.transaction_type NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'LKR',
  method public.payment_method,
  notes text,
  created_by uuid,
  property_id uuid REFERENCES public.properties(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view booking transactions" ON public.booking_transactions FOR SELECT USING (public.is_staff());
CREATE POLICY "Write staff can insert booking transactions" ON public.booking_transactions FOR INSERT WITH CHECK (public.is_write_staff());
CREATE POLICY "Write staff can update booking transactions" ON public.booking_transactions FOR UPDATE USING (public.is_write_staff());
CREATE POLICY "Admin can delete booking transactions" ON public.booking_transactions FOR DELETE USING (public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_transactions;

-- ledger_accounts table
CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  account_type public.account_type NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  property_id uuid REFERENCES public.properties(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ledger accounts" ON public.ledger_accounts FOR SELECT USING (public.is_staff());
CREATE POLICY "Write staff can insert ledger accounts" ON public.ledger_accounts FOR INSERT WITH CHECK (public.is_write_staff());
CREATE POLICY "Write staff can update ledger accounts" ON public.ledger_accounts FOR UPDATE USING (public.is_write_staff());
CREATE POLICY "Admin can delete ledger accounts" ON public.ledger_accounts FOR DELETE USING (public.is_admin());

-- ledger_entries table
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.booking_transactions(id) ON DELETE SET NULL,
  description text NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ledger entries" ON public.ledger_entries FOR SELECT USING (public.is_staff());
CREATE POLICY "Write staff can insert ledger entries" ON public.ledger_entries FOR INSERT WITH CHECK (public.is_write_staff());
CREATE POLICY "Write staff can update ledger entries" ON public.ledger_entries FOR UPDATE USING (public.is_write_staff());
CREATE POLICY "Admin can delete ledger entries" ON public.ledger_entries FOR DELETE USING (public.is_admin());

-- ledger_lines table
CREATE TABLE public.ledger_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.ledger_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.ledger_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ledger lines" ON public.ledger_lines FOR SELECT USING (public.is_staff());
CREATE POLICY "Write staff can insert ledger lines" ON public.ledger_lines FOR INSERT WITH CHECK (public.is_write_staff());
CREATE POLICY "Write staff can update ledger lines" ON public.ledger_lines FOR UPDATE USING (public.is_write_staff());
CREATE POLICY "Admin can delete ledger lines" ON public.ledger_lines FOR DELETE USING (public.is_admin());

-- Seed chart of accounts
INSERT INTO public.ledger_accounts (code, name, account_type, is_system) VALUES
  ('1000', 'Cash', 'asset', true),
  ('1010', 'Bank', 'asset', true),
  ('1020', 'Card Receipts', 'asset', true),
  ('1100', 'Accounts Receivable', 'asset', true),
  ('1200', 'Online Payments', 'asset', true),
  ('4000', 'Room Revenue', 'revenue', true),
  ('4100', 'Service Revenue', 'revenue', true),
  ('2100', 'Tax Payable', 'liability', true),
  ('5000', 'OTA Commission Expense', 'expense', true),
  ('2200', 'OTA Payable', 'liability', true);
