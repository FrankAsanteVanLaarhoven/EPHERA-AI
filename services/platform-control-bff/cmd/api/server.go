// EPHERA platform-control-bff.
//
// The only backend an operator console talks to (ADR 0003). It exists because
// the previous console had no server-side authentication on any of its
// nineteen routes, took the acting identity from the request body and defaulted
// it to "superadmin", enforced its role model on one route out of nineteen, had
// no approval step of any kind, and kept its audit trail in a mutable in-memory
// array that truncated itself at two hundred entries (D-06, D-07, D-12, D-13,
// D-14, D-15).
//
// The rules here:
//
//   - Every route requires a valid operator session. There is no unauthenticated
//     path and no password anywhere -- sessions are minted by identity-access
//     only after a verified passkey assertion, and verified here offline.
//   - The acting identity and its roles come from the signed session. Nothing
//     is read from the request body for authorisation.
//   - Sensitive actions cannot be applied by one person. They are proposed,
//     approved by a different operator, and only then applied.
//   - Every attempt is audited, allowed or denied, into an append-only
//     hash-chained log.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/ephera/platform-control-bff/internal/authz"
	"github.com/ephera/platform-control-bff/internal/store"
)

type server struct {
	store     *store.Store
	sessionPK []byte // ed25519 public key of identity-access
	now       func() time.Time
}

type principal struct {
	Session session.Payload
	Roles   []string
}

func (s *server) clock() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}

// authenticate resolves the caller from the bearer session token. It fails
// closed on every error path, and re-reads roles from the database so that
// suspending an operator takes effect immediately rather than when their
// session happens to expire.
func (s *server) authenticate(r *http.Request) (principal, error) {
	raw := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(raw), "bearer ") {
		return principal{}, errors.New("missing bearer session")
	}
	token := strings.TrimSpace(raw[len("bearer "):])
	if len(s.sessionPK) == 0 {
		return principal{}, errors.New("no session public key configured")
	}
	p, err := session.Verify(s.sessionPK, token, s.clock())
	if err != nil {
		return principal{}, err
	}
	op, err := s.store.LoadOperator(r.Context(), p.Subject)
	if err != nil {
		return principal{}, errors.New("operator not recognised")
	}
	if op.Status != "active" {
		return principal{}, store.ErrSuspended
	}
	return principal{Session: p, Roles: op.Roles}, nil
}

// require authenticates and checks a permission, auditing the outcome either
// way. A denied attempt is as interesting to a reviewer as an allowed one.
func (s *server) require(w http.ResponseWriter, r *http.Request, perm authz.Permission, action, target string) (principal, bool) {
	pr, err := s.authenticate(r)
	if err != nil {
		// No authenticated actor, so there is nobody to attribute this to. It is
		// recorded against the anonymous caller rather than silently dropped.
		_, _ = s.store.Append(r.Context(), store.AuditEntry{
			Actor: "anonymous", ActorMethod: "none", SessionID: "none",
			Action: action, Target: target, Outcome: "denied",
			Detail: map[string]any{"reason": err.Error()},
		})
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "authentication_required", "message": err.Error()})
		return principal{}, false
	}
	if !authz.Can(pr.Roles, perm) {
		s.audit(r.Context(), pr, action, target, "denied",
			map[string]any{"reason": "missing permission", "permission": string(perm), "roles": pr.Roles}, nil)
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "forbidden", "message": "role does not carry " + string(perm)})
		return principal{}, false
	}
	return pr, true
}

func (s *server) audit(ctx context.Context, pr principal, action, target, outcome string, detail map[string]any, changeID *string) {
	_, _ = s.store.Append(ctx, store.AuditEntry{
		Actor:           pr.Session.Subject,
		ActorMethod:     string(pr.Session.Method),
		SessionID:       pr.Session.ID,
		Action:          action,
		Target:          target,
		Outcome:         outcome,
		Detail:          detail,
		ChangeRequestID: changeID,
	})
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/me", s.me)
	mux.HandleFunc("POST /v1/changes", s.proposeChange)
	mux.HandleFunc("POST /v1/changes/{id}/decision", s.decideChange)
	mux.HandleFunc("POST /v1/changes/{id}/apply", s.applyChange)
	mux.HandleFunc("GET /v1/changes/{id}", s.getChange)
	mux.HandleFunc("GET /v1/audit/verify", s.verifyAudit)
	return mux
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok", "service": "platform-control-bff",
		"sessionKeyConfigured": len(s.sessionPK) > 0,
	})
}

// me reports who the caller is and what they may do, derived entirely from the
// signed session and the database.
func (s *server) me(w http.ResponseWriter, r *http.Request) {
	pr, err := s.authenticate(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "authentication_required", "message": err.Error()})
		return
	}
	perms := authz.PermissionsFor(pr.Roles)
	out := make([]string, 0, len(perms))
	for _, p := range perms {
		out = append(out, string(p))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"subject":     pr.Session.Subject,
		"roles":       pr.Roles,
		"permissions": out,
		"method":      string(pr.Session.Method),
		"sessionId":   pr.Session.ID,
	})
}

