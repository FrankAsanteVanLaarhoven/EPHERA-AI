-- KYB, KYA, and evidence that actually exists.
--
-- 001 verified customers. Two gaps remained: businesses and agents had no
-- model at all, and a tier decision cited an `evidence_ref` that was a free
-- string -- so a verification could be recorded against evidence nobody had
-- ever seen. A reference that points at nothing is not evidence.

-- Subjects are people, businesses or agents. They share the decision machinery
-- because the rule is the same in all three cases: someone other than the
-- subject decides, on evidence, and it is recorded.
ALTER TABLE customers ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'person'
    CHECK (subject_type IN ('person', 'business', 'agent'));

ALTER TABLE customers ADD COLUMN legal_name TEXT;

-- Tiers differ by subject type: a verified business is not a verified person,
-- and an agent handling cash has a float ceiling rather than a send limit.
ALTER TABLE kyc_tiers ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'person'
    CHECK (subject_type IN ('person', 'business', 'agent'));

-- The tier key becomes (subject_type, tier), so the foreign key that points at
-- it has to be rebuilt as a composite. Dropping it first keeps this ordered
-- rather than needing CASCADE, which would silently take the constraint with it.
ALTER TABLE customers DROP CONSTRAINT customers_tier_fkey;
ALTER TABLE kyc_tiers DROP CONSTRAINT kyc_tiers_pkey;
ALTER TABLE kyc_tiers DROP CONSTRAINT kyc_tiers_rank_key;
ALTER TABLE kyc_tiers ADD PRIMARY KEY (subject_type, tier);
-- Rank orders tiers within a subject type; it is not global.
ALTER TABLE kyc_tiers ADD CONSTRAINT kyc_tiers_rank_per_type UNIQUE (subject_type, rank);
ALTER TABLE customers ADD CONSTRAINT customers_tier_fkey
    FOREIGN KEY (subject_type, tier) REFERENCES kyc_tiers (subject_type, tier);

INSERT INTO kyc_tiers
    (subject_type, tier, rank, daily_limit_minor, single_limit_minor, new_recipient_limit_minor, description) VALUES
    -- KYB. A business is verified on its registration and the people behind it,
    -- so the unverified ceiling is zero for the same reason as a person's.
    ('business', 'unverified', 0,        0,       0,      0, 'No verified evidence. Cannot transact.'),
    ('business', 'registered', 1,  1000000,  200000, 100000, 'Registration verified.'),
    ('business', 'verified',   2, 10000000, 2000000, 500000, 'Registration plus beneficial ownership verified.'),
    -- KYA. The limits are float ceilings: an agent moves other people's cash,
    -- so the exposure is what they hold, not what they send.
    ('agent',    'unverified', 0,       0,      0,      0, 'No verified evidence. Cannot handle float.'),
    ('agent',    'provisional',1,  200000,  50000,  50000, 'Identity and device verified. Supervised float.'),
    ('agent',    'verified',   2, 2000000, 300000, 200000, 'Identity, device, location and float agreement verified.');

-- What evidence each tier requires. Data, not code, so a requirement change is
-- a migration with a record rather than a constant somebody recompiles.
CREATE TABLE tier_requirements (
    subject_type  TEXT NOT NULL,
    tier          TEXT NOT NULL,
    document_kind TEXT NOT NULL,
    PRIMARY KEY (subject_type, tier, document_kind),
    FOREIGN KEY (subject_type, tier) REFERENCES kyc_tiers (subject_type, tier)
);

INSERT INTO tier_requirements (subject_type, tier, document_kind) VALUES
    ('person',   'basic',       'phone_verification'),
    ('person',   'verified',    'government_id'),
    ('person',   'premium',     'government_id'),
    ('person',   'premium',     'source_of_funds'),
    ('business', 'registered',  'certificate_of_incorporation'),
    ('business', 'verified',    'certificate_of_incorporation'),
    ('business', 'verified',    'beneficial_ownership'),
    ('business', 'verified',    'director_identity'),
    ('agent',    'provisional', 'government_id'),
    ('agent',    'provisional', 'device_attestation'),
    ('agent',    'verified',    'government_id'),
    ('agent',    'verified',    'device_attestation'),
    ('agent',    'verified',    'float_agreement');

-- Evidence records.
--
-- The bytes live in object storage (G7); what is recorded here is the hash of
-- the content, so a document produced later can be shown to be the one that was
-- verified. A record with no hash is not evidence, which is why the column is
-- mandatory.
CREATE TABLE verification_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject       TEXT NOT NULL REFERENCES customers (subject),
    kind          TEXT NOT NULL,
    content_hash  TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'verified', 'rejected')),
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by   TEXT,
    reviewed_at   TIMESTAMPTZ,
    reviewer_note TEXT,
    expires_at    TIMESTAMPTZ,

    -- A document cannot be verified by the subject it describes.
    CONSTRAINT no_self_review CHECK (reviewed_by IS NULL OR reviewed_by <> subject),
    -- A review must record who and when together.
    CONSTRAINT review_is_complete CHECK (
        (status = 'submitted' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
        (status <> 'submitted' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX verification_documents_subject_idx ON verification_documents (subject, kind, status);

-- A tier decision now cites a document that exists.
ALTER TABLE tier_decisions ADD COLUMN evidence_document_id UUID REFERENCES verification_documents (id);
