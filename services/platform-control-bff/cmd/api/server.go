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
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/ephera/platform-control-bff/internal/authz"
	"github.com/ephera/platform-control-bff/internal/compliance"
	"github.com/ephera/platform-control-bff/internal/effect"
	"github.com/ephera/platform-control-bff/internal/store"
)

type server struct {
	store          *store.Store
	applier        effect.Applier
	compliance     complianceClient
	sessionPK      []byte // ed25519 public key of identity-access
	allowedOrigins []string
	serviceToken   string
	now            func() time.Time
}

// complianceClient is an interface so tests can drive the console surface
// without a compliance service running.
type complianceClient interface {
	ListCases(ctx context.Context) (map[string]any, int, error)
	CloseCase(ctx context.Context, id, status, closedBy, note string) (map[string]any, int, error)
	Subject(ctx context.Context, subject string) (map[string]any, int, error)
	Requirements(ctx context.Context, subject, tier string) (map[string]any, int, error)
	ReviewDocument(ctx context.Context, id, status, reviewedBy, note string) (map[string]any, int, error)
	SetTier(ctx context.Context, subject, tier, decidedBy, reason string) (map[string]any, int, error)
}

var _ complianceClient = (*compliance.Client)(nil)

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

// withCORS allows exactly the configured console origins. It is an allowlist
// rather than "*" deliberately: these endpoints carry an operator session in an
// Authorization header, and a wildcard origin on a credentialed control plane
// is how a console page on any site gets to act as an operator.
func withCORS(next http.Handler, allowed []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, a := range allowed {
			if origin != "" && origin == a {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				break
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
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
	mux.HandleFunc("GET /v1/changes", s.listChanges)
	mux.HandleFunc("GET /v1/audit", s.listAudit)

	// Flags, read by platform services rather than operators.
	mux.HandleFunc("GET /v1/flags", s.serviceFlags)

	// Compliance work.
	mux.HandleFunc("GET /v1/compliance/cases", s.listCases)
	mux.HandleFunc("POST /v1/compliance/cases/{id}/decision", s.decideCase)
	mux.HandleFunc("GET /v1/compliance/subjects/{subject}", s.complianceSubject)
	mux.HandleFunc("GET /v1/compliance/subjects/{subject}/requirements", s.complianceRequirements)
	mux.HandleFunc("POST /v1/compliance/subjects/{subject}/tier", s.setTier)
	mux.HandleFunc("POST /v1/compliance/documents/{id}/review", s.reviewDocument)
	return withCORS(mux, s.allowedOrigins)
}

// serviceFlags is read by platform services, not by a console, so it
// authenticates with a service token rather than an operator session.
//
// It is deliberately readable without an operator: the payment orchestrator has
// to know whether sends are stopped even when no human is logged in, which is
// precisely the situation a kill switch exists for.
func (s *server) serviceFlags(w http.ResponseWriter, r *http.Request) {
	presented := strings.TrimSpace(r.Header.Get("X-Ephera-Service-Token"))
	if s.serviceToken == "" || presented == "" ||
		subtle.ConstantTimeCompare([]byte(presented), []byte(s.serviceToken)) != 1 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "caller_not_authenticated"})
		return
	}
	flags, err := s.store.Flags(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := map[string]bool{}
	for _, f := range flags {
		out[f.Key] = f.Enabled
	}
	writeJSON(w, http.StatusOK, map[string]any{"flags": out})
}

// listChanges returns the change queue an approver works from.
func (s *server) listChanges(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.require(w, r, authz.PermViewOperations, "change.list", "change_requests"); !ok {
		return
	}
	items, err := s.store.ListChangeRequests(r.Context(), 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *server) listAudit(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.require(w, r, authz.PermViewAudit, "audit.list", "audit_log"); !ok {
		return
	}
	items, err := s.store.ListAudit(r.Context(), 100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
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
	// Carry out the change against the service that owns it, BEFORE recording it
	// as applied. If the owning service refuses or is unreachable, the request
	// stays approved-but-unapplied and the failure is audited: the control plane
	// must never claim an effect it did not achieve (D-17).
	token := strings.TrimSpace(r.Header.Get("Authorization"))
	token = strings.TrimSpace(token[len("Bearer "):])
	if err := s.applier.Apply(r.Context(), effect.Request{
		Action:          cr.Action,
		Target:          cr.Target,
		ChangeRequestID: id,
		Reason:          cr.Reason,
		Payload:         cr.Payload,
		OperatorSession: token,
	}); err != nil {
		s.audit(r.Context(), pr, cr.Action, cr.Target, "failed",
			map[string]any{"reason": err.Error(), "approvedBy": cr.DecidedBy}, &id)
		status := http.StatusBadGateway
		if errors.Is(err, effect.ErrNoOwningService) {
			status = http.StatusNotImplemented
		}
		writeJSON(w, status, map[string]string{
			"error":   "effect_failed",
			"message": err.Error(),
		})
		return
	}

	if err := s.store.MarkApplied(r.Context(), id); err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "not_approved"})
		return
	}
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
