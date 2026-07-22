// EPHERA compliance-risk.
//
// Owns customer verification state, the limits that follow from it, screening,
// and the cases that come out of both.
//
// It exists because a customer's KYC tier lived in device storage and the
// customer could promote themselves to "verified" (D-33), and because the
// daily and new-recipient limits existed only as numbers on the device that the
// send path never consulted (D-39).
//
// Two rules shape the surface:
//
//   - A tier is a statement about verified evidence, so the subject of a
//     verification can never be the party that decided it.
//   - Every decision carries its reasons. A refusal has to be explainable to
//     the customer refused and to an examiner asking why.
package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ephera/compliance-risk/internal/monitoring"
	"github.com/ephera/compliance-risk/internal/risk"
	"github.com/ephera/compliance-risk/internal/store"
)

type server struct {
	store        *store.Store
	serviceToken string
}

func main() {
	addr := env("COMPLIANCE_HTTP_ADDR", ":8095")

	ctx := context.Background()
	st, err := store.New(ctx, env("COMPLIANCE_DATABASE_URL",
		"postgres://ephera:ephera_dev_only@localhost:5433/ephera_compliance?sslmode=disable"))
	if err != nil {
		log.Fatalf("compliance db: %v", err)
	}
	defer st.Close()

	token := os.Getenv("COMPLIANCE_SERVICE_TOKEN")
	if token == "" {
		log.Printf("WARNING: COMPLIANCE_SERVICE_TOKEN is not set. " +
			"Calls will be refused until a caller credential is configured.")
	}

	s := &server{store: st, serviceToken: token}
	log.Printf("EPHERA compliance-risk on %s", addr)
	if err := http.ListenAndServe(addr, s.routes()); err != nil {
		log.Fatal(err)
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/customers/{subject}", s.serviceOnly(s.getCustomer))
	mux.HandleFunc("POST /v1/customers/{subject}/tier", s.serviceOnly(s.setTier))
	mux.HandleFunc("POST /v1/decisions", s.serviceOnly(s.decide))
	mux.HandleFunc("GET /v1/cases", s.serviceOnly(s.listCases))
	mux.HandleFunc("POST /v1/cases/{id}/close", s.serviceOnly(s.closeCase))
	mux.HandleFunc("POST /v1/subjects", s.serviceOnly(s.createSubject))
	mux.HandleFunc("POST /v1/subjects/{subject}/documents", s.serviceOnly(s.submitDocument))
	mux.HandleFunc("POST /v1/documents/{id}/review", s.serviceOnly(s.reviewDocument))
	mux.HandleFunc("GET /v1/subjects/{subject}/requirements", s.serviceOnly(s.requirements))
	return mux
}

// serviceOnly authenticates the caller. Compliance state is among the most
// sensitive data here, so there is no unauthenticated route but health, and no
// token configured means everything is refused.
func (s *server) serviceOnly(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		presented := strings.TrimSpace(r.Header.Get("X-Ephera-Service-Token"))
		if s.serviceToken == "" || presented == "" ||
			subtle.ConstantTimeCompare([]byte(presented), []byte(s.serviceToken)) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "caller_not_authenticated",
			})
			return
		}
		h(w, r)
	}
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok", "service": "compliance-risk",
		"screeningList": "SANDBOX-FIXTURE (not a licensed list)",
	})
}

