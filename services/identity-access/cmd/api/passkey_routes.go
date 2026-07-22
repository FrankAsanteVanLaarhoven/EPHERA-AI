package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/ephera/authgrant"
	"github.com/ephera/identity-access/internal/passkey"
	"github.com/ephera/identity-access/internal/store"
	"github.com/google/uuid"
)

// Passkey ceremonies. A grant is minted only after a verified assertion whose
// challenge is the transaction's binding digest, so the device signature covers
// the exact transfer being authorised (ADR 0002).

type registerBeginRequest struct {
	Subject        string `json:"subject"`
	DisplayName    string `json:"displayName"`
	EnrolmentToken string `json:"enrolmentToken"`
}

func (s *server) passkeyRegisterBegin(w http.ResponseWriter, r *http.Request) {
	var req registerBeginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Subject == "" {
		http.Error(w, "subject is required", http.StatusBadRequest)
		return
	}
	// Enrolment must be authorised before a ceremony can start. Outside the
	// sandbox this consumes a single-use, subject-bound token, so a credential
	// cannot be registered for a subject the caller does not control. Consuming
	// it here (at begin) means the token authorises exactly one ceremony; the
	// resulting challenge is itself single-use and carries through to finish.
	if err := s.requireEnrolment(r, req.Subject, req.EnrolmentToken); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "enrolment_not_authorised",
			"message": err.Error(),
		})
		return
	}
	ctx := r.Context()
	user, err := s.store.EnsureUser(ctx, req.Subject, req.DisplayName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	opts, sess, err := s.passkeys.BeginRegistration(user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.store.SaveChallenge(ctx, store.Challenge{
		Challenge: sess.Challenge,
		Subject:   req.Subject,
		Ceremony:  "registration",
		Session:   *sess,
		ExpiresAt: time.Now().Add(passkey.ChallengeTTL),
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, opts)
}

type registerFinishRequest struct {
	Subject   string          `json:"subject"`
	Challenge string          `json:"challenge"`
	Response  json.RawMessage `json:"response"`
}

func (s *server) passkeyRegisterFinish(w http.ResponseWriter, r *http.Request) {
	var req registerFinishRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil ||
		req.Subject == "" || req.Challenge == "" || len(req.Response) == 0 {
		http.Error(w, "subject, challenge and response are required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	ch, err := s.store.ConsumeChallenge(ctx, req.Challenge)
	if err != nil {
		writeChallengeErr(w, err)
		return
	}
	if ch.Subject != req.Subject || ch.Ceremony != "registration" {
		http.Error(w, "challenge does not match this ceremony", http.StatusBadRequest)
		return
	}

	user, err := s.store.EnsureUser(ctx, req.Subject, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	cred, err := s.passkeys.FinishRegistration(user, ch.Session, bytes.NewReader(req.Response))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "registration_failed", "message": err.Error()})
		return
	}
	if err := s.store.SaveCredential(ctx, req.Subject, cred); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"registered": true,
		"subject":    req.Subject,
		"message":    "Passkey registered. Authorisations for this subject now require it.",
	})
}

// grantChallenge starts an authorisation ceremony for a prepared transfer.
func (s *server) grantChallenge(w http.ResponseWriter, r *http.Request) {
	var req grantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateGrantRequest(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	user, err := s.store.EnsureUser(ctx, req.Subject, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	binding := bindingOf(req)
	opts, sess, err := s.passkeys.BeginAuthorisation(user, binding)
	if err != nil {
		if errors.Is(err, passkey.ErrNoCredential) {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error":   "no_passkey",
				"message": "No passkey is registered for this subject. Register one first.",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.store.SaveChallenge(ctx, store.Challenge{
		Challenge:     sess.Challenge,
		Subject:       req.Subject,
		Ceremony:      "authorisation",
		Session:       *sess,
		BindingDigest: binding.Digest(),
		TransferID:    req.TransferID,
		ExpiresAt:     time.Now().Add(passkey.ChallengeTTL),
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"assertion":     opts,
		"challenge":     sess.Challenge,
		"bindingDigest": binding.Digest(),
	})
}

type grantFinishRequest struct {
	grantRequest
	Challenge string          `json:"challenge"`
	Assertion json.RawMessage `json:"assertion"`
}

// mintWithPasskey verifies the assertion and, only then, mints a grant whose
// method is `passkey`.
func (s *server) mintWithPasskey(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var req grantFinishRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateGrantRequest(&req.grantRequest); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Challenge == "" || len(req.Assertion) == 0 {
		http.Error(w, "challenge and assertion are required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	ch, err := s.store.ConsumeChallenge(ctx, req.Challenge)
	if err != nil {
		writeChallengeErr(w, err)
		return
	}
	binding := bindingOf(req.grantRequest)
	if ch.Ceremony != "authorisation" || ch.Subject != req.Subject ||
		ch.BindingDigest != binding.Digest() || ch.TransferID != req.TransferID {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "challenge_mismatch",
			"message": "This challenge was issued for a different transaction.",
		})
		return
	}

	user, err := s.store.EnsureUser(ctx, req.Subject, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	cred, err := s.passkeys.FinishAuthorisation(user, ch.Session, binding, bytes.NewReader(req.Assertion))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "assertion_failed", "message": err.Error()})
		return
	}
	if err := s.store.UpdateSignCount(ctx, cred); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	now := time.Now()
	grant, err := authgrant.Mint(s.priv, authgrant.Payload{
		ID:        "grant_" + uuid.NewString(),
		Subject:   req.Subject,
		Method:    authgrant.MethodPasskey,
		Binding:   binding.Digest(),
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"grant":        grant,
		"method":       string(authgrant.MethodPasskey),
		"expiresIn":    120,
		"cloneWarning": cred.Authenticator.CloneWarning,
	})
}

func bindingOf(req grantRequest) authgrant.Binding {
	return authgrant.Binding{
		FromExternalRef: req.FromExternalRef,
		ToExternalRef:   req.ToExternalRef,
		AmountMinor:     req.AmountMinor,
		FeeMinor:        req.FeeMinor,
		Currency:        req.Currency,
		TransferID:      req.TransferID,
	}
}

func writeChallengeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrChallengeConsumed):
		writeJSON(w, http.StatusConflict, map[string]string{
			"error":   "challenge_already_used",
			"message": "Challenges are single use.",
		})
	case errors.Is(err, store.ErrChallengeExpired):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "challenge_expired"})
	case errors.Is(err, store.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "challenge_not_found"})
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
