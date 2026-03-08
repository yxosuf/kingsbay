
-- Add num_adults, num_children to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS num_adults integer NOT NULL DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS num_children integer NOT NULL DEFAULT 0;

-- Add bank_fee_amount to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS bank_fee_amount numeric DEFAULT 0;

-- Seed Bank Fees Expense ledger account (code 5100)
INSERT INTO public.ledger_accounts (code, name, account_type, is_system, property_id)
SELECT '5100', 'Bank Fees Expense', 'expense', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE code = '5100');
