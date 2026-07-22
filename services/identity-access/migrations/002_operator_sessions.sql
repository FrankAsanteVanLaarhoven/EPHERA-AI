-- Operator login is a third ceremony type: it proves who someone is, rather
-- than authorising a transaction, so it carries no binding digest.
ALTER TABLE webauthn_challenges DROP CONSTRAINT webauthn_challenges_ceremony_check;
ALTER TABLE webauthn_challenges ADD CONSTRAINT webauthn_challenges_ceremony_check
    CHECK (ceremony IN ('registration', 'authorisation', 'operator_session'));

-- The binding requirement applies only to transaction authorisations.
ALTER TABLE webauthn_challenges DROP CONSTRAINT authorisation_challenges_are_bound;
ALTER TABLE webauthn_challenges ADD CONSTRAINT authorisation_challenges_are_bound
    CHECK (ceremony <> 'authorisation' OR (binding_digest IS NOT NULL AND transfer_id IS NOT NULL));