func (s *server) getCustomer(w http.ResponseWriter, r *http.Request) {
	c, err := s.store.EnsureCustomer(r.Context(), r.PathValue("subject"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

type tierRequest struct {
	Tier        string `json:"tier"`
	DecidedBy   string `json:"decidedBy"`
	EvidenceRef string `json:"evidenceRef"`
	Reason      string `json:"reason"`
}

func (s *server) setTier(w http.ResponseWriter, r *http.Request) {
	subject := r.PathValue("subject")
	var req tierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := s.store.EnsureCustomer(r.Context(), subject); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	c, err := s.store.SetTierWithEvidence(r.Context(), subject, req.Tier, req.DecidedBy, req.Reason)
	switch {
	case errors.Is(err, store.ErrEvidenceMissing):
		writeJSON(w, http.StatusConflict, map[string]string{
			"error":   "evidence_missing",
			"message": err.Error(),
		})
		return
	case err == store.ErrSelfVerification:
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "self_verification_refused",
			"message": "A customer cannot decide their own verification tier.",
		})
		return
	case err == store.ErrUnknownTier:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown_tier"})
		return
	case err != nil:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, c)
}

type decisionRequest struct {
	Subject       string `json:"subject"`
	AmountMinor   int64  `json:"amountMinor"`
	Currency      string `json:"currency"`
	RecipientName string `json:"recipientName"`
}

// decide is what the payment orchestrator calls before a transfer is prepared.
func (s *server) decide(w http.ResponseWriter, r *http.Request) {
	var req decisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Subject == "" || req.RecipientName == "" || req.Currency == "" {
		http.Error(w, "subject, recipientName and currency are required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	customer, err := s.store.EnsureCustomer(ctx, req.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	hits, err := s.store.Screen(ctx, req.RecipientName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Behavioural monitoring looks at the sequence, not this payment alone. It
	// holds for review rather than denying: a pattern is suggestive, not
	// conclusive, and denying on one punishes the innocent explanation. This
	// read is not part of the limit invariant, so it runs before the lock.
	thresholds := monitoring.DefaultThresholds()
	history, err := s.store.RecentPayments(ctx, req.Subject, longestWindow(thresholds))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// The limit read (spent-today, known-recipient), the decision, and the
	// record of it happen together under a per-subject lock, so concurrent
	// payments for the same subject cannot all read the same spent-today and
	// each pass a limit the sum of them breaks. Everything that determines the
	// recorded outcome — including the behavioural upgrade — is computed inside,
	// so the row that is written is the final one.
	var in risk.Input
	decision, err := s.store.DecideUnderSubjectLock(ctx, req.Subject, req.RecipientName,
		func(spent int64, known bool) (risk.Input, risk.Decision) {
			in = risk.Input{
				Subject:         req.Subject,
				CustomerStatus:  customer.Status,
				Tier:            customer.Limits,
				AmountMinor:     req.AmountMinor,
				Currency:        req.Currency,
				RecipientName:   req.RecipientName,
				SpentTodayMinor: spent,
				KnownRecipient:  known,
				ScreeningHits:   hits,
			}
			d := risk.Evaluate(in)
			alerts := monitoring.Evaluate(time.Now(), monitoring.Payment{
				AmountMinor: req.AmountMinor,
				Recipient:   risk.NormaliseName(req.RecipientName),
				At:          time.Now(),
			}, history, thresholds)
			if len(alerts) > 0 && d.Outcome == risk.Allow {
				d.Outcome = risk.Review
			}
			for _, a := range alerts {
				d.Reasons = append(d.Reasons, a.Rule+":"+a.Observation)
			}
			return in, d
		})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// A held payment raises a case, so a human has something to work from
	// rather than the customer simply being stuck.
	if decision.Outcome == risk.Review {
		if _, err := s.store.OpenCase(ctx, req.Subject, strings.Join(decision.Reasons, "; ")); err != nil {
			log.Printf("could not open review case for %s: %v", req.Subject, err)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"outcome":             string(decision.Outcome),
		"reasons":             decision.Reasons,
		"tier":                customer.Tier,
		"remainingDailyMinor": decision.RemainingDailyMinor,
	})
}

func (s *server) listCases(w http.ResponseWriter, r *http.Request) {
	cases, err := s.store.ListOpenCases(r.Context(), 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": cases})
}

type closeRequest struct {
	Status   string `json:"status"`
	ClosedBy string `json:"closedBy"`
	Note     string `json:"note"`
}

func (s *server) closeCase(w http.ResponseWriter, r *http.Request) {
	var req closeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.ClosedBy == "" {
		http.Error(w, "closedBy is required", http.StatusBadRequest)
		return
	}
	if err := s.store.CloseCase(r.Context(), r.PathValue("id"), req.Status, req.ClosedBy, req.Note); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

type subjectRequest struct {
	Subject     string `json:"subject"`
	SubjectType string `json:"subjectType"` // person | business | agent
	LegalName   string `json:"legalName"`
}

// createSubject registers a person, business or agent. All three share the
// verification machinery: someone other than the subject decides, on evidence.
func (s *server) createSubject(w http.ResponseWriter, r *http.Request) {
	var req subjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Subject == "" {
		http.Error(w, "subject is required", http.StatusBadRequest)
		return
	}
	c, err := s.store.EnsureSubject(r.Context(), req.Subject, req.SubjectType, req.LegalName)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, c)
}

type documentRequest struct {
	Kind        string `json:"kind"`
	ContentHash string `json:"contentHash"`
}

func (s *server) submitDocument(w http.ResponseWriter, r *http.Request) {
	var req documentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	subject := r.PathValue("subject")
	if _, err := s.store.EnsureSubject(r.Context(), subject, "", ""); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	d, err := s.store.SubmitDocument(r.Context(), subject, req.Kind, req.ContentHash)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

type reviewRequest struct {
	Status     string `json:"status"` // verified | rejected
	ReviewedBy string `json:"reviewedBy"`
	Note       string `json:"note"`
}

func (s *server) reviewDocument(w http.ResponseWriter, r *http.Request) {
	var req reviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.ReviewedBy == "" {
		http.Error(w, "reviewedBy is required", http.StatusBadRequest)
		return
	}
	d, err := s.store.ReviewDocument(r.Context(), r.PathValue("id"), req.Status, req.ReviewedBy, req.Note)
	switch {
	case err == store.ErrSelfReview:
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "self_review_refused",
			"message": "A document cannot be verified by the subject it describes.",
		})
		return
	case err == store.ErrDocumentNotFound:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	case err != nil:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// requirements says what evidence is still outstanding for a target tier, so a
// subject can be told what is needed rather than simply refused.
func (s *server) requirements(w http.ResponseWriter, r *http.Request) {
	subject := r.PathValue("subject")
	target := r.URL.Query().Get("tier")
	if target == "" {
		http.Error(w, "tier is required", http.StatusBadRequest)
		return
	}
	c, err := s.store.EnsureSubject(r.Context(), subject, "", "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	missing, err := s.store.MissingEvidence(r.Context(), subject, c.SubjectType, target)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"subject": subject, "subjectType": c.SubjectType,
		"targetTier": target, "missingEvidence": missing, "eligible": len(missing) == 0,
	})
}

// longestWindow is how much history the monitoring rules need. Fetching the
// longest window once is cheaper than one query per rule, and keeps the rules
// pure functions over a slice.
func longestWindow(t monitoring.Thresholds) time.Duration {
	longest := t.StructuringWindow
	if t.VelocityWindow > longest {
		longest = t.VelocityWindow
	}
	if t.DispersalWindow > longest {
		longest = t.DispersalWindow
	}
	return longest
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
