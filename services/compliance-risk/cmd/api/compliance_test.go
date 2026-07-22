package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ephera/compliance-risk/internal/store"
)

// End-to-end compliance behaviour over the real HTTP surface, against a real
// database. Skipped unless COMPLIANCE_TEST_DATABASE_URL is set.

const token = "test-service-token"

type harness struct {
	srv     *httptest.Server
	st      *store.Store
	subject string
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	url := os.Getenv("COMPLIANCE_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("COMPLIANCE_TEST_DATABASE_URL not set; skipping compliance tests")
	}
	st, err := store.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(st.Close)

	s := &server{store: st, serviceToken: token}
	srv := httptest.NewServer(s.routes())
	t.Cleanup(srv.Close)
	// A fresh subject per test so daily totals do not leak between runs.
	return &harness{srv: srv, st: st, subject: fmt.Sprintf("test:%d:GHS", time.Now().UnixNano())}
}

func (h *harness) call(t *testing.T, method, path string, body any, auth bool) (int, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, err := http.NewRequest(method, h.srv.URL+path, &buf)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if auth {
		req.Header.Set("X-Ephera-Service-Token", token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do: %v", err)
	}
	defer res.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func (h *harness) decide(t *testing.T, amount int64, recipient string) map[string]any {
	t.Helper()
	code, body := h.call(t, "POST", "/v1/decisions", map[string]any{
		"subject": h.subject, "amountMinor": amount, "currency": "GHS", "recipientName": recipient,
	}, true)
	if code != http.StatusOK {
		t.Fatalf("decision: %d %v", code, body)
	}
	return body
}

// verify raises the subject to a tier, supplying and verifying whatever evidence
// that tier requires. Since G3-B a tier cannot be raised on evidence nobody has
// verified, so the helper has to produce it.
func (h *harness) verify(t *testing.T, tier string) {
	t.Helper()
	code, req := h.call(t, "GET", "/v1/subjects/"+h.subject+"/requirements?tier="+tier, nil, true)
	if code != http.StatusOK {
		t.Fatalf("requirements: %d %v", code, req)
	}
	for _, kind := range req["missingEvidence"].([]any) {
		h.evidence(t, h.subject, kind.(string))
	}
	code, body := h.call(t, "POST", "/v1/customers/"+h.subject+"/tier", map[string]any{
		"tier": tier, "decidedBy": "compliance.officer@ephera.internal",
		"reason": "evidence verified",
	}, true)
	if code != http.StatusOK {
		t.Fatalf("set tier: %d %v", code, body)
	}
}

func TestUnauthenticatedCallsAreRefused(t *testing.T) {
	h := newHarness(t)
	// Each route with the method it actually serves, so the check reaches the
	// auth layer rather than stopping at "method not allowed".
	for _, tc := range []struct{ method, path string }{
		{"GET", "/v1/customers/" + h.subject},
		{"POST", "/v1/customers/" + h.subject + "/tier"},
		{"POST", "/v1/decisions"},
		{"GET", "/v1/cases"},
	} {
		code, _ := h.call(t, tc.method, tc.path, map[string]any{}, false)
		if code != http.StatusUnauthorized {
			t.Fatalf("%s %s returned %d, expected 401", tc.method, tc.path, code)
		}
	}
}

// D-33. The customer used to hold their own tier in device storage and promote
// themselves. The subject of a verification can never decide it.
func TestCustomerCannotVerifyThemselves(t *testing.T) {
	h := newHarness(t)
	h.call(t, "GET", "/v1/customers/"+h.subject, nil, true)

	code, body := h.call(t, "POST", "/v1/customers/"+h.subject+"/tier", map[string]any{
		"tier": "premium", "decidedBy": h.subject,
		"evidenceRef": "self", "reason": "I say so",
	}, true)
	if code != http.StatusForbidden {
		t.Fatalf("self-verification returned %d %v, expected 403", code, body)
	}

	// And the database refuses it even if the service check is bypassed.
	_, err := h.st.Pool().Exec(context.Background(), `
		INSERT INTO tier_decisions (subject, from_tier, to_tier, decided_by, evidence_ref, reason)
		VALUES ($1,'unverified','premium',$1,'self','I say so')
	`, h.subject)
	if err == nil {
		t.Fatal("the database accepted a self-verification")
	}
}

// A new customer is unverified, and unverified cannot send.
func TestUnverifiedCustomerCannotSend(t *testing.T) {
	h := newHarness(t)
	d := h.decide(t, 1_000, "Ama Mensah")
	if d["outcome"] != "deny" {
		t.Fatalf("unverified customer got %v %v", d["outcome"], d["reasons"])
	}
	if d["tier"] != "unverified" {
		t.Fatalf("tier is %v", d["tier"])
	}
}

// D-39. Limits are now enforced by the service, not displayed on a device.
func TestLimitsAreEnforcedAcrossPayments(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "verified") // single 200000, daily 500000, new recipient 50000

	// Establish the recipient with a payment inside the new-recipient ceiling.
	if d := h.decide(t, 40_000, "Ama Mensah"); d["outcome"] != "allow" {
		t.Fatalf("first payment: %v %v", d["outcome"], d["reasons"])
	}
	// Now a larger one to the same, now-known, recipient is fine.
	if d := h.decide(t, 150_000, "Ama Mensah"); d["outcome"] != "allow" {
		t.Fatalf("second payment: %v %v", d["outcome"], d["reasons"])
	}
	// 190000 spent. A payment over the single limit is refused.
	if d := h.decide(t, 250_000, "Ama Mensah"); d["outcome"] != "deny" {
		t.Fatalf("over single limit: %v %v", d["outcome"], d["reasons"])
	}
	// And the daily total is cumulative: 190000 + 200000 > 500000 is fine,
	// but a further 200000 after that is not.
	if d := h.decide(t, 200_000, "Ama Mensah"); d["outcome"] != "allow" {
		t.Fatalf("third payment: %v %v", d["outcome"], d["reasons"])
	}
	d := h.decide(t, 200_000, "Ama Mensah") // 390000 + 200000 > 500000
	if d["outcome"] != "deny" {
		t.Fatalf("over daily limit: %v %v", d["outcome"], d["reasons"])
	}
}

// A refused attempt must not consume the customer's daily limit.
func TestRefusedAttemptsDoNotConsumeTheLimit(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "verified")

	h.decide(t, 250_000, "Ama Mensah") // denied: over single limit
	h.decide(t, 250_000, "Ama Mensah") // denied again
	d := h.decide(t, 40_000, "Ama Mensah")
	if d["outcome"] != "allow" {
		t.Fatalf("a refused attempt consumed the limit: %v %v", d["outcome"], d["reasons"])
	}
	if d["remainingDailyMinor"].(float64) != 460_000 {
		t.Fatalf("remaining is %v", d["remainingDailyMinor"])
	}
}

