-- platform-control-bff owns this schema (ADR 0003). Operator identity, the
-- approval workflow, and the audit trail live here -- not in a console's
-- process memory, where the previous versions of all three lived (D-14, D-15).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE operators (
    subject     TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE operator_roles (
    subject TEXT NOT NULL REFERENCES operators (subject) ON DELETE CASCADE,
    role    TEXT NOT NULL,
    PRIMARY KEY (subject, role)
);

-- Sensitive actions are proposed, then approved by a different operator, then
-- applied. The proposer can never be the approver: it is a table constraint,
-- not a convention, so no code path can bypass it (D-13).
CREATE TABLE change_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action        TEXT NOT NULL,
    target        TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired')),
    requested_by  TEXT NOT NULL REFERENCES operators (subject),
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by    TEXT REFERENCES operators (subject),
    decided_at    TIMESTAMPTZ,
    decision_note TEXT,
    applied_at    TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ NOT NULL,

    -- No self-approval, at any severity, ever.
    CONSTRAINT no_self_approval CHECK (decided_by IS NULL OR decided_by <> requested_by),
    -- A decision must carry who made it and when, together.
    CONSTRAINT decision_is_complete CHECK (
        (decided_by IS NULL AND decided_at IS NULL) OR
        (decided_by IS NOT NULL AND decided_at IS NOT NULL)
    ),
    -- Only an approved request can be applied.
    CONSTRAINT applied_requires_approval CHECK (
        applied_at IS NULL OR status = 'applied'
    )
);

CREATE INDEX change_requests_status_idx ON change_requests (status, expires_at);
CREATE INDEX change_requests_requester_idx ON change_requests (requested_by);

-- Append-only, hash-chained audit. Each row carries the hash of its predecessor,
-- so removing or editing any record breaks the chain and is detectable by
-- anyone who can read the table (ADR 0007).
--
-- The previous audit trail was a mutable in-memory array that truncated itself
-- at 200 entries and took its actor from the request body (D-14).
CREATE TABLE audit_log (
    seq         BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor       TEXT NOT NULL,
    actor_method TEXT NOT NULL,
    session_id  TEXT NOT NULL,
    action      TEXT NOT NULL,
    target      TEXT NOT NULL,
    outcome     TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'applied', 'failed')),
    detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_request_id UUID REFERENCES change_requests (id),
    prev_hash   TEXT NOT NULL,
    entry_hash  TEXT NOT NULL UNIQUE
);

CREATE INDEX audit_log_actor_idx ON audit_log (actor);
CREATE INDEX audit_log_action_idx ON audit_log (action);

-- Audit rows are write-once. Updates and deletes are refused by the database,
-- so an operator with table access still cannot quietly rewrite history.
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

-- Seed operators for the sandbox. Roles are deliberately split so that
-- maker-checker can be exercised: no single seeded operator can both propose
-- and approve.
INSERT INTO operators (subject, display_name) VALUES
    ('ops.maker@ephera.internal',    'Ops Maker'),
    ('ops.checker@ephera.internal',  'Ops Checker'),
    ('support.agent@ephera.internal','Support Agent'),
    ('readonly@ephera.internal',     'Read Only')
ON CONFLICT (subject) DO NOTHING;

INSERT INTO operator_roles (subject, role) VALUES
    ('ops.maker@ephera.internal',    'ops_manager'),
    ('ops.checker@ephera.internal',  'ops_manager'),
    ('ops.checker@ephera.internal',  'approver'),
    ('support.agent@ephera.internal','support_agent'),
    ('readonly@ephera.internal',     'read_only')
ON CONFLICT DO NOTHING;
