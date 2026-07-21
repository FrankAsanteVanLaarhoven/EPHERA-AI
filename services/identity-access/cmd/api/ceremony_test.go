package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ephera/authgrant"
	"github.com/ephera/identity-access/internal/passkey"
	"github.com/ephera/identity-access/internal/store"
	"github.com/ephera/identity-access/internal/webauthntest"
	"github.com/google/uuid"
)

// End-to-end ceremonies over the real HTTP surface, against a real database.
//
// These cover what the package-level tests cannot: the wire formats, challenge
// persistence and single use, the sandbox authenticator's guard rails, and that
// a grant minted from a verified assertion actually verifies as a passkey
// grant.
//
// Skipped unless IDENTITY_TEST_DATABASE_URL is set.

const (
	rpID   = "ephera.test"
	origin = "https://ephera.test"
)

type harness struct {
	srv     *httptest.Server
	pub     ed25519.PublicKey
	store   *store.Store
	subject string
}

func newHarness(t *testing.T, sandboxMint bool) *harness {
	t.Helper()
	url := os.Getenv("IDENTITY_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("IDENTITY_TEST_DATABASE_URL not set; skipping identity ceremony tests")
	}
	st, err := store.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(st.Close)

	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	pk, err := passkey.New(rpID, "EPHERA", []string{origin})
	if err != nil {
		t.Fatalf("passkey service: %v", err)
	}
	s := &server{priv: priv, pub: pub, sandboxMint: sandboxMint, store: st, passkeys: pk}
	srv := httptest.NewServer(s.routes())
	t.Cleanup(srv.Close)

	// A fresh subject per test so runs do not interfere.
	return &harness{srv: srv, pub: pub, store: st, subject: "test:" + uuid.NewString() + ":GHS"}
}