func TestSanctionsMatchIsDenied(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "verified")
	d := h.decide(t, 1_000, "Fictional Sanctioned Person")
	if d["outcome"] != "deny" {
		t.Fatalf("sanctions match: %v %v", d["outcome"], d["reasons"])
	}
}

// A held payment raises a case, so a human has something to work from rather
// than the customer simply being stuck.
func TestHeldPaymentRaisesACase(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "verified")

	d := h.decide(t, 1_000, "Fictional Public Official") // pep -> review
	if d["outcome"] != "review" {
		t.Fatalf("pep match: %v %v", d["outcome"], d["reasons"])
	}

	code, body := h.call(t, "GET", "/v1/cases", nil, true)
	if code != http.StatusOK {
		t.Fatalf("cases: %d %v", code, body)
	}
	items := body["items"].([]any)
	found := false
	for _, it := range items {
		if it.(map[string]any)["subject"] == h.subject {
			found = true
		}
	}
	if !found {
		t.Fatal("a held payment did not raise a case")
	}
}

// An analyst cannot clear a case about themselves.
func TestAnalystCannotClearTheirOwnCase(t *testing.T) {
	h := newHarness(t)
	c, err := h.st.OpenCase(context.Background(), h.subject, "fixture")
	if err != nil {
		t.Fatalf("open case: %v", err)
	}
	code, _ := h.call(t, "POST", "/v1/cases/"+c.ID+"/close", map[string]any{
		"status": "cleared", "closedBy": h.subject, "note": "clearing myself",
	}, true)
	if code == http.StatusOK {
		t.Fatal("an analyst cleared a case about themselves")
	}
}

