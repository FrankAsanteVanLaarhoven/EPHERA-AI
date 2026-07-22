-- Platform flags: the control plane owns the state that gates behaviour.
--
-- The kill switch used to flip an array in one console process that no service
-- read (D-17). An operator could press "stop sends", see it succeed, and watch
-- payments continue — the worst possible failure for a control, because it is
-- indistinguishable from working until it matters.
--
-- Flags live here because this is the service that already authenticates
-- operators, requires a second approver for sensitive changes, and writes an
-- append-only audit trail. A flag change is exactly such a change.

CREATE TABLE platform_flags (
    key         TEXT PRIMARY KEY,
    enabled     BOOLEAN NOT NULL,
    description TEXT NOT NULL,
    updated_by  TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The change request that authorised the current value. A flag that gates
    -- money movement should be traceable to an approval, not to a person who
    -- happened to have access.
    change_request_id UUID REFERENCES change_requests (id)
);

-- Every value the flag has ever held. A flag's history is the answer to "were
-- payments stopped at 14:20, and who stopped them" — which is the first
-- question after an incident.
CREATE TABLE platform_flag_history (
    seq         BIGSERIAL PRIMARY KEY,
    key         TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL,
    changed_by  TEXT NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_request_id UUID REFERENCES change_requests (id)
);

CREATE INDEX platform_flag_history_key_idx ON platform_flag_history (key, changed_at DESC);

CREATE OR REPLACE FUNCTION platform_flag_history_is_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'platform_flag_history is append-only: % is not permitted', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_flag_history_no_change
    BEFORE UPDATE OR DELETE ON platform_flag_history
    FOR EACH ROW EXECUTE FUNCTION platform_flag_history_is_append_only();

-- Seeded enabled: the sandbox works until somebody deliberately stops it.
INSERT INTO platform_flags (key, enabled, description, updated_by) VALUES
    ('payments.sends_enabled', true,
     'Master switch for outbound customer payments. Disabling stops sends at the orchestrator.',
     'system:seed'),
    ('payments.cross_border_enabled', true,
     'Cross-border corridor availability.',
     'system:seed')
ON CONFLICT (key) DO NOTHING;
