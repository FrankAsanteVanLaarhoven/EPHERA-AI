package store

import (
	"crypto/ed25519"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/ephera/authgrant"
	"github.com/jackc/pgx/v5/pgconn"
)

// Authorisation verification at the ledger boundary.
//
// The ledger is the authority for balances (ADR 0001), so it verifies the
// authorisation itself. It does not delegate this to the payment orchestrator,
// and it does not call the identity service at capture time: verification is a
// signature check against a public key, so a forged grant is refused even if
// the identity service is unreachable.

var (
	ErrGrantAlreadyUsed   = errors.New("authorisation grant already used")
	ErrGrantNotVerifiable = errors.New("ledger has no authorisation public key configured")
)

// SetAuthorisationKey configures the public key grants are verified against.
// Without it the ledger refuses every transfer: an unverifiable authorisation
// is not an authorisation, and failing closed is the only safe default.
func (s *Store) SetAuthorisationKey(pub ed25519.PublicKey) {
	s.authPublicKey = pub
}

// ParseAuthorisationKey reads a hex-encoded ed25519 public key.
func ParseAuthorisationKey(hexKey string) (ed25519.PublicKey, error) {
	raw, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("authorisation public key is not hex: %w", err)
	}
	if len(raw) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("authorisation public key must be %d bytes, got %d",
			ed25519.PublicKeySize, len(raw))
	}
	return ed25519.PublicKey(raw), nil
}

func (s *Store) verifyGrant(req TransferRequest) (authgrant.Payload, error) {
	if len(s.authPublicKey) == 0 {
		return authgrant.Payload{}, ErrGrantNotVerifiable
	}
	if req.AuthorisationRef == "" {
		return authgrant.Payload{}, ErrUnauthorised
	}

	binding := authgrant.Binding{
		FromExternalRef: req.FromExternalRef,
		ToExternalRef:   req.ToExternalRef,
		AmountMinor:     req.AmountMinor,
		FeeMinor:        req.FeeMinor,
		Currency:        req.Currency,
		TransferID:      req.TransferID,
	}

	p, err := authgrant.Verify(s.authPublicKey, req.AuthorisationRef, binding, time.Now())
	if err != nil {
		// Every verification failure is an authorisation failure to the caller.
		// The specific reason is returned for operator diagnosis, not to help a
		// caller find an accepted shape.
		return authgrant.Payload{}, fmt.Errorf("%w: %v", ErrUnauthorised, err)
	}
	return p, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

// AuthorisationKey exposes the configured public key. Operator sessions are
// signed by the same identity service, so they verify against the same key.
func (s *Store) AuthorisationKey() ed25519.PublicKey { return s.authPublicKey }
