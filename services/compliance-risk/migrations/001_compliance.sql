-- compliance-risk owns customer verification state, the limits that follow from
-- it, and the screening record (ADR 0003).
--
-- Before this, a customer's KYC tier lived in device storage and the customer
-- could promote themselves to "verified" (D-33), and the daily and
-- new-recipient limits existed only as numbers on the device that the send path
-- never consulted (D-39).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tiers are ordered. A tier is a statement about what evidence has been
-- verified, so it is never set by the subject it describes.
CREATE TABLE kyc_tiers (
    tier            TEXT PRIMARY KEY,
    rank            INT  NOT NULL UNIQUE,
    daily_limit_minor      BIGINT NOT NULL,
    single_limit_minor     BIGINT NOT NULL,
    new_recipient_limit_minor BIGINT NOT NULL,
    description     TEXT NOT NULL
);

INSERT INTO kyc_tiers (tier, rank, daily_limit_minor, single_limit_minor, new_recipient_limit_minor, description) VALUES
    ('unverified', 0,      0,      0,      0, 'No verified evidence. Cannot send.'),
    ('basic',      1,  50000,  20000,  10000, 'Identity claimed and phone verified.'),
    ('verified',   2, 500000, 200000,  50000, 'Government identity document verified.'),
    ('premium',    3, 5000000, 1000000, 200000, 'Identity plus verified source of funds.');

CREATE TABLE customers (
    subject     TEXT PRIMARY KEY,
    tier        TEXT NOT NULL REFERENCES kyc_tiers (tier) DEFAULT 'unverified',
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'blocked')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every tier change records who decided it and on what evidence. A tier that
-- cannot be explained later is not a verification, it is a guess.
CREATE TABLE tier_decisions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject       TEXT NOT NULL REFERENCES customers (subject),
    from_tier     TEXT NOT NULL,
    to_tier       TEXT NOT NULL,
    decided_by    TEXT NOT NULL,
    decided_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    evidence_ref  TEXT NOT NULL,
    reason        TEXT NOT NULL,
    -- The subject of a verification can never be the party that decided it.
    CONSTRAINT no_self_verification CHECK (decided_by <> subject)
);

CREATE INDEX tier_decisions_subject_idx ON tier_decisions (subject);

-- Sanctions and politically-exposed-person entries.
--
-- This is a SANDBOX list with fictional entries. A real deployment consumes a
-- licensed list; nothing here should be mistaken for one, which is why the
-- source column is mandatory and says so.
CREATE TABLE screening_list (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalised_name TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('sanctions', 'pep', 'adverse_media')),
    source      TEXT NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX screening_list_name_idx ON screening_list (normalised_name);

INSERT INTO screening_list (normalised_name, category, source) VALUES
    ('fictional sanctioned person', 'sanctions', 'SANDBOX-FIXTURE'),
    ('example blocked entity',      'sanctions', 'SANDBOX-FIXTURE'),
    ('fictional public official',   'pep',       'SANDBOX-FIXTURE');

-- Every decision the engine makes, kept so a refusal can be explained to a
-- customer and to an examiner.
CREATE TABLE risk_decisions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject       TEXT NOT NULL,
    amount_minor  BIGINT NOT NULL,
    currency      CHAR(3) NOT NULL,
    recipient     TEXT NOT NULL,
    outcome       TEXT NOT NULL CHECK (outcome IN ('allow', 'review', 'deny')),
    reasons       JSONB NOT NULL DEFAULT '[]'::jsonb,
    tier          TEXT NOT NULL,
    decided_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX risk_decisions_subject_idx ON risk_decisions (subject, decided_at);

-- Cases raised for manual review.
CREATE TABLE review_cases (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject       TEXT NOT NULL,
    reason        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'blocked')),
    opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at     TIMESTAMPTZ,
    closed_by     TEXT,
    decision_note TEXT,
    CONSTRAINT closure_is_complete CHECK (
        (status = 'open' AND closed_at IS NULL AND closed_by IS NULL) OR
        (status <> 'open' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
    ),
    -- An analyst cannot clear a case about themselves.
    CONSTRAINT no_self_clearance CHECK (closed_by IS NULL OR closed_by <> subject)
);

CREATE INDEX review_cases_status_idx ON review_cases (status, opened_at);

-- The sandbox customer starts unverified, because that is what the platform
-- actually knows about them.
INSERT INTO customers (subject, tier) VALUES ('user:demo-self:GHS', 'unverified')
ON CONFLICT (subject) DO NOTHING;
