package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/ephera/platform-control-bff/internal/store"
)

// Negative authorisation tests for the control plane. These are the gate's
// exit condition: every one of them describes something the previous console
// allowed.
//
// Skipped unless CONTROL_TEST_DATABASE_URL is set.

type harness struct {
	srv  *httptest.Server
	priv ed25519.PrivateKey
	st   *store.Store
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	url := os.Getenv("CONTROL_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("CONTROL_TEST_DATABASE_URL not set; skipping control plane tests")
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
	s := &server{store: st, sessionPK: pub}
	srv := httptest.NewServer(s.routes())
	t.Cleanup(srv.Close)
	return &harness{srv: srv, priv: priv, st: st}
}

// token mints a session as identity-access would, after a passkey assertion.
//
// Roles in a token are a snapshot from issue time and are deliberately NOT what
// the service authorises against -- it re-reads them from the database. Passing
// nil here means "whatever the database says", so the token carries a
// placeholder purely to satisfy the no-roles rule at mint time.
func (h *harness) token(t *testing.T, subject string, roles []string) string {
	t.Helper()
	if len(roles) == 0 {
		roles = []string{"session_placeholder"}
	}
	now := time.Now()
	tok, err := session.Mint(h.priv, session.Payload{
		ID:        "sess_" + subject,
		Subject:   subject,
		Roles:     roles,
		Method:    session.MethodPasskey,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(10 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint session: %v", err)
	}
	return tok
}

func (h *harness) do(t *testing.T, method, path, token string, body any) (int, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode: %v", err)
		}
	}
	req, err := http.NewRequest(method, h.srv.URL+path, &buf)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
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

const (
	maker   = "ops.maker@ephera.internal"
	checker = "ops.checker@ephera.internal"
	support = "support.agent@ephera.internal"
)

func freezeProposal() map[string]any {
	return map[string]any{
		"action":  "wallet.freeze",
		"target":  "user:demo-self:GHS",
		"reason":  "suspected account takeover reported by customer",
		"payload": map[string]any{"externalRef": "user:demo-self:GHS"},
	}
}

// D-06. Every route required authentication; the old console had none.
func TestUnauthenticatedRequestsAreRefused(t *testing.T) {
	h := newHarness(t)
	for _, tc := range []struct{ method, path string }{
		{"GET", "/v1/me"},
		{"POST", "/v1/changes"},
		{"GET", "/v1/audit/verify"},
	} {
		code, _ := h.do(t, tc.method, tc.path, "", freezeProposal())
		if code != http.StatusUnauthorized {
			t.Fatalf("%s %s returned %d, expected 401", tc.method, tc.path, code)
		}
	}
}

// A session signed by anyone other than identity-access is worthless, however
// well-formed and however senior the roles it claims.
func TestForgedSessionRefused(t *testing.T) {
	h := newHarness(t)
	_, rogue, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	now := time.Now()
	forged, err := session.Mint(rogue, session.Payload{
		ID: "sess_forged", Subject: maker, Roles: []string{"ops_manager", "approver"},
		Method: session.MethodPasskey, IssuedAt: now.Unix(), ExpiresAt: now.Add(time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if code, _ := h.do(t, "GET", "/v1/me", forged, nil); code != http.StatusUnauthorized {
		t.Fatalf("forged session returned %d, expected 401", code)
	}
}

// D-12. Roles come from the signed session and the database, never from the
// request. Claiming a role you do not hold must not work.
func TestRolesCannotBeSelfAsserted(t *testing.T) {
	h := newHarness(t)
	// A genuine session for a support agent that claims ops_manager. The token
	// is validly signed, so this tests that roles are re-read from the database.
	tok := h.token(t, support, []string{"ops_manager", "approver"})

	code, body := h.do(t, "GET", "/v1/me", tok, nil)
	if code != http.StatusOK {
		t.Fatalf("me returned %d %v", code, body)
	}
	roles := fmt.Sprint(body["roles"])
	if roles != "[support_agent]" {
		t.Fatalf("roles came from the token, not the database: %v", roles)
	}

	// And the claimed role must not grant the permission.
	code, _ = h.do(t, "POST", "/v1/changes", tok, freezeProposal())
	if code != http.StatusForbidden {
		t.Fatalf("support agent proposing a freeze returned %d, expected 403", code)
	}
}

// D-13. The heart of maker-checker: the proposer cannot approve their own change.
func TestSelfApprovalRefused(t *testing.T) {
	h := newHarness(t)
	// Give the maker the approver role too -- so the only thing standing between
	// them and self-approval is the rule itself, not a missing permission.
	makerTok := h.token(t, maker, nil)

	code, body := h.do(t, "POST", "/v1/changes", makerTok, freezeProposal())
	if code != http.StatusCreated {
		t.Fatalf("propose returned %d %v", code, body)
	}
	id := body["id"].(string)

	// The maker holds ops_manager but not approver, so this is a permission
	// failure; the important assertion is the one below it.
	code, _ = h.do(t, "POST", "/v1/changes/"+id+"/decision", makerTok,
		map[string]any{"decision": "approved"})
	if code != http.StatusForbidden {
		t.Fatalf("maker approving own change returned %d, expected 403", code)
	}

	// Directly at the store, with the self-approval rule as the only guard.
	if _, err := h.st.Decide(context.Background(), id, maker, "approved", ""); err == nil {
		t.Fatal("store allowed self-approval")
	}
}

// The database refuses a self-approval even if application code is bypassed.
func TestSelfApprovalRefusedByTheDatabase(t *testing.T) {
	h := newHarness(t)
	makerTok := h.token(t, maker, nil)
	code, body := h.do(t, "POST", "/v1/changes", makerTok, freezeProposal())
	if code != http.StatusCreated {
		t.Fatalf("propose: %d %v", code, body)
	}
	id := body["id"].(string)

	_, err := h.st.Pool().Exec(context.Background(),
		`UPDATE change_requests SET status='approved', decided_by=$2, decided_at=now() WHERE id=$1`,
		id, maker)
	if err == nil {
		t.Fatal("database accepted a self-approved change request")
	}
}

// The full path: propose, a different operator approves, then apply.
func TestMakerCheckerHappyPath(t *testing.T) {
	h := newHarness(t)
	makerTok := h.token(t, maker, nil)
	checkerTok := h.token(t, checker, nil)

	code, body := h.do(t, "POST", "/v1/changes", makerTok, freezeProposal())
	if code != http.StatusCreated {
		t.Fatalf("propose: %d %v", code, body)
	}
	id := body["id"].(string)
	if body["requiresSecondOperator"] != true {
		t.Fatal("a wallet freeze should require a second operator")
	}

	// Cannot be applied before approval.
	if code, _ := h.do(t, "POST", "/v1/changes/"+id+"/apply", makerTok, nil); code != http.StatusConflict {
		t.Fatalf("apply before approval returned %d, expected 409", code)
	}

	code, body = h.do(t, "POST", "/v1/changes/"+id+"/decision", checkerTok,
		map[string]any{"decision": "approved", "note": "verified with customer"})
	if code != http.StatusOK || body["status"] != "approved" {
		t.Fatalf("approve: %d %v", code, body)
	}

	code, body = h.do(t, "POST", "/v1/changes/"+id+"/apply", makerTok, nil)
	if code != http.StatusOK || body["status"] != "applied" {
		t.Fatalf("apply: %d %v", code, body)
	}

	// Applying twice must not succeed.
	if code, _ := h.do(t, "POST", "/v1/changes/"+id+"/apply", makerTok, nil); code == http.StatusOK {
		t.Fatal("a change was applied twice")
	}
}

// A change with no justification is refused: an audit trail without why is
// barely an audit trail.
func TestReasonIsMandatory(t *testing.T) {
	h := newHarness(t)
	p := freezeProposal()
	p["reason"] = "   "
	code, _ := h.do(t, "POST", "/v1/changes", h.token(t, maker, nil), p)
	if code != http.StatusBadRequest {
		t.Fatalf("proposal without a reason returned %d, expected 400", code)
	}
}

// A suspended operator loses access immediately, without waiting for their
// session to expire.
func TestSuspendedOperatorRefused(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	subject := "suspended." + fmt.Sprint(time.Now().UnixNano()) + "@ephera.internal"
	if _, err := h.st.Pool().Exec(ctx,
		`INSERT INTO operators (subject, display_name, status) VALUES ($1,'Suspended','suspended')`,
		subject); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := h.st.Pool().Exec(ctx,
		`INSERT INTO operator_roles (subject, role) VALUES ($1,'ops_manager')`, subject); err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	tok := h.token(t, subject, []string{"ops_manager"})
	if code, _ := h.do(t, "GET", "/v1/me", tok, nil); code != http.StatusUnauthorized {
		t.Fatalf("suspended operator returned %d, expected 401", code)
	}
}

// D-14. The audit trail is append-only and hash-chained.
func TestAuditChainDetectsTampering(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	makerTok := h.token(t, maker, nil)

	// Generate some history.
	for i := 0; i < 3; i++ {
		h.do(t, "POST", "/v1/changes", makerTok, freezeProposal())
	}
	if bad, err := h.st.VerifyChain(ctx); err != nil || bad != 0 {
		t.Fatalf("chain not intact before tampering: bad=%d err=%v", bad, err)
	}

	// The database itself refuses edits and deletions.
	if _, err := h.st.Pool().Exec(ctx,
		`UPDATE audit_log SET actor='someone.else' WHERE seq = (SELECT max(seq) FROM audit_log)`); err == nil {
		t.Fatal("audit_log accepted an update")
	}
	if _, err := h.st.Pool().Exec(ctx,
		`DELETE FROM audit_log WHERE seq = (SELECT max(seq) FROM audit_log)`); err == nil {
		t.Fatal("audit_log accepted a delete")
	}
	if bad, err := h.st.VerifyChain(ctx); err != nil || bad != 0 {
		t.Fatalf("chain broken after refused tampering: bad=%d err=%v", bad, err)
	}
}

// A denied attempt is recorded, not silently dropped: refusals are what a
// reviewer most wants to see.
func TestDeniedAttemptsAreAudited(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	var before int
	if err := h.st.Pool().QueryRow(ctx,
		`SELECT count(*) FROM audit_log WHERE outcome='denied'`).Scan(&before); err != nil {
		t.Fatalf("count: %v", err)
	}

	// Unauthenticated, then authenticated-but-forbidden.
	h.do(t, "POST", "/v1/changes", "", freezeProposal())
	h.do(t, "POST", "/v1/changes", h.token(t, support, nil), freezeProposal())

	var after int
	if err := h.st.Pool().QueryRow(ctx,
		`SELECT count(*) FROM audit_log WHERE outcome='denied'`).Scan(&after); err != nil {
		t.Fatalf("count: %v", err)
	}
	if after < before+2 {
		t.Fatalf("denied attempts were not audited: %d -> %d", before, after)
	}
}

// The actor recorded in the audit trail is the authenticated operator, and
// cannot be influenced by the request body.
func TestAuditActorComesFromTheSession(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	p := freezeProposal()
	p["actor"] = "superadmin" // the field the old console trusted
	p["reason"] = "actor field should be ignored"

	code, body := h.do(t, "POST", "/v1/changes", h.token(t, maker, nil), p)
	if code != http.StatusCreated {
		t.Fatalf("propose: %d %v", code, body)
	}
	var actor string
	if err := h.st.Pool().QueryRow(ctx,
		`SELECT actor FROM audit_log ORDER BY seq DESC LIMIT 1`).Scan(&actor); err != nil {
		t.Fatalf("read audit: %v", err)
	}
	if actor != maker {
		t.Fatalf("audit actor is %q; the request body was trusted", actor)
	}
}

// An expired session is refused.
func TestExpiredSessionRefused(t *testing.T) {
	h := newHarness(t)
	old := time.Now().Add(-2 * time.Hour)
	tok, err := session.Mint(h.priv, session.Payload{
		ID: "sess_old", Subject: maker, Roles: []string{"ops_manager"},
		Method: session.MethodPasskey, IssuedAt: old.Unix(), ExpiresAt: old.Add(10 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if code, _ := h.do(t, "GET", "/v1/me", tok, nil); code != http.StatusUnauthorized {
		t.Fatalf("expired session returned %d, expected 401", code)
	}
}
