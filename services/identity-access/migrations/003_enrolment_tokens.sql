-- Enrolment tokens consumed at passkey registration.
--
-- Registration used to be open: the subject was taken from the request body
-- with nothing proving the caller controlled it, so a credential could be
-- registered for any subject — including a seeded operator, which defeats
-- maker-checker. Registration now requires a single-use enrolment token, and
-- this table is what makes it single-use: the consuming INSERT collides on the
-- primary key if the same token is presented twice.
CREATE TABLE IF NOT EXISTS enrolment_tokens (
    jti         TEXT PRIMARY KEY,
    subject     TEXT NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrolment_tokens_subject_idx ON enrolment_tokens (subject);
