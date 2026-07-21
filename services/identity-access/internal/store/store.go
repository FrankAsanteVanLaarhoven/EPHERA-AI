// Package store persists passkey credentials and ceremony challenges.
//
// It holds public keys only. The private key never leaves the user's device,
// which is the property that makes a passkey assertion evidence of intent
// rather than evidence that a server was asked nicely (ADR 0002).
package store

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound          = errors.New("not found")
	ErrChallengeConsumed = errors.New("challenge already used")
	ErrChallengeExpired  = errors.New("challenge expired")
)

type Store struct{ pool *pgxpool.Pool }

func New(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// User implements webauthn.User. Credentials are loaded eagerly because every
// ceremony needs them.
type User struct {
	Subject     string
	Handle      []byte
	DisplayName string
	Creds       []webauthn.Credential
}

func (u *User) WebAuthnID() []byte                         { return u.Handle }
func (u *User) WebAuthnName() string                       { return u.Subject }
func (u *User) WebAuthnDisplayName() string                { return u.DisplayName }
func (u *User) WebAuthnCredentials() []webauthn.Credential { return u.Creds }

// EnsureUser returns the user, creating the record on first sight. A user with
// no credentials is legitimate -- it is the state between registration begin
// and finish.
func (s *Store) EnsureUser(ctx context.Context, subject, displayName string) (*User, error) {
	if displayName == "" {
		displayName = subject
	}
	handle := make([]byte, 32)
	if _, err := rand.Read(handle); err != nil {
		return nil, err
	}
	u := &User{Subject: subject}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO webauthn_users (subject, user_handle, display_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (subject) DO UPDATE SET subject = EXCLUDED.subject
		RETURNING user_handle, display_name
	`, subject, handle, displayName).Scan(&u.Handle, &u.DisplayName)
	if err != nil {
		return nil, err
	}
	creds, err := s.CredentialsFor(ctx, subject)
	if err != nil {
		return nil, err
	}
	u.Creds = creds
	return u, nil
}

func (s *Store) CredentialsFor(ctx context.Context, subject string) ([]webauthn.Credential, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT credential_id, public_key, attestation_type, aaguid, sign_count, clone_warning
		FROM webauthn_credentials WHERE subject = $1
	`, subject)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []webauthn.Credential
	for rows.Next() {
		var c webauthn.Credential
		if err := rows.Scan(&c.ID, &c.PublicKey, &c.AttestationType, &c.Authenticator.AAGUID,
			&c.Authenticator.SignCount, &c.Authenticator.CloneWarning); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// HasCredential reports whether a subject has registered a passkey. A subject
// that has one must use it; there is no fallback to a weaker method.
func (s *Store) HasCredential(ctx context.Context, subject string) (bool, error) {
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM webauthn_credentials WHERE subject = $1`, subject).Scan(&n)
	return n > 0, err
}

func (s *Store) SaveCredential(ctx context.Context, subject string, c *webauthn.Credential) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO webauthn_credentials
			(credential_id, subject, public_key, attestation_type, aaguid, sign_count)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (credential_id) DO NOTHING
	`, c.ID, subject, c.PublicKey, c.AttestationType, c.Authenticator.AAGUID, c.Authenticator.SignCount)
	return err
}

// UpdateSignCount records the authenticator's counter after a successful
// assertion. A counter that fails to advance is how cloned authenticators are
// detected, so it is stored rather than ignored.
func (s *Store) UpdateSignCount(ctx context.Context, c *webauthn.Credential) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE webauthn_credentials
		SET sign_count = $2, clone_warning = $3, last_used_at = now()
		WHERE credential_id = $1
	`, c.ID, c.Authenticator.SignCount, c.Authenticator.CloneWarning)
	return err
}

type Challenge struct {
	Challenge     string
	Subject       string
	Ceremony      string
	Session       webauthn.SessionData
	BindingDigest string
	TransferID    string
	ExpiresAt     time.Time
}

func (s *Store) SaveChallenge(ctx context.Context, c Challenge) error {
	sess, err := json.Marshal(c.Session)
	if err != nil {
		return err
	}
	var binding, transfer *string
	if c.BindingDigest != "" {
		binding = &c.BindingDigest
	}
	if c.TransferID != "" {
		transfer = &c.TransferID
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO webauthn_challenges
			(challenge, subject, ceremony, session_data, binding_digest, transfer_id, expires_at)
		VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
	`, c.Challenge, c.Subject, c.Ceremony, sess, binding, transfer, c.ExpiresAt)
	return err
}

// ConsumeChallenge atomically marks a challenge used and returns it. A second
// attempt fails, so a captured assertion cannot be replayed.
func (s *Store) ConsumeChallenge(ctx context.Context, challenge string) (Challenge, error) {
	var c Challenge
	var sess []byte
	var binding, transfer *string
	var consumed *time.Time

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return c, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		SELECT challenge, subject, ceremony, session_data, binding_digest, transfer_id,
		       expires_at, consumed_at
		FROM webauthn_challenges WHERE challenge = $1 FOR UPDATE
	`, challenge).Scan(&c.Challenge, &c.Subject, &c.Ceremony, &sess, &binding, &transfer,
		&c.ExpiresAt, &consumed)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	if err != nil {
		return c, err
	}
	if consumed != nil {
		return c, ErrChallengeConsumed
	}
	if time.Now().After(c.ExpiresAt) {
		return c, ErrChallengeExpired
	}
	if err := json.Unmarshal(sess, &c.Session); err != nil {
		return c, fmt.Errorf("session data: %w", err)
	}
	if binding != nil {
		c.BindingDigest = *binding
	}
	if transfer != nil {
		c.TransferID = *transfer
	}
	if _, err := tx.Exec(ctx,
		`UPDATE webauthn_challenges SET consumed_at = now() WHERE challenge = $1`, challenge); err != nil {
		return c, err
	}
	return c, tx.Commit(ctx)
}
