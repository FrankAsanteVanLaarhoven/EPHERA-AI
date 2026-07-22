-- Receipts, written in the same transaction as the posting.
--
-- A receipt used to be created by the payments worker and kept in a map in its
-- process memory: lost on restart, and derived from values the worker held
-- rather than from what the ledger actually posted. The mobile app then
-- discarded the real identifiers and rendered a fabricated receipt with a
-- hardcoded date, fee and provider reference (D-37).
--
-- Writing it here, inside the capture transaction, buys one specific property:
-- a receipt cannot claim something the ledger did not post. The two either
-- commit together or neither exists.
CREATE TABLE receipts (
    id               TEXT PRIMARY KEY,
    transfer_id      TEXT NOT NULL,
    journal_entry_id UUID NOT NULL REFERENCES journal_entries (id),
    from_external_ref TEXT NOT NULL,
    to_external_ref   TEXT NOT NULL,
    amount_minor     BIGINT NOT NULL CHECK (amount_minor > 0),
    fee_minor        BIGINT NOT NULL CHECK (fee_minor >= 0),
    currency         CHAR(3) NOT NULL,
    description      TEXT NOT NULL,
    -- How the payment was actually authorised, carried from the grant so a
    -- receipt cannot describe a sandbox authorisation as a passkey one.
    authorisation_method TEXT NOT NULL,
    grant_jti        TEXT NOT NULL,
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Hash over the receipt's own fields, so a receipt produced later can be
    -- shown to be the one that was issued.
    content_hash     TEXT NOT NULL
);

CREATE INDEX receipts_transfer_idx ON receipts (transfer_id);
CREATE INDEX receipts_subject_idx ON receipts (from_external_ref, issued_at DESC);

-- Receipts are evidence: write-once.
CREATE OR REPLACE FUNCTION receipts_are_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'receipts are immutable: % is not permitted', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipts_no_change
    BEFORE UPDATE OR DELETE ON receipts
    FOR EACH ROW EXECUTE FUNCTION receipts_are_immutable();
