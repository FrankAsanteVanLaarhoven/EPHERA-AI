package main

import (
	"encoding/json"
	"net/http"

	"github.com/ephera/platform-control-bff/internal/authz"
)

// Compliance work, as an operator sees it.
//
// Every route authenticates the operator, checks the role, audits the attempt
// (allowed or denied), and only then calls compliance-risk with a credential
// the browser never holds.
//
// The identity of the deciding analyst is taken from their session and passed
// downstream, so compliance-risk can enforce its own rule that nobody decides
// their own case or verifies their own document. The console cannot claim to be
// someone else.

func (s *server) listCases(w http.ResponseWriter, r *http.Request) {
	pr, ok := s.require(w, r, authz.PermViewCases, "cases.list", "compliance")
	if !ok {
		return
	}
	body, code, err := s.compliance.ListCases(r.Context())
	if err != nil {
		s.audit(r.Context(), pr, "cases.list", "compliance", "failed",
			map[string]any{"reason": err.Error()}, nil)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, code, body)
}

type caseDecision struct {
	Status string `json:"status"` // cleared | blocked
	Note   string `json:"note"`
}

func (s *server) decideCase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req caseDecision
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	pr, ok := s.require(w, r, authz.PermDecideCases, "cases.decide", id)
	if !ok {
		return
	}
	// A decision with no note cannot be reviewed later. Clearing a case is a
	// judgement, and a judgement without a reason is not reviewable.
	if req.Note == "" {
		s.audit(r.Context(), pr, "cases.decide", id, "denied",
			map[string]any{"reason": "no note supplied"}, nil)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "note_required",
			"message": "Record why this case was cleared or blocked.",
		})
		return
	}

	body, code, err := s.compliance.CloseCase(r.Context(), id, req.Status, pr.Session.Subject, req.Note)
	if err != nil {
		s.audit(r.Context(), pr, "cases.decide", id, "failed",
			map[string]any{"reason": err.Error()}, nil)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	outcome := "applied"
	if code != http.StatusOK {
		outcome = "failed"
	}
	s.audit(r.Context(), pr, "cases.decide", id, outcome,
		map[string]any{"status": req.Status, "note": req.Note}, nil)
	writeJSON(w, code, body)
}

func (s *server) complianceSubject(w http.ResponseWriter, r *http.Request) {
	subject := r.PathValue("subject")
	pr, ok := s.require(w, r, authz.PermViewCustomers, "compliance.subject.view", subject)
	if !ok {
		return
	}
	_ = pr
	body, code, err := s.compliance.Subject(r.Context(), subject)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, code, body)
}

func (s *server) complianceRequirements(w http.ResponseWriter, r *http.Request) {
	subject := r.PathValue("subject")
	tier := r.URL.Query().Get("tier")
	if _, ok := s.require(w, r, authz.PermViewCustomers, "compliance.requirements.view", subject); !ok {
		return
	}
	body, code, err := s.compliance.Requirements(r.Context(), subject, tier)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, code, body)
}

type documentDecision struct {
	Status string `json:"status"` // verified | rejected
	Note   string `json:"note"`
}

func (s *server) reviewDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req documentDecision
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	pr, ok := s.require(w, r, authz.PermReviewDocuments, "kyc.document.review", id)
	if !ok {
		return
	}
	body, code, err := s.compliance.ReviewDocument(r.Context(), id, req.Status, pr.Session.Subject, req.Note)
	if err != nil {
		s.audit(r.Context(), pr, "kyc.document.review", id, "failed",
			map[string]any{"reason": err.Error()}, nil)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	outcome := "applied"
	if code != http.StatusOK {
		outcome = "failed"
	}
	s.audit(r.Context(), pr, "kyc.document.review", id, outcome,
		map[string]any{"status": req.Status}, nil)
	writeJSON(w, code, body)
}

type tierDecision struct {
	Tier   string `json:"tier"`
	Reason string `json:"reason"`
}

// setTier changes a customer's verification standing. Deciding standing is a
// separate responsibility from investigating a payment, so it needs
// `kyc.decide` — which an analyst does not hold.
func (s *server) setTier(w http.ResponseWriter, r *http.Request) {
	subject := r.PathValue("subject")
	var req tierDecision
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	pr, ok := s.require(w, r, authz.PermDecideTier, "kyc.tier.decide", subject)
	if !ok {
		return
	}
	if req.Reason == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "reason_required", "message": "Record why this tier was decided."})
		return
	}
	body, code, err := s.compliance.SetTier(r.Context(), subject, req.Tier, pr.Session.Subject, req.Reason)
	if err != nil {
		s.audit(r.Context(), pr, "kyc.tier.decide", subject, "failed",
			map[string]any{"reason": err.Error()}, nil)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	outcome := "applied"
	if code != http.StatusOK {
		outcome = "failed"
	}
	s.audit(r.Context(), pr, "kyc.tier.decide", subject, outcome,
		map[string]any{"tier": req.Tier, "reason": req.Reason}, nil)
	writeJSON(w, code, body)
}
