-- An operator-initiated freeze is authorised differently from a customer
-- payment: the authority is an approved change request carried out by an
-- authenticated operator, not a passkey assertion over a transaction.
--
-- Before this, freeze accepted any non-empty string as authorisation, the same
-- weakness capture had until G2-A (D-01). It now requires a verified operator
-- session, and evidence records which approved change it came from.
ALTER TABLE authorisation_evidence DROP CONSTRAINT authorisation_evidence_method_check;
ALTER TABLE authorisation_evidence ADD CONSTRAINT authorisation_evidence_method_check
    CHECK (method IN (
        'passkey', 'pin', 'biometric', 'policy_auto_low_risk',
        'sandbox_authenticator', 'operator_session'
    ));

ALTER TABLE authorisation_evidence ADD COLUMN change_request_id TEXT;
ALTER TABLE authorisation_evidence ADD COLUMN operator_subject TEXT;

CREATE INDEX authorisation_evidence_change_idx ON authorisation_evidence (change_request_id);
