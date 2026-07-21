-- EPHERA ledger schema (authoritative money truth)
-- Double-entry only. Applications must never UPDATE balances directly.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref    TEXT NOT NULL UNIQUE,
    owner_id        UUID NOT NULL,
    currency        CHAR(3) NOT NULL,
    account_type    TEXT NOT NULL CHECK (account_type IN (
        'user_wallet', 'merchant', 'clearing', 'fee', 'fx', 'suspense', 'system'
    )),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'frozen', 'closed'
    )),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX accounts_owner_idx ON accounts (owner_id);

-- Append-only journal. Reversals are new postings, never edits.
CREATE TABLE journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    transfer_id     UUID NOT NULL,
    description     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE postings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries (id),
    account_id      UUID NOT NULL REFERENCES accounts (id),
    -- signed minor units: positive = credit, negative = debit (or vice versa;
    -- engine treats pairs as balanced when sum per currency is zero)
    amount_minor    BIGINT NOT NULL,
    currency        CHAR(3) NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT postings_amount_nonzero CHECK (amount_minor <> 0)
);

CREATE INDEX postings_account_idx ON postings (account_id);
CREATE INDEX postings_journal_idx ON postings (journal_entry_id);

-- Materialised balance cache updated only by ledger service in same TX as postings
CREATE TABLE account_balances (
    account_id      UUID PRIMARY KEY REFERENCES accounts (id),
    currency        CHAR(3) NOT NULL,
    balance_minor   BIGINT NOT NULL DEFAULT 0,
    hold_minor      BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT account_balances_nonneg_available CHECK (balance_minor - hold_minor >= 0 OR account_id IS NOT NULL)
);

CREATE TABLE holds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts (id),
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
    currency        CHAR(3) NOT NULL,
    transfer_id     UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'released', 'captured'
    )),
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE authorisation_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id     UUID NOT NULL,
    method          TEXT NOT NULL CHECK (method IN (
        'passkey', 'pin', 'biometric', 'policy_auto_low_risk'
    )),
    device_id       TEXT,
    policy_decision JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX authorisation_transfer_idx ON authorisation_evidence (transfer_id);

-- Seed system accounts for sandbox
INSERT INTO accounts (id, external_ref, owner_id, currency, account_type)
VALUES
    ('00000000-0000-4000-8000-000000000001', 'system:clearing:GHS', '00000000-0000-4000-8000-000000000000', 'GHS', 'clearing'),
    ('00000000-0000-4000-8000-000000000002', 'system:fee:GHS', '00000000-0000-4000-8000-000000000000', 'GHS', 'fee'),
    ('00000000-0000-4000-8000-000000000003', 'system:clearing:GBP', '00000000-0000-4000-8000-000000000000', 'GBP', 'clearing'),
    ('00000000-0000-4000-8000-000000000004', 'system:fee:GBP', '00000000-0000-4000-8000-000000000000', 'GBP', 'fee');

INSERT INTO account_balances (account_id, currency, balance_minor, hold_minor)
SELECT id, currency, 0, 0 FROM accounts;