// A tier decision without evidence is refused: a tier that cannot be explained
// later is a guess, not a verification.
func TestTierDecisionRequiresEvidenceAndReason(t *testing.T) {
	h := newHarness(t)
	h.call(t, "GET", "/v1/customers/"+h.subject, nil, true)
	code, _ := h.call(t, "POST", "/v1/customers/"+h.subject+"/tier", map[string]any{
		"tier": "verified", "decidedBy": "compliance.officer@ephera.internal",
	}, true)
	if code == http.StatusOK {
		t.Fatal("a tier was set with no evidence reference or reason")
	}
}

// --- KYB, KYA and evidence ---

func (h *harness) subjectOfType(t *testing.T, kind string) string {
	t.Helper()
	subject := fmt.Sprintf("test:%s:%d", kind, time.Now().UnixNano())
	code, body := h.call(t, "POST", "/v1/subjects", map[string]any{
		"subject": subject, "subjectType": kind, "legalName": "Fixture " + kind,
	}, true)
	if code != http.StatusOK {
		t.Fatalf("create %s: %d %v", kind, code, body)
	}
	return subject
}

// evidence submits a document and has a reviewer verify it.
func (h *harness) evidence(t *testing.T, subject, kind string) string {
	t.Helper()
	code, doc := h.call(t, "POST", "/v1/subjects/"+subject+"/documents", map[string]any{
		"kind": kind, "contentHash": fmt.Sprintf("sha256:%s:%d", kind, time.Now().UnixNano()),
	}, true)
	if code != http.StatusCreated {
		t.Fatalf("submit %s: %d %v", kind, code, doc)
	}
	id := doc["id"].(string)
	code, out := h.call(t, "POST", "/v1/documents/"+id+"/review", map[string]any{
		"status": "verified", "reviewedBy": "compliance.officer@ephera.internal", "note": "checked",
	}, true)
	if code != http.StatusOK {
		t.Fatalf("review %s: %d %v", kind, code, out)
	}
	return id
}

// A tier cannot be raised on evidence nobody has verified. The previous version
// accepted any string as an evidence reference.
func TestTierRequiresVerifiedEvidence(t *testing.T) {
	h := newHarness(t)
	subject := h.subjectOfType(t, "person")

	code, body := h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "verified", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "no evidence at all",
	}, true)
	if code != http.StatusConflict {
		t.Fatalf("tier without evidence returned %d %v, expected 409", code, body)
	}

	h.evidence(t, subject, "government_id")
	code, body = h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "verified", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "identity document verified",
	}, true)
	if code != http.StatusOK {
		t.Fatalf("tier with evidence: %d %v", code, body)
	}
	if body["tier"] != "verified" {
		t.Fatalf("tier is %v", body["tier"])
	}
}

// A document cannot be verified by the subject it describes.
func TestSubjectCannotVerifyTheirOwnDocument(t *testing.T) {
	h := newHarness(t)
	subject := h.subjectOfType(t, "person")

	code, doc := h.call(t, "POST", "/v1/subjects/"+subject+"/documents", map[string]any{
		"kind": "government_id", "contentHash": "sha256:self",
	}, true)
	if code != http.StatusCreated {
		t.Fatalf("submit: %d %v", code, doc)
	}
	code, body := h.call(t, "POST", "/v1/documents/"+doc["id"].(string)+"/review", map[string]any{
		"status": "verified", "reviewedBy": subject,
	}, true)
	if code != http.StatusForbidden {
		t.Fatalf("self-review returned %d %v, expected 403", code, body)
	}
}