func (h *harness) post(t *testing.T, path string, body any) (int, map[string]any) {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	res, err := http.Post(h.srv.URL+path, "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("post %s: %v", path, err)
	}
	defer res.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func (h *harness) binding(transferID string) authgrant.Binding {
	return authgrant.Binding{
		FromExternalRef: h.subject,
		ToExternalRef:   "user:ama:GHS",
		AmountMinor:     25_000,
		FeeMinor:        50,
		Currency:        "GHS",
		TransferID:      transferID,
	}
}

func (h *harness) grantBody(b authgrant.Binding) map[string]any {
	return map[string]any{
		"subject":         h.subject,
		"fromExternalRef": b.FromExternalRef,
		"toExternalRef":   b.ToExternalRef,
		"amountMinor":     b.AmountMinor,
		"feeMinor":        b.FeeMinor,
		"currency":        b.Currency,
		"transferId":      b.TransferID,
	}
}

// registerPasskey runs the registration ceremony over HTTP.
func (h *harness) registerPasskey(t *testing.T) *webauthntest.Authenticator {
	t.Helper()
	auth, err := webauthntest.New(rpID, origin)
	if err != nil {
		t.Fatalf("authenticator: %v", err)
	}

	code, opts := h.post(t, "/v1/passkeys/register/begin",
		map[string]any{"subject": h.subject, "displayName": "Test"})
	if code != http.StatusOK {
		t.Fatalf("register/begin: %d %v", code, opts)
	}
	pk := opts["publicKey"].(map[string]any)
	challenge := pk["challenge"].(string)

	var resp map[string]any
	if err := json.Unmarshal(auth.RegistrationResponse(challenge), &resp); err != nil {
		t.Fatalf("registration response: %v", err)
	}
	code, out := h.post(t, "/v1/passkeys/register/finish", map[string]any{
		"subject": h.subject, "challenge": challenge, "response": resp,
	})
	if code != http.StatusOK {
		t.Fatalf("register/finish: %d %v", code, out)
	}
	return auth
}

// authorise runs the authorisation ceremony and returns the HTTP status plus body.
func (h *harness) authorise(t *testing.T, auth *webauthntest.Authenticator, b authgrant.Binding) (int, map[string]any) {
	t.Helper()
	code, ch := h.post(t, "/v1/grants/challenge", h.grantBody(b))
	if code != http.StatusOK {
		t.Fatalf("grants/challenge: %d %v", code, ch)
	}
	challenge := ch["challenge"].(string)

	assertionBytes, err := auth.AssertionResponse(challenge, nil)
	if err != nil {
		t.Fatalf("assertion: %v", err)
	}
	var assertion map[string]any
	if err := json.Unmarshal(assertionBytes, &assertion); err != nil {
		t.Fatalf("assertion json: %v", err)
	}

	body := h.grantBody(b)
	body["challenge"] = challenge
	body["assertion"] = assertion
	return h.post(t, "/v1/grants/passkey", body)
}

func TestPasskeyCeremonyMintsAVerifiableGrant(t *testing.T) {
	h := newHarness(t, false)
	auth := h.registerPasskey(t)

	b := h.binding("tx_" + uuid.NewString())
	code, out := h.authorise(t, auth, b)
	if code != http.StatusOK {
		t.Fatalf("grants/passkey: %d %v", code, out)
	}
	if out["method"] != string(authgrant.MethodPasskey) {
		t.Fatalf("method is %v, expected passkey", out["method"])
	}

	// The grant must verify against the service's key and be bound to this
	// exact transfer -- which is what the ledger will check.
	payload, err := authgrant.Verify(h.pub, out["grant"].(string), b, time.Now())
	if err != nil {
		t.Fatalf("minted grant does not verify: %v", err)
	}
	if payload.Method != authgrant.MethodPasskey {
		t.Fatalf("grant claims method %q", payload.Method)
	}
	if payload.Subject != h.subject {
		t.Fatalf("grant subject %q", payload.Subject)
	}
}

// A challenge is single use, so a captured assertion cannot be replayed.
func TestChallengeIsSingleUse(t *testing.T) {
	h := newHarness(t, false)
	auth := h.registerPasskey(t)
	b := h.binding("tx_" + uuid.NewString())

	code, ch := h.post(t, "/v1/grants/challenge", h.grantBody(b))
	if code != http.StatusOK {
		t.Fatalf("challenge: %d %v", code, ch)
	}
	challenge := ch["challenge"].(string)
	assertionBytes, err := auth.AssertionResponse(challenge, nil)
	if err != nil {
		t.Fatalf("assertion: %v", err)
	}
	var assertion map[string]any
	_ = json.Unmarshal(assertionBytes, &assertion)

	body := h.grantBody(b)
	body["challenge"] = challenge
	body["assertion"] = assertion

	if code, out := h.post(t, "/v1/grants/passkey", body); code != http.StatusOK {
		t.Fatalf("first use: %d %v", code, out)
	}
	code, out := h.post(t, "/v1/grants/passkey", body)
	if code != http.StatusConflict {
		t.Fatalf("replay returned %d %v, expected 409", code, out)
	}
}

// A challenge issued for one transfer cannot be spent on another, even with a
// genuine assertion.
func TestChallengeCannotBeSpentOnAnotherTransfer(t *testing.T) {
	h := newHarness(t, false)
	auth := h.registerPasskey(t)

	agreed := h.binding("tx_" + uuid.NewString())
	code, ch := h.post(t, "/v1/grants/challenge", h.grantBody(agreed))
	if code != http.StatusOK {
		t.Fatalf("challenge: %d %v", code, ch)
	}
	challenge := ch["challenge"].(string)
	assertionBytes, _ := auth.AssertionResponse(challenge, nil)
	var assertion map[string]any
	_ = json.Unmarshal(assertionBytes, &assertion)

	other := agreed
	other.AmountMinor = 900_000
	body := h.grantBody(other)
	body["challenge"] = challenge
	body["assertion"] = assertion

	code, out := h.post(t, "/v1/grants/passkey", body)
	if code != http.StatusUnauthorized {
		t.Fatalf("repointed challenge returned %d %v, expected 401", code, out)
	}
}

// An assertion from an unknown key must not mint a grant.
func TestForgedAssertionMintsNothing(t *testing.T) {
	h := newHarness(t, false)
	auth := h.registerPasskey(t)
	b := h.binding("tx_" + uuid.NewString())

	code, ch := h.post(t, "/v1/grants/challenge", h.grantBody(b))
	if code != http.StatusOK {
		t.Fatalf("challenge: %d %v", code, ch)
	}
	challenge := ch["challenge"].(string)
	forged, err := auth.ForgedAssertionResponse(challenge, nil)
	if err != nil {
		t.Fatalf("forge: %v", err)
	}
	var assertion map[string]any
	_ = json.Unmarshal(forged, &assertion)

	body := h.grantBody(b)
	body["challenge"] = challenge
	body["assertion"] = assertion

	code, out := h.post(t, "/v1/grants/passkey", body)
	if code != http.StatusUnauthorized {
		t.Fatalf("forged assertion returned %d %v, expected 401", code, out)
	}
	if _, ok := out["grant"]; ok {
		t.Fatal("a grant was returned for a forged assertion")
	}
}

// The sandbox authenticator is off by default and says so.
func TestSandboxAuthenticatorDisabledByDefault(t *testing.T) {
	h := newHarness(t, false)
	code, out := h.post(t, "/v1/grants", h.grantBody(h.binding("tx_"+uuid.NewString())))
	if code != http.StatusNotImplemented {
		t.Fatalf("sandbox mint returned %d %v, expected 501", code, out)
	}
}

// Even when enabled, it must be refused for a subject that has a passkey: a
// weaker method is never reachable for a user who has a stronger one.
func TestSandboxAuthenticatorRefusedOnceAPasskeyExists(t *testing.T) {
	h := newHarness(t, true)

	// Before registration the sandbox path works.
	if code, out := h.post(t, "/v1/grants", h.grantBody(h.binding("tx_"+uuid.NewString()))); code != http.StatusOK {
		t.Fatalf("sandbox mint before registration: %d %v", code, out)
	}

	h.registerPasskey(t)

	code, out := h.post(t, "/v1/grants", h.grantBody(h.binding("tx_"+uuid.NewString())))
	if code != http.StatusForbidden {
		t.Fatalf("sandbox mint after registration returned %d %v, expected 403", code, out)
	}
}

// A subject with no credential cannot start an authorisation ceremony.
func TestChallengeRefusedWithoutAPasskey(t *testing.T) {
	h := newHarness(t, false)
	code, out := h.post(t, "/v1/grants/challenge", h.grantBody(h.binding("tx_"+uuid.NewString())))
	if code != http.StatusNotFound {
		t.Fatalf("challenge without passkey returned %d %v, expected 404", code, out)
	}
}
