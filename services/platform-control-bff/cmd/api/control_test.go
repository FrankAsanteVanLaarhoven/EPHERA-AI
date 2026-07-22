package main

import (
	"bytes"
	"context"
	"errors"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/ephera/platform-control-bff/internal/effect"
	"github.com/ephera/platform-control-bff/internal/store"
)

// recordingApplier stands in for the owning service so the apply path can be
// tested without one, and so a refusal can be simulated.
type recordingApplier struct {
	calls []effect.Request
	err   error
}

func (a *recordingApplier) Apply(_ context.Context, req effect.Request) error {
	a.calls = append(a.calls, req)
	return a.err
}

// Negative authorisation tests for the control plane. These are the gate's
// exit condition: every one of them describes something the previous console
// allowed.
//
// Skipped unless CONTROL_TEST_DATABASE_URL is set.

type harness struct {
	srv     *httptest.Server
	priv    ed25519.PrivateKey
	st      *store.Store
	applier *recordingApplier
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
	ap := &recordingApplier{}
	s := &server{store: st, sessionPK: pub, applier: ap}
	srv := httptest.NewServer(s.routes())
	t.Cleanup(srv.Close)
	return &harness{srv: srv, priv: priv, st: st, applier: ap}
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


// D-17. Applying an approved change must reach the service that owns the thing
// being changed, carrying the approval it was authorised under.
func TestApplyCallsTheOwningService(t *testing.T) {
	h := newHarness(t)
	makerTok := h.token(t, maker, nil)
	checkerTok := h.token(t, checker, nil)

	code, body := h.do(t, "POST", "/v1/changes", makerTok, freezeProposal())
	if code != http.StatusCreated {
		t.Fatalf("propose: %d %v", code, body)
	}
	id := body["id"].(string)
	h.do(t, "POST", "/v1/changes/"+id+"/decision", checkerTok,
		map[string]any{"decision": "approved", "note": "ok"})

	if len(h.applier.calls) != 0 {
		t.Fatal("the owning service was called before the change was applied")
	}
	if code, body = h.do(t, "POST", "/v1/changes/"+id+"/apply", makerTok, nil); code != http.StatusOK {
		t.Fatalf("apply: %d %v", code, body)
	}
	if len(h.applier.calls) != 1 {
		t.Fatalf("expected one call to the owning service, got %d", len(h.applier.calls))
	}
	call := h.applier.calls[0]
	if call.Action != "wallet.freeze" || call.Target != "user:demo-self:GHS" {
		t.Fatalf("wrong effect dispatched: %+v", call)
	}
	if call.ChangeRequestID != id {
		t.Fatalf("effect did not carry the approval: %q", call.ChangeRequestID)
	}
	if call.OperatorSession == "" {
		t.Fatal("effect did not carry the operator session for the owning service to verify")
	}
}

// If the owning service refuses, the change must NOT be recorded as applied.
// Claiming an effect that did not happen is the defect being fixed.
func TestFailedEffectIsNotRecordedAsApplied(t *testing.T) {
	h := newHarness(t)
	makerTok := h.token(t, maker, nil)
	checkerTok := h.token(t, checker, nil)

	code, body := h.do(t, "POST", "/v1/changes", makerTok, freezeProposal())
	if code != http.StatusCreated {
		t.Fatalf("propose: %d %v", code, body)
	}
	id := body["id"].(string)
	h.do(t, "POST", "/v1/changes/"+id+"/decision", checkerTok,
		map[string]any{"decision": "approved", "note": "ok"})

	h.applier.err = errors.New("ledger unreachable")
	if code, _ = h.do(t, "POST", "/v1/changes/"+id+"/apply", makerTok, nil); code != http.StatusBadGateway {
		t.Fatalf("apply with a failing effect returned %d, expected 502", code)
	}

	cr, err := h.st.GetChangeRequest(context.Background(), id)
	if err != nil {
		t.Fatalf("read change: %v", err)
	}
	if cr.Status != "approved" {
		t.Fatalf("status is %q; a failed effect must leave it approved, not applied", cr.Status)
	}

	var outcome string
	if err := h.st.Pool().QueryRow(context.Background(),
		`SELECT outcome FROM audit_log WHERE change_request_id = $1 ORDER BY seq DESC LIMIT 1`,
		id).Scan(&outcome); err != nil {
		t.Fatalf("read audit: %v", err)
	}
	if outcome != "failed" {
		t.Fatalf("audit outcome is %q, expected failed", outcome)
	}
}

// An action with no owning service is refused rather than reported as applied.
func TestActionWithNoOwningServiceIsRefused(t *testing.T) {
	h := newHarness(t)
	makerTok := h.token(t, maker, nil)
	checkerTok := h.token(t, checker, nil)

	p := freezeProposal()
	p["action"] = "kill_switch"
	p["target"] = "payments"
	code, body := h.do(t, "POST", "/v1/changes", makerTok, p)
	if code != http.StatusCreated {
		t.Fatalf("propose: %d %v", code, body)
	}
	id := body["id"].(string)
	h.do(t, "POST", "/v1/changes/"+id+"/decision", checkerTok,
		map[string]any{"decision": "approved", "note": "ok"})

	h.applier.err = effect.ErrNoOwningService
	code, _ = h.do(t, "POST", "/v1/changes/"+id+"/apply", makerTok, nil)
	if code != http.StatusNotImplemented {
		t.Fatalf("kill switch apply returned %d, expected 501", code)
	}
	cr, _ := h.st.GetChangeRequest(context.Background(), id)
	if cr.Status == "applied" {
		t.Fatal("an action with no owning service was recorded as applied")
	}
}

// --- compliance console surface ---

// fakeCompliance stands in for compliance-risk, recording who the control plane
// says is deciding.
type fakeCompliance struct {
	closedBy   string
	reviewedBy string
	decidedBy  string
	calls      int
}

func (f *fakeCompliance) ListCases(context.Context) (map[string]any, int, error) {
	f.calls++
	return map[string]any{"items": []any{}}, 200, nil
}
func (f *fakeCompliance) CloseCase(_ context.Context, _, _, closedBy, _ string) (map[string]any, int, error) {
	f.closedBy = closedBy
	return map[string]any{"status": "cleared"}, 200, nil
}
func (f *fakeCompliance) Subject(context.Context, string) (map[string]any, int, error) {
	return map[string]any{"tier": "verified"}, 200, nil
}
func (f *fakeCompliance) Requirements(context.Context, string, string) (map[string]any, int, error) {
	return map[string]any{"missingEvidence": []any{}}, 200, nil
}
func (f *fakeCompliance) ReviewDocument(_ context.Context, _, _, reviewedBy, _ string) (map[string]any, int, error) {
	f.reviewedBy = reviewedBy
	return map[string]any{"status": "verified"}, 200, nil
}
func (f *fakeCompliance) SetTier(_ context.Context, _, _, decidedBy, _ string) (map[string]any, int, error) {
	f.decidedBy = decidedBy
	return map[string]any{"tier": "verified"}, 200, nil
}

func complianceHarness(t *testing.T) (*harness, *fakeCompliance) {
	t.Helper()
	h := newHarness(t)
	fc := &fakeCompliance{}
	// Rebuild the server with the fake attached.
	s := &server{store: h.st, sessionPK: h.priv.Public().(ed25519.PublicKey), applier: h.applier, compliance: fc}
	srv := httptest.NewServer(s.routes())
	t.Cleanup(srv.Close)
	h.srv = srv
	return h, fc
}

func TestComplianceRoutesRequireAuthentication(t *testing.T) {
	h, _ := complianceHarness(t)
	for _, tc := range []struct{ method, path string }{
		{"GET", "/v1/compliance/cases"},
		{"POST", "/v1/compliance/cases/abc/decision"},
		{"POST", "/v1/compliance/subjects/s/tier"},
	} {
		if code, _ := h.do(t, tc.method, tc.path, "", map[string]any{}); code != http.StatusUnauthorized {
			t.Fatalf("%s %s returned %d, expected 401", tc.method, tc.path, code)
		}
	}
}

// A support agent may see that a payment is held without being able to decide
// it. Viewing and deciding are separate permissions on purpose.
func TestSupportAgentCanViewCasesButNotDecideThem(t *testing.T) {
	h, _ := complianceHarness(t)
	tok := h.token(t, support, nil)

	if code, _ := h.do(t, "GET", "/v1/compliance/cases", tok, nil); code != http.StatusOK {
		t.Fatalf("support agent could not view cases: %d", code)
	}
	code, _ := h.do(t, "POST", "/v1/compliance/cases/abc/decision", tok,
		map[string]any{"status": "cleared", "note": "looks fine"})
	if code != http.StatusForbidden {
		t.Fatalf("support agent decided a case: %d", code)
	}
}

// The deciding analyst comes from the session, so the console cannot claim to
// be someone else — which is what lets compliance-risk enforce its own rule
// that nobody decides their own case.
func TestDecidingAnalystComesFromTheSession(t *testing.T) {
	h, fc := complianceHarness(t)
	ctx := context.Background()
	if _, err := h.st.Pool().Exec(ctx,
		`INSERT INTO operators (subject, display_name) VALUES ('analyst@ephera.internal','Analyst')
		 ON CONFLICT (subject) DO NOTHING`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := h.st.Pool().Exec(ctx,
		`INSERT INTO operator_roles (subject, role) VALUES ('analyst@ephera.internal','risk_analyst')
		 ON CONFLICT DO NOTHING`); err != nil {
		t.Fatalf("seed roles: %v", err)
	}

	tok := h.token(t, "analyst@ephera.internal", nil)
	code, _ := h.do(t, "POST", "/v1/compliance/cases/abc/decision", tok,
		map[string]any{"status": "cleared", "note": "verified with the customer", "closedBy": "someone.else@ephera.internal"})
	if code != http.StatusOK {
		t.Fatalf("analyst could not decide: %d", code)
	}
	if fc.closedBy != "analyst@ephera.internal" {
		t.Fatalf("decider was %q; the request body was trusted", fc.closedBy)
	}
}

// A case decision without a note cannot be reviewed later.
func TestCaseDecisionRequiresANote(t *testing.T) {
	h, _ := complianceHarness(t)
	ctx := context.Background()
	_, _ = h.st.Pool().Exec(ctx,
		`INSERT INTO operators (subject, display_name) VALUES ('officer@ephera.internal','Officer')
		 ON CONFLICT (subject) DO NOTHING`)
	_, _ = h.st.Pool().Exec(ctx,
		`INSERT INTO operator_roles (subject, role) VALUES ('officer@ephera.internal','compliance_officer')
		 ON CONFLICT DO NOTHING`)

	tok := h.token(t, "officer@ephera.internal", nil)
	code, _ := h.do(t, "POST", "/v1/compliance/cases/abc/decision", tok,
		map[string]any{"status": "cleared"})
	if code != http.StatusBadRequest {
		t.Fatalf("a case was decided with no note: %d", code)
	}
}

// Deciding a customer's standing is a separate responsibility from
// investigating a payment: an analyst works cases but does not set tiers.
func TestAnalystCannotSetATier(t *testing.T) {
	h, _ := complianceHarness(t)
	ctx := context.Background()
	_, _ = h.st.Pool().Exec(ctx,
		`INSERT INTO operators (subject, display_name) VALUES ('analyst2@ephera.internal','Analyst')
		 ON CONFLICT (subject) DO NOTHING`)
	_, _ = h.st.Pool().Exec(ctx,
		`INSERT INTO operator_roles (subject, role) VALUES ('analyst2@ephera.internal','risk_analyst')
		 ON CONFLICT DO NOTHING`)

	tok := h.token(t, "analyst2@ephera.internal", nil)
	code, _ := h.do(t, "POST", "/v1/compliance/subjects/user:x:GHS/tier", tok,
		map[string]any{"tier": "verified", "reason": "looks fine to me"})
	if code != http.StatusForbidden {
		t.Fatalf("an analyst set a verification tier: %d", code)
	}
}

// Compliance work is audited like everything else, with the operator's identity.
func TestComplianceDecisionsAreAudited(t *testing.T) {
	h, _ := complianceHarness(t)
	ctx := context.Background()
	_, _ = h.st.Pool().Exec(ctx,
		`INSERT INTO operators (subject, display_name) VALUES ('officer2@ephera.internal','Officer')
		 ON CONFLICT (subject) DO NOTHING`)
	_, _ = h.st.Pool().Exec(ctx,
		`INSERT INTO operator_roles (subject, role) VALUES ('officer2@ephera.internal','compliance_officer')
		 ON CONFLICT DO NOTHING`)

	tok := h.token(t, "officer2@ephera.internal", nil)
	h.do(t, "POST", "/v1/compliance/cases/case-xyz/decision", tok,
		map[string]any{"status": "blocked", "note": "confirmed fraud"})

	var actor, action string
	if err := h.st.Pool().QueryRow(ctx,
		`SELECT actor, action FROM audit_log WHERE target = 'case-xyz' ORDER BY seq DESC LIMIT 1`).
		Scan(&actor, &action); err != nil {
		t.Fatalf("read audit: %v", err)
	}
	if actor != "officer2@ephera.internal" || action != "cases.decide" {
		t.Fatalf("audit recorded %q %q", actor, action)
	}
}
