package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
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

func (h *harness) verify(t *testing.T, tier string) {
	t.Helper()
	code, body := h.call(t, "POST", "/v1/customers/"+h.subject+"/tier", map[string]any{
		"tier": tier, "decidedBy": "compliance.officer@ephera.internal",
		"evidenceRef": "doc_fixture_1", "reason": "identity document verified",
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
