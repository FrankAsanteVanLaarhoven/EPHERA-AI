package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/google/uuid"
)

// Enrolment authorisation.
//
// Registering a passkey binds a credential to a subject, and every downstream
// control — operator maker-checker, payment authorisation — trusts that binding.
// So registration cannot be open: if anyone can register a credential for any
// subject, an attacker registers their own authenticator against a seeded
// operator subject, obtains an operator session, and drives maker-checker with
// two identities they control. The whole trust model collapses at enrolment.
//
// An enrolment token authorises registering a passkey for exactly one subject,
// once. It is a distinct credential type from a grant and a session — its own
// version string, so it can never be presented where one of those is required —
// signed by the identity key, short-lived, and consumed at register/begin.
//
// Who may obtain one:
//   - Sandbox: anyone, so demos and local development still work.
//   - Production: an authenticated operator (a valid operator session). New
//     subjects are provisioned by someone already trusted. The very first
//     operator is seeded out of band, the same way any root of trust is.
//
// Self-service customer enrolment in production is deliberately NOT open here:
// it belongs behind an authenticated onboarding flow (post-identity-proofing),
// which issues a token the same way. Until that exists, enrolment is
// operator-provisioned and fails closed — which is the safe direction.

const enrolmentVersion = "ephera-enrolment-token/1"

// EnrolmentTokenTTL bounds how long a token is usable. Enrolment is an
// administrative action someone has just taken; it is not a standing capability.
const EnrolmentTokenTTL = 10 * time.Minute

var (
	ErrEnrolmentMalformed = errors.New("enrolment token malformed")
	ErrEnrolmentSignature = errors.New("enrolment token signature invalid")
	ErrEnrolmentExpired   = errors.New("enrolment token expired")
	ErrEnrolmentVersion   = errors.New("enrolment token version not recognised")
	ErrEnrolmentSubject   = errors.New("enrolment token is for a different subject")
)

type enrolmentPayload struct {
	Version   string `json:"v"`
	ID        string `json:"jti"`
	Subject   string `json:"sub"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

// mintEnrolmentToken signs a token authorising registration for subject.
func mintEnrolmentToken(key ed25519.PrivateKey, subject string, now time.Time) (string, string, error) {
	if subject == "" {
		return "", "", fmt.Errorf("%w: subject required", ErrEnrolmentMalformed)
	}
	jti := "enrol_" + uuid.NewString()
	body, err := json.Marshal(enrolmentPayload{
		Version:   enrolmentVersion,
		ID:        jti,
		Subject:   subject,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(EnrolmentTokenTTL).Unix(),
	})
	if err != nil {
		return "", "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(body)
	sig := ed25519.Sign(key, []byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(sig), jti, nil
}

// verifyEnrolmentToken checks the signature FIRST, then the version, subject and
// validity window. It does not check single use — that requires durable state
// and is the caller's responsibility (see the consume step in register/begin).
func verifyEnrolmentToken(pub ed25519.PublicKey, token, subject string, now time.Time) (enrolmentPayload, error) {
	encoded, sigPart, ok := strings.Cut(token, ".")
	if !ok || encoded == "" || sigPart == "" {
		return enrolmentPayload{}, fmt.Errorf("%w: expected payload.signature", ErrEnrolmentMalformed)
	}
	sig, err := base64.RawURLEncoding.DecodeString(sigPart)
	if err != nil {
		return enrolmentPayload{}, fmt.Errorf("%w: signature not base64url", ErrEnrolmentMalformed)
	}
	// Signature before payload: nothing inside is trusted until it verifies.
	if !ed25519.Verify(pub, []byte(encoded), sig) {
		return enrolmentPayload{}, ErrEnrolmentSignature
	}
	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return enrolmentPayload{}, fmt.Errorf("%w: payload not base64url", ErrEnrolmentMalformed)
	}
	dec := json.NewDecoder(strings.NewReader(string(body)))
	dec.DisallowUnknownFields()
	var p enrolmentPayload
	if err := dec.Decode(&p); err != nil {
		return enrolmentPayload{}, fmt.Errorf("%w: %v", ErrEnrolmentMalformed, err)
	}
	if p.Version != enrolmentVersion {
		return enrolmentPayload{}, ErrEnrolmentVersion
	}
	if p.ID == "" {
		return enrolmentPayload{}, fmt.Errorf("%w: jti required for single use", ErrEnrolmentMalformed)
	}
	if p.Subject != subject {
		// A token for subject A cannot authorise registering subject B.
		return enrolmentPayload{}, ErrEnrolmentSubject
	}
	if now.Add(-30*time.Second).Unix() > p.ExpiresAt {
		return enrolmentPayload{}, ErrEnrolmentExpired
	}
	return p, nil
}

// issueEnrolmentToken hands out a token authorising passkey registration for a
// subject.
//
//   - Sandbox: open, so local development and demos can register freely.
//   - Production: requires a valid operator session. An already-authenticated
//     operator provisions the subject.
func (s *server) issueEnrolmentToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Subject         string `json:"subject"`
		OperatorSession string `json:"operatorSession"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Subject == "" {
		http.Error(w, "subject is required", http.StatusBadRequest)
		return
	}

	if !s.enrolmentOpen {
		// Production: only an authenticated operator may provision enrolment.
		if req.OperatorSession == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "operator_session_required",
				"message": "Enrolment is provisioned by an authenticated operator outside the sandbox.",
			})
			return
		}
		if _, err := session.Verify(s.pub, req.OperatorSession, time.Now()); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "operator_session_invalid",
				"message": err.Error(),
			})
			return
		}
	}

	token, _, err := mintEnrolmentToken(s.priv, req.Subject, time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"enrolmentToken":   token,
		"subject":          req.Subject,
		"expiresInSeconds": int(EnrolmentTokenTTL.Seconds()),
	})
}

// requireEnrolment authorises a registration ceremony for subject. In the
// sandbox it is a no-op; otherwise it verifies the token and consumes it, so a
// token authorises exactly one registration.
func (s *server) requireEnrolment(r *http.Request, subject, token string) error {
	if s.enrolmentOpen {
		return nil
	}
	if token == "" {
		return fmt.Errorf("enrolment token is required to register a passkey")
	}
	p, err := verifyEnrolmentToken(s.pub, token, subject, time.Now())
	if err != nil {
		return err
	}
	// Single use: consume the jti durably, in the same spirit as a grant. A
	// second registration with the same token collides on the primary key.
	if err := s.store.ConsumeEnrolmentToken(r.Context(), p.ID, subject); err != nil {
		return err
	}
	return nil
}