// A document with no content hash is not evidence.
func TestDocumentRequiresAContentHash(t *testing.T) {
	h := newHarness(t)
	subject := h.subjectOfType(t, "person")
	code, _ := h.call(t, "POST", "/v1/subjects/"+subject+"/documents", map[string]any{
		"kind": "government_id",
	}, true)
	if code == http.StatusCreated {
		t.Fatal("a document was accepted with no content hash")
	}
}

// KYB: a business needs registration and the people behind it, and its verified
// tier is not the same thing as a person's.
func TestBusinessVerificationRequiresOwnershipEvidence(t *testing.T) {
	h := newHarness(t)
	subject := h.subjectOfType(t, "business")

	h.evidence(t, subject, "certificate_of_incorporation")
	// Registered is reachable on incorporation alone.
	code, body := h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "registered", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "registration verified",
	}, true)
	if code != http.StatusOK {
		t.Fatalf("registered: %d %v", code, body)
	}

	// Verified additionally needs beneficial ownership and a director identity.
	code, body = h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "verified", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "premature",
	}, true)
	if code != http.StatusConflict {
		t.Fatalf("business verified without ownership evidence returned %d %v", code, body)
	}

	code, out := h.call(t, "GET", "/v1/subjects/"+subject+"/requirements?tier=verified", nil, true)
	if code != http.StatusOK {
		t.Fatalf("requirements: %d %v", code, out)
	}
	missing := out["missingEvidence"].([]any)
	if len(missing) != 2 {
		t.Fatalf("expected two outstanding documents, got %v", missing)
	}

	h.evidence(t, subject, "beneficial_ownership")
	h.evidence(t, subject, "director_identity")
	code, body = h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "verified", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "ownership and directors verified",
	}, true)
	if code != http.StatusOK {
		t.Fatalf("business verified: %d %v", code, body)
	}
	if body["subjectType"] != "business" {
		t.Fatalf("subject type is %v", body["subjectType"])
	}
}

// KYA: an agent needs identity, a bound device, and a float agreement.
func TestAgentVerificationRequiresDeviceAndFloatAgreement(t *testing.T) {
	h := newHarness(t)
	subject := h.subjectOfType(t, "agent")

	h.evidence(t, subject, "government_id")
	code, out := h.call(t, "GET", "/v1/subjects/"+subject+"/requirements?tier=provisional", nil, true)
	if code != http.StatusOK {
		t.Fatalf("requirements: %d %v", code, out)
	}
	if out["eligible"] != false {
		t.Fatalf("agent eligible without a device attestation: %v", out)
	}

	h.evidence(t, subject, "device_attestation")
	code, body := h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "provisional", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "identity and device verified",
	}, true)
	if code != http.StatusOK {
		t.Fatalf("agent provisional: %d %v", code, body)
	}

	// Full verification additionally needs the float agreement.
	code, _ = h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "verified", "decidedBy": "compliance.officer@ephera.internal",
		"reason": "premature",
	}, true)
	if code != http.StatusConflict {
		t.Fatalf("agent verified without a float agreement returned %d", code)
	}
}

// A tier belongs to a subject type: a business cannot be given a person's tier.
func TestTiersDoNotCrossSubjectTypes(t *testing.T) {
	h := newHarness(t)
	subject := h.subjectOfType(t, "business")
	h.evidence(t, subject, "certificate_of_incorporation")

	code, _ := h.call(t, "POST", "/v1/customers/"+subject+"/tier", map[string]any{
		"tier": "premium", // a person tier
		"decidedBy": "compliance.officer@ephera.internal", "reason": "wrong type",
	}, true)
	if code == http.StatusOK {
		t.Fatal("a business was given a person's tier")
	}
}

// --- behavioural monitoring ---

