-- Sandbox demo accounts (GHS). Opening balances via system clearing debit.

-- Sender: demo user "self" (the app user)
INSERT INTO accounts (id, external_ref, owner_id, currency, account_type, status)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'user:demo-self:GHS',
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'GHS', 'user_wallet', 'active'),
    ('22222222-2222-4222-8222-222222222222', 'user:ama:GHS',
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'GHS', 'user_wallet', 'active')
ON CONFLICT (external_ref) DO NOTHING;

INSERT INTO account_balances (account_id, currency, balance_minor, hold_minor)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'GHS', 0, 0),
    ('22222222-2222-4222-8222-222222222222', 'GHS', 0, 0)
ON CONFLICT (account_id) DO NOTHING;

-- Seed opening balance: credit demo-self 1,000 GHS from clearing
-- Only if self still at zero
DO $$
DECLARE
    je_id UUID := gen_random_uuid();
    self_id UUID := '11111111-1111-4111-8111-111111111111';
    clearing_id UUID := '00000000-0000-4000-8000-000000000001';
    bal BIGINT;
BEGIN
    SELECT balance_minor INTO bal FROM account_balances WHERE account_id = self_id;
    IF bal = 0 THEN
        INSERT INTO journal_entries (id, idempotency_key, transfer_id, description)
        VALUES (je_id, 'seed:demo-self:opening', 'seed_opening_self', 'Sandbox opening balance');

        INSERT INTO postings (journal_entry_id, account_id, amount_minor, currency, direction)
        VALUES
            (je_id, clearing_id, 100000, 'GHS', 'debit'),
            (je_id, self_id, 100000, 'GHS', 'credit');

        UPDATE account_balances SET balance_minor = balance_minor - 100000, updated_at = now()
        WHERE account_id = clearing_id;
        UPDATE account_balances SET balance_minor = balance_minor + 100000, updated_at = now()
        WHERE account_id = self_id;
    END IF;
END $$;
