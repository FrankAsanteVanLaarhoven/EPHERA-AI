package main

import (
	"crypto/ed25519"
	"testing"
	"time"

	"github.com/ephera/authgrant/session"
)

// The CRITICAL finding: registration was open, so anyone could register a
// passkey for any subject — including a seeded operator — and then drive
// maker-checker with two identities they control. These tests hold the gate.

// In production (enrolment closed), register/begin with no enrolment token is
// refused. This is the line that stops the takeover.
func TestRegistrationRefusedWithoutEnrolmentTokenInProduction(t *testing.T) {
	h := newHarness(t, false)
	h.s.enrolmentOpen = false // a production-shaped server

	code, body := h.post(t, "/v1/passkeys/register/begin",
		map[string]any{"subject": "ops.maker@ephera.internal", "displayName": "attacker"})
	if code != 401 {
		t.Fatalf("open registration for an operator subject was permitted: %d %v", code, body)
	}
}

// A token issued for one subject cannot authorise registering another.
func TestEnrolmentTokenIsBoundToItsSubject(t *testing.T) {
	h := newHarness(t, false)
	h.s.enrolmentOpen = false

	token, _, err := mintEnrolmentToken(h.s.priv, "customer:alice", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	// Present alice's token to register the operator subject.
	code, body := h.post(t, "/v1/passkeys/register/begin", map[string]any{
		"subject": "ops.maker@ephera.internal", "enrolmentToken": token,
	})
	if code != 401 {
		t.Fatalf("a token for customer:alice authorised registering ops.maker: %d %v", code, body)
	}
}

// A valid token authorises exactly one registration ceremony; a replay is
// refused because the jti is consumed.
func TestEnrolmentTokenIsSingleUse(t *testing.T) {
	h := newHarness(t, false)
	h.s.enrolmentOpen = false
	subject := h.subject

	token, _, err := mintEnrolmentToken(h.s.priv, subject, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if code, body := h.post(t, "/v1/passkeys/register/begin",
		map[string]any{"subject": subject, "enrolmentToken": token}); code != 200 {
		t.Fatalf("a valid enrolment token was refused: %d %v", code, body)
	}
	// The same token again must fail — it was consumed.
	if code, _ := h.post(t, "/v1/passkeys/register/begin",
		map[string]any{"subject": subject, "enrolmentToken": token}); code != 401 {
		t.Fatalf("an enrolment token was accepted twice (code %d)", code)
	}
}

// A forged token (signed by a key the server does not hold) is refused.
func TestForgedEnrolmentTokenIsRefused(t *testing.T) {
	h := newHarness(t, false)
	h.s.enrolmentOpen = false

	_, otherPriv, _ := ed25519.GenerateKey(nil)
	forged, _, err := mintEnrolmentToken(otherPriv, h.subject, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if code, _ := h.post(t, "/v1/passkeys/register/begin",
		map[string]any{"subject": h.subject, "enrolmentToken": forged}); code != 401 {
		t.Fatalf("a forged enrolment token was accepted (code %d)", code)
	}
}

// Issuing a token requires an operator session in production; an unauthenticated
// caller cannot mint one.
func TestEnrolmentTokenIssuanceRequiresAnOperatorInProduction(t *testing.T) {
	h := newHarness(t, false)
	h.s.enrolmentOpen = false

	if code, _ := h.post(t, "/v1/enrolment/token",
		map[string]any{"subject": "ops.maker@ephera.internal"}); code != 401 {
		t.Fatalf("an unauthenticated caller minted an enrolment token (code %d)", code)
	}

	// With a valid operator session, issuance succeeds.
	opSession, err := session.Mint(h.s.priv, session.Payload{
		ID: "sess_1", Subject: "ops.admin@ephera.internal", Method: session.MethodPasskey,
		Roles: []string{"ops_manager"}, IssuedAt: time.Now().Unix(),
		ExpiresAt: time.Now().Add(session.MaxLifetime).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	code, body := h.post(t, "/v1/enrolment/token", map[string]any{
		"subject": "customer:new", "operatorSession": opSession,
	})
	if code != 200 {
		t.Fatalf("an operator could not provision an enrolment token: %d %v", code, body)
	}
	if body["enrolmentToken"] == nil {
		t.Fatal("no token returned")
	}
}

// In the sandbox, enrolment stays open so demos and local development work.
func TestSandboxEnrolmentStaysOpen(t *testing.T) {
	h := newHarness(t, true) // harness sets enrolmentOpen: true
	if code, body := h.post(t, "/v1/passkeys/register/begin",
		map[string]any{"subject": h.subject, "displayName": "demo"}); code != 200 {
		t.Fatalf("sandbox registration was blocked: %d %v", code, body)
	}
}
