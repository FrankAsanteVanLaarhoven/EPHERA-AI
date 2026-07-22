// Package authgrant defines the authorisation grant: a signed, single-use,
// transaction-bound assertion that money movement was authorised.
//
// It replaces the free-text `authorisationRef` string, which the payment
// orchestrator accepted on a length check and the ledger accepted on a presence
// check. That string was unverified, unbound and infinitely replayable, and
// every client manufactured its own (deviations D-01, D-07, D-31, D-32).
//
// A grant is verified by the ledger itself, because the ledger is the authority
// for balances (ADR 0001) and must not accept an assertion it has not checked
// (ADR 0002). Verification is offline -- a signature check against the identity
// service's public key -- so the ledger does not depend on that service being
// reachable to refuse a forgery.
//
// Wire format:
//
//	base64url(payload JSON) "." base64url(ed25519 signature)
//
// The signature covers the encoded payload bytes exactly as transmitted, so
// verification never re-serialises and there is no canonicalisation ambiguity.
package authgrant

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	// Version is carried in every payload so the format can change without
	// ambiguity about what a verifier is looking at.
	Version = "ephera-authorisation-grant/1"

	// Issuer is the only party permitted to mint grants.
	Issuer = "ephera-identity-access"

	// MaxLifetime bounds how long a grant remains usable regardless of what
	// the issuer asked for. A grant authorises one transaction that a human
	// has just confirmed; it is not a session.
	MaxLifetime = 5 * time.Minute

	// MaxClockSkew tolerates modest clock drift between issuer and verifier.
	MaxClockSkew = 30 * time.Second
)

var (
	ErrMalformed    = errors.New("grant malformed")
	ErrBadSignature = errors.New("grant signature invalid")
	ErrExpired      = errors.New("grant expired")
	ErrNotYetValid  = errors.New("grant not yet valid")
	ErrWrongIssuer  = errors.New("grant issuer not recognised")
	ErrWrongVersion = errors.New("grant version not recognised")
	ErrBindingMismatch = errors.New("grant is not bound to this transaction")
	ErrLifetimeTooLong = errors.New("grant lifetime exceeds the permitted maximum")
)

// Method records how the human actually authorised. It is carried in the grant
// and written to evidence, so a reviewer can tell a real authenticator from a
// sandbox one without inspecting configuration (ADR 0009).
type Method string

const (
	// MethodPasskey is a verified WebAuthn assertion from a device-bound
	// credential, where the authenticator challenge is the transaction's
	// binding digest. Implemented in identity-access (mintWithPasskey) and
	// covered by TestPasskeyCeremonyMintsAVerifiableGrant.
	MethodPasskey Method = "passkey"

	// MethodSandboxAuthenticator is a grant minted without any authenticator
	// challenge. It exists so the sandbox remains demonstrable. It is refused by
	// the ledger money path unless the deployment explicitly opts in
	// (Store.AllowSandboxMethod); authgrant.Verify does not itself gate on the
	// method, so a verifier that accepts any method must add that check.
	MethodSandboxAuthenticator Method = "sandbox_authenticator"
)

// Binding is the exact transaction a grant authorises. Every field that
// determines where money goes is covered; changing any of them invalidates the
// grant.
type Binding struct {
	FromExternalRef string
	ToExternalRef   string
	AmountMinor     int64
	FeeMinor        int64
	Currency        string
	TransferID      string
}

// Digest is a length-prefixed hash, so no combination of field values can be
// rearranged into a different transaction that hashes the same.
func (b Binding) Digest() string {
	h := sha256.New()
	h.Write([]byte(Version))
	writeField(h, []byte(b.FromExternalRef))
	writeField(h, []byte(b.ToExternalRef))
	writeInt(h, b.AmountMinor)
	writeInt(h, b.FeeMinor)
	writeField(h, []byte(b.Currency))
	writeField(h, []byte(b.TransferID))
	return hex.EncodeToString(h.Sum(nil))
}

func writeField(h interface{ Write([]byte) (int, error) }, b []byte) {
	var n [8]byte
	binary.BigEndian.PutUint64(n[:], uint64(len(b)))
	_, _ = h.Write(n[:])
	_, _ = h.Write(b)
}

