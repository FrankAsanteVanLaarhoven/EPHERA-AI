-- identity-access owns this schema (ADR 0003). It is a separate database from
-- the ledger: credential material and money must not share a blast radius.

CREATE TABLE webauthn_users (
    subject      TEXT PRIMARY KEY,
    user_handle  BYTEA NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public keys only. No private key, seed or recovery secret is ever stored
-- here; the private key never leaves the user's device (ADR 0002).
CREATE TABLE webauthn_credentials (
    credential_id    BYTEA PRIMARY KEY,
    subject          TEXT NOT NULL REFERENCES webauthn_users (subject),
    public_key       BYTEA NOT NULL,
    attestation_type TEXT NOT NULL,
    aaguid           BYTEA,
    sign_count       BIGINT NOT NULL DEFAULT 0,
    clone_warning    BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at     TIMESTAMPTZ
);

CREATE INDEX webauthn_credentials_subject_idx ON webauthn_credentials (subject);

-- A challenge is single use and, for authorisation ceremonies, carries the
-- exact transaction it authorises. The authenticator signs the challenge, so
-- the device signature is over the transaction itself -- not over an opaque
-- random value that could be presented for anything.
CREATE TABLE webauthn_challenges (
    challenge      TEXT PRIMARY KEY,
    subject        TEXT NOT NULL,
    ceremony       TEXT NOT NULL CHECK (ceremony IN ('registration', 'authorisation')),
    session_data   JSONB NOT NULL,
    binding_digest TEXT,
    transfer_id    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    consumed_at    TIMESTAMPTZ,
    CONSTRAINT authorisation_challenges_are_bound
        CHECK (ceremony <> 'authorisation' OR (binding_digest IS NOT NULL AND transfer_id IS NOT NULL))
);

CREATE INDEX webauthn_challenges_expiry_idx ON webauthn_challenges (expires_at);
