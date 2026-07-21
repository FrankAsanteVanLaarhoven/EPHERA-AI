-- Transfer IDs are opaque strings from the payments service (tx_...), not always UUIDs.
ALTER TABLE journal_entries
    ALTER COLUMN transfer_id TYPE TEXT USING transfer_id::text;

ALTER TABLE holds
    ALTER COLUMN transfer_id TYPE TEXT USING transfer_id::text;

ALTER TABLE authorisation_evidence
    ALTER COLUMN transfer_id TYPE TEXT USING transfer_id::text;