// A sequence of payments just under the reporting threshold is held for review,
// even though each one is individually within the customer's limits.
func TestStructuringSequenceIsHeldForReview(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "premium") // single limit 1,000,000; threshold is 1,000,000

	// Establish each recipient with a small payment first. A large payment to
	// someone never paid before is held on its own terms, so without this the
	// sequence never reaches "allowed" and there is no history to see a pattern
	// in — which is itself the new-recipient rule working.
	for _, r := range []string{"Recipient One", "Recipient Two", "Recipient Three"} {
		if d := h.decide(t, 1_000, r); d["outcome"] != "allow" {
			t.Fatalf("establishing %s: %v %v", r, d["outcome"], d["reasons"])
		}
	}

	// Now three payments in the band just below the reporting threshold. Each
	// is allowed on its own terms.
	first := h.decide(t, 900_000, "Recipient One")
	if first["outcome"] != "allow" {
		t.Fatalf("first payment: %v %v", first["outcome"], first["reasons"])
	}
	second := h.decide(t, 920_000, "Recipient Two")
	if second["outcome"] != "allow" {
		t.Fatalf("second payment: %v %v", second["outcome"], second["reasons"])
	}

	third := h.decide(t, 950_000, "Recipient Three")
	if third["outcome"] != "review" {
		t.Fatalf("third payment was not held: %v %v", third["outcome"], third["reasons"])
	}
	if !anyReasonHasPrefix(third, "possible_structuring") {
		t.Fatalf("no structuring reason: %v", third["reasons"])
	}
}

// The reason must carry the observation, so an analyst can check it and a
// customer can answer it.
func TestMonitoringReasonsCarryTheObservation(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "premium")
	for _, r := range []string{"One", "Two", "Three"} {
		h.decide(t, 1_000, r)
	}
	h.decide(t, 900_000, "One")
	h.decide(t, 920_000, "Two")
	d := h.decide(t, 950_000, "Three")

	for _, r := range d["reasons"].([]any) {
		s := r.(string)
		if len(s) > len("possible_structuring:") && s[:len("possible_structuring:")] == "possible_structuring:" {
			if !strings.Contains(s, "payments between") {
				t.Fatalf("observation missing from reason: %q", s)
			}
			return
		}
	}
	t.Fatalf("no structuring reason found: %v", d["reasons"])
}

// Ordinary spending well below the threshold is not held.
func TestOrdinarySpendingIsNotHeld(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "verified")
	for i := 0; i < 3; i++ {
		d := h.decide(t, 5_000, "Ama Mensah")
		if d["outcome"] != "allow" {
			t.Fatalf("ordinary payment %d held: %v %v", i, d["outcome"], d["reasons"])
		}
	}
}

// A held payment raises a case carrying the pattern, so a human has the
// observation rather than just a label.
func TestStructuringRaisesACaseWithTheObservation(t *testing.T) {
	h := newHarness(t)
	h.verify(t, "premium")
	for _, r := range []string{"One", "Two", "Three"} {
		h.decide(t, 1_000, r)
	}
	h.decide(t, 900_000, "One")
	h.decide(t, 920_000, "Two")
	h.decide(t, 950_000, "Three")

	code, body := h.call(t, "GET", "/v1/cases", nil, true)
	if code != http.StatusOK {
		t.Fatalf("cases: %d %v", code, body)
	}
	for _, it := range body["items"].([]any) {
		c := it.(map[string]any)
		if c["subject"] == h.subject && strings.Contains(c["reason"].(string), "possible_structuring") {
			if !strings.Contains(c["reason"].(string), "payments between") {
				t.Fatalf("case reason lacks the observation: %v", c["reason"])
			}
			return
		}
	}
	t.Fatal("no case raised carrying the structuring observation")
}

func anyReasonHasPrefix(d map[string]any, prefix string) bool {
	for _, r := range d["reasons"].([]any) {
		if s, ok := r.(string); ok && strings.HasPrefix(s, prefix) {
			return true
		}
	}
	return false
}
