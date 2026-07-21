-- G2 authorisation grants.
--
-- The ledger previously accepted any non-empty `authorisationRef` string
-- (D-01). It now requires a signed, transaction-bound grant and records each
-- one it has honoured, so a grant cannot be used twice.
--
-- Single use is enforced by the primary key: the consuming INSERT happens in
-- the same transaction as the postings, so a replay either finds the row and
-- is refused, or collides on insert and rolls the whole transfer back. There
-- is no window in which a replay can post.

CREATE TABLE authorisation_grants (
    jti             TEXT PRIMARY KEY,
    subject         TEXT NOT NULL,
    method          TEXT NOT NULL,
    binding_digest  TEXT NOT NULL,
    transfer_id     TEXT NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries (id),
    issued_at       TIMESTAMPTZ NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX authorisation_grants_transfer_idx ON authorisation_grants (transfer_id);
CREATE INDEX authorisation_grants_subject_idx ON authorisation_grants (subject);

-- Evidence records how the human actually authorised, so a reviewer can tell a
-- verified passkey assertion from a sandbox one without reading configuration
-- (ADR 0009). The existing check constraint already permits 'passkey'; the
-- sandbox authenticator is added explicitly rather than being disguised as one.
ALTER TABLE authorisation_evidence DROP CONSTRAINT authorisation_evidence_method_check;
ALTER TABLE authorisation_evidence ADD CONSTRAINT authorisation_evidence_method_check
    CHECK (method IN (
        'passkey', 'pin', 'biometric', 'policy_auto_low_risk', 'sandbox_authenticator'
    ));

ALTER TABLE authorisation_evidence ADD COLUMN grant_jti TEXT;
CREATE INDEX authorisation_evidence_grant_idx ON authorisation_evidence (grant_jti);
