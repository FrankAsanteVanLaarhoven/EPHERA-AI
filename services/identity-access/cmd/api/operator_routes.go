package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/ephera/identity-access/internal/passkey"
	"github.com/ephera/identity-access/internal/store"
	"github.com/google/uuid"
)

// Operator login.
//
// An operator authenticates the same way a customer authorises a payment: a
// WebAuthn assertion from a registered, device-bound credential. There is no
// password anywhere in this path, which is what "no password-only
// administration" means in practice.
//
// The session this mints says only who the operator is. It deliberately does
// not say what they may do: the control plane owns authorisation and re-reads
// roles from its own database, so a stale or over-claimed session cannot widen
// access (D-12).

const operatorRole = "operator"

type operatorLoginRequest struct {
	Subject string `json:"subject"`
}

func (s *server) operatorSessionChallenge(w http.ResponseWriter, r *http.Request) {
	var req operatorLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Subject == "" {
		http.Error(w, "subject is required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	user, err := s.store.EnsureUser(ctx, req.Subject, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	opts, sess, err := s.passkeys.BeginOperatorLogin(user)
	if err != nil {
		if errors.Is(err, passkey.ErrNoCredential) {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error":   "no_passkey",
				"message": "No passkey is registered for this operator. Register one first.",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.store.SaveChallenge(ctx, store.Challenge{
		Challenge: sess.Challenge,
		Subject:   req.Subject,
		Ceremony:  "operator_session",
		Session:   *sess,
		ExpiresAt: time.Now().Add(passkey.ChallengeTTL),
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"assertion": opts,
		"challenge": sess.Challenge,
	})
}

type operatorSessionRequest struct {
	Subject   string          `json:"subject"`
	Challenge string          `json:"challenge"`
	Assertion json.RawMessage `json:"assertion"`
}

func (s *server) operatorSession(w http.ResponseWriter, r *http.Request) {
	var req operatorSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Subject == "" || req.Challenge == "" || len(req.Assertion) == 0 {
		http.Error(w, "subject, challenge and assertion are required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	ch, err := s.store.ConsumeChallenge(ctx, req.Challenge)
	if err != nil {
		writeChallengeErr(w, err)
		return
	}
	if ch.Ceremony != "operator_session" || ch.Subject != req.Subject {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "challenge_mismatch",
			"message": "This challenge was issued for a different ceremony or operator.",
		})
		return
	}

	user, err := s.store.EnsureUser(ctx, req.Subject, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	cred, err := s.passkeys.FinishOperatorLogin(user, ch.Session, bytes.NewReader(req.Assertion))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "assertion_failed", "message": err.Error()})
		return
	}
	// A counter regression means a possible cloned authenticator. An operator
	// login is at least as sensitive as a payment, so it fails closed too: no
	// session is minted and the stored counter is not lowered.
	if cred.Authenticator.CloneWarning {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "authenticator_clone_suspected",
			"message": "The authenticator's signature counter did not advance; login is refused.",
		})
		return
	}
	if err := s.store.UpdateSignCount(ctx, cred); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	now := time.Now()
	token, err := session.Mint(s.priv, session.Payload{
		ID:      "sess_" + uuid.NewString(),
		Subject: req.Subject,
		// Identity attests that this is an authenticated operator. What that
		// operator may do is resolved by the control plane from its own records.
		Roles:     []string{operatorRole},
		Method:    session.MethodPasskey,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(session.MaxLifetime).Unix(),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"session":      token,
		"subject":      req.Subject,
		"method":       string(session.MethodPasskey),
		"expiresIn":    int(session.MaxLifetime.Seconds()),
		"cloneWarning": cred.Authenticator.CloneWarning,
	})
}