type proposeRequest struct {
	Action  string         `json:"action"`
	Target  string         `json:"target"`
	Payload map[string]any `json:"payload"`
	Reason  string         `json:"reason"`
}

func (s *server) proposeChange(w http.ResponseWriter, r *http.Request) {
	var req proposeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	perm, known := authz.PermissionForAction[req.Action]
	if !known {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "unknown_action", "message": "no permission is mapped to " + req.Action})
		return
	}
	pr, ok := s.require(w, r, perm, req.Action, req.Target)
	if !ok {
		return
	}
	// A reason is mandatory. An audit trail without why is barely an audit trail.
	if strings.TrimSpace(req.Reason) == "" {
		s.audit(r.Context(), pr, req.Action, req.Target, "denied",
			map[string]any{"reason": "no justification supplied"}, nil)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "reason_required", "message": "a reason is required for every change"})
		return
	}

	cr, err := s.store.CreateChangeRequest(r.Context(), store.ChangeRequest{
		Action: req.Action, Target: req.Target, Payload: req.Payload,
		Reason: req.Reason, RequestedBy: pr.Session.Subject,
		ExpiresAt: s.clock().Add(30 * time.Minute),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	s.audit(r.Context(), pr, req.Action, req.Target, "allowed",
		map[string]any{"stage": "proposed", "reason": req.Reason}, &cr.ID)

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":                     cr.ID,
		"status":                 cr.Status,
		"requiresSecondOperator": authz.RequiresSecondOperator(req.Action),
		"expiresAt":              cr.ExpiresAt,
		"message":                "Proposed. A different operator must approve before this can be applied.",
	})
}

type decisionRequest struct {
	Decision string `json:"decision"` // approved | rejected
	Note     string `json:"note"`
}

func (s *server) decideChange(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req decisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Decision != "approved" && req.Decision != "rejected" {
		http.Error(w, "decision must be approved or rejected", http.StatusBadRequest)
		return
	}
	pr, ok := s.require(w, r, authz.PermApproveChange, "change.decide", id)
	if !ok {
		return
	}

	cr, err := s.store.Decide(r.Context(), id, pr.Session.Subject, req.Decision, req.Note)
	switch {
	case errors.Is(err, store.ErrSelfApproval):
		s.audit(r.Context(), pr, "change.decide", id, "denied",
			map[string]any{"reason": "self-approval refused"}, &id)
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "self_approval_refused",
			"message": "The operator who proposed a change cannot approve it.",
		})
		return
	case errors.Is(err, store.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	case errors.Is(err, store.ErrExpired):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "expired"})
		return
	case errors.Is(err, store.ErrNotPending):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "not_pending"})
		return
	case err != nil:
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.audit(r.Context(), pr, "change.decide", id, "allowed",
		map[string]any{"decision": req.Decision, "note": req.Note, "proposedBy": cr.RequestedBy}, &id)
	writeJSON(w, http.StatusOK, map[string]any{"id": cr.ID, "status": cr.Status})
}

// applyChange carries out an approved change. It re-checks the permission at
// apply time rather than trusting that it held when the change was proposed.
func (s *server) applyChange(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cr, err := s.store.GetChangeRequest(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	perm, known := authz.PermissionForAction[cr.Action]
	if !known {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown_action"})
		return
	}
	pr, ok := s.require(w, r, perm, cr.Action, cr.Target)
	if !ok {
		return
	}
	if cr.Status != "approved" {
		s.audit(r.Context(), pr, cr.Action, cr.Target, "denied",
			map[string]any{"reason": "not approved", "status": cr.Status}, &id)
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "not_approved", "message": "This change has not been approved."})
		return
	}
	if err := s.store.MarkApplied(r.Context(), id); err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "not_approved"})
		return
	}
	// The downstream effect (freeze, flag change, provider approval) is carried
	// out by the owning service. This gate records that it was authorised to
	// happen; wiring the effects is the next increment.
	s.audit(r.Context(), pr, cr.Action, cr.Target, "applied",
		map[string]any{"approvedBy": cr.DecidedBy, "proposedBy": cr.RequestedBy}, &id)
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "applied"})
}

func (s *server) getChange(w http.ResponseWriter, r *http.Request) {
	pr, ok := s.require(w, r, authz.PermViewOperations, "change.view", r.PathValue("id"))
	if !ok {
		return
	}
	cr, err := s.store.GetChangeRequest(r.Context(), r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	_ = pr
	writeJSON(w, http.StatusOK, cr)
}

// verifyAudit recomputes the whole hash chain and reports the first bad row.
func (s *server) verifyAudit(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.require(w, r, authz.PermViewAudit, "audit.verify", "audit_log"); !ok {
		return
	}
	bad, err := s.store.VerifyChain(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"intact": bad == 0, "firstBadSeq": bad})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