func writeInt(h interface{ Write([]byte) (int, error) }, v int64) {
	var n [8]byte
	binary.BigEndian.PutUint64(n[:], uint64(v))
	_, _ = h.Write(n[:])
}

// Payload is the signed content of a grant.
type Payload struct {
	Version   string `json:"v"`
	ID        string `json:"jti"`
	Issuer    string `json:"iss"`
	Subject   string `json:"sub"`
	Method    Method `json:"method"`
	Binding   string `json:"binding"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

// Mint signs a payload. Only the identity service holds a private key.
func Mint(key ed25519.PrivateKey, p Payload) (string, error) {
	if len(key) != ed25519.PrivateKeySize {
		return "", fmt.Errorf("%w: private key wrong size", ErrMalformed)
	}
	if p.Version == "" {
		p.Version = Version
	}
	if p.Issuer == "" {
		p.Issuer = Issuer
	}
	if p.ID == "" || p.Subject == "" || p.Binding == "" {
		return "", fmt.Errorf("%w: jti, sub and binding are required", ErrMalformed)
	}
	if p.ExpiresAt-p.IssuedAt > int64(MaxLifetime.Seconds()) {
		return "", ErrLifetimeTooLong
	}

	body, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(body)
	sig := ed25519.Sign(key, []byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// ParseUnverified decodes a grant WITHOUT checking its signature.
//
// It exists so a service that is not the authority can fail fast on an
// obviously wrong grant -- for example, the payment orchestrator refusing to
// start a workflow for a grant that claims a different transaction. Nothing it
// returns is trustworthy. Never make an authorisation decision on this.
func ParseUnverified(grant string) (Payload, error) {
	encoded, _, ok := strings.Cut(grant, ".")
	if !ok || encoded == "" {
		return Payload{}, fmt.Errorf("%w: expected payload.signature", ErrMalformed)
	}
	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return Payload{}, fmt.Errorf("%w: payload is not base64url", ErrMalformed)
	}
	var p Payload
	if err := json.Unmarshal(body, &p); err != nil {
		return Payload{}, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	return p, nil
}

// Verify checks the signature, the issuer, the version, the validity window and
// the transaction binding. It does not check single use -- that is the
// verifier's responsibility, because it requires durable state (see the ledger's
// authorisation_grants table).
func Verify(pub ed25519.PublicKey, grant string, want Binding, now time.Time) (Payload, error) {
	if len(pub) != ed25519.PublicKeySize {
		return Payload{}, fmt.Errorf("%w: public key wrong size", ErrMalformed)
	}

	encoded, sigPart, ok := strings.Cut(grant, ".")
	if !ok || encoded == "" || sigPart == "" {
		return Payload{}, fmt.Errorf("%w: expected payload.signature", ErrMalformed)
	}
	sig, err := base64.RawURLEncoding.DecodeString(sigPart)
	if err != nil {
		return Payload{}, fmt.Errorf("%w: signature is not base64url", ErrMalformed)
	}

	// Signature first: nothing inside the payload is trusted until it verifies.
	if !ed25519.Verify(pub, []byte(encoded), sig) {
		return Payload{}, ErrBadSignature
	}

	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return Payload{}, fmt.Errorf("%w: payload is not base64url", ErrMalformed)
	}
	var p Payload
	dec := json.NewDecoder(strings.NewReader(string(body)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&p); err != nil {
		return Payload{}, fmt.Errorf("%w: %v", ErrMalformed, err)
	}

	if p.Version != Version {
		return Payload{}, ErrWrongVersion
	}
	if p.Issuer != Issuer {
		return Payload{}, ErrWrongIssuer
	}
	if p.ID == "" {
		return Payload{}, fmt.Errorf("%w: jti is required", ErrMalformed)
	}
	if p.ExpiresAt-p.IssuedAt > int64(MaxLifetime.Seconds()) {
		return Payload{}, ErrLifetimeTooLong
	}
	if now.Add(MaxClockSkew).Unix() < p.IssuedAt {
		return Payload{}, ErrNotYetValid
	}
	if now.Add(-MaxClockSkew).Unix() > p.ExpiresAt {
		return Payload{}, ErrExpired
	}
	if p.Binding != want.Digest() {
		return Payload{}, ErrBindingMismatch
	}
	return p, nil
}
