// Package session defines the operator session token.
//
// It is deliberately a separate credential from an authorisation grant. A grant
// authorises one transaction and is consumed; a session identifies a person for
// a short period and authorises nothing on its own. Conflating the two would
// let a session stand in for customer consent, which is exactly the confusion
// the grant format exists to prevent.
//
// A session says who the operator is and what roles they held at issue time. It
// is minted only after a verified passkey assertion, and it is verified offline
// by the control plane against the identity service's public key -- so the
// control plane refuses a forged session even when identity-access is down.
//
// What a session never does: authorise a specific action. Every privileged
// action is checked against the roles in the session at the moment it is
// attempted, and sensitive ones additionally require a second operator.
package session

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	Version = "ephera-operator-session/1"
	Issuer  = "ephera-identity-access"

	// MaxLifetime bounds a session regardless of what the issuer asked for.
	// Operators re-authenticate; a console tab left open overnight does not
	// stay privileged.
	MaxLifetime = 30 * time.Minute

	MaxClockSkew = 30 * time.Second
)

var (
	ErrMalformed    = errors.New("session malformed")
	ErrBadSignature = errors.New("session signature invalid")
	ErrExpired      = errors.New("session expired")
	ErrNotYetValid  = errors.New("session not yet valid")
	ErrWrongIssuer  = errors.New("session issuer not recognised")
	ErrWrongVersion = errors.New("session version not recognised")
	ErrLifetimeTooLong = errors.New("session lifetime exceeds the permitted maximum")
)

// Method records how the operator authenticated, and travels into the audit
// record so a reviewer can tell a passkey login from anything weaker.
type Method string

const (
	MethodPasskey Method = "passkey"
	// MethodSandboxOperator is a session issued with no authenticator
	// challenge. Sandbox only, opt-in, and never usable where a passkey is
	// registered for that operator.
	MethodSandboxOperator Method = "sandbox_operator"
)

type Payload struct {
	Version   string   `json:"v"`
	ID        string   `json:"jti"`
	Issuer    string   `json:"iss"`
	Subject   string   `json:"sub"`
	Roles     []string `json:"roles"`
	Method    Method   `json:"method"`
	IssuedAt  int64    `json:"iat"`
	ExpiresAt int64    `json:"exp"`
}

// HasRole reports whether the session carries a role. Role checks are always
// made against the session, never against a value supplied by the caller.
func (p Payload) HasRole(role string) bool {
	for _, r := range p.Roles {
		if r == role {
			return true
		}
	}
	return false
}

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
	if p.ID == "" || p.Subject == "" {
		return "", fmt.Errorf("%w: jti and sub are required", ErrMalformed)
	}
	if len(p.Roles) == 0 {
		return "", fmt.Errorf("%w: a session with no roles authorises nothing; refuse to mint it", ErrMalformed)
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

func Verify(pub ed25519.PublicKey, token string, now time.Time) (Payload, error) {
	if len(pub) != ed25519.PublicKeySize {
		return Payload{}, fmt.Errorf("%w: public key wrong size", ErrMalformed)
	}
	encoded, sigPart, ok := strings.Cut(token, ".")
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
	if p.ID == "" || p.Subject == "" || len(p.Roles) == 0 {
		return Payload{}, fmt.Errorf("%w: jti, sub and roles are required", ErrMalformed)
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
	return p, nil
}
