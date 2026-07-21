package session

import (
	"crypto/ed25519"
	"errors"
	"testing"
	"time"
)

func keypair(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	return pub, priv
}

func mint(t *testing.T, priv ed25519.PrivateKey, roles []string, now time.Time) string {
	t.Helper()
	tok, err := Mint(priv, Payload{
		ID:        "sess_1",
		Subject:   "ops.agent@ephera.internal",
		Roles:     roles,
		Method:    MethodPasskey,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(10 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	return tok
}

func TestValidSessionVerifies(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	p, err := Verify(pub, mint(t, priv, []string{"ops_agent"}, now), now)
	if err != nil {
		t.Fatalf("expected acceptance, got %v", err)
	}
	if p.Subject != "ops.agent@ephera.internal" {
		t.Fatalf("subject %q", p.Subject)
	}
	if !p.HasRole("ops_agent") || p.HasRole("super_admin") {
		t.Fatalf("roles wrong: %v", p.Roles)
	}
	if p.Method != MethodPasskey {
		t.Fatalf("method %q", p.Method)
	}
}

// Roles come from the signed session, so a caller cannot grant itself a role by
// editing the token.
func TestTamperedRolesRejected(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	tok := mint(t, priv, []string{"support_agent"}, now)

	encoded := tok[:len(tok)-10]
	if _, err := Verify(pub, encoded+"AAAAAAAAAA", now); err == nil {
		t.Fatal("token with a mangled signature verified")
	}

	// Re-signing with a different key must not help either.
	_, rogue := keypair(t)
	forged, err := Mint(rogue, Payload{
		ID: "sess_x", Subject: "attacker", Roles: []string{"super_admin"},
		Method: MethodPasskey, IssuedAt: now.Unix(), ExpiresAt: now.Add(time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if _, err := Verify(pub, forged, now); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("expected ErrBadSignature, got %v", err)
	}
}

func TestExpiryEnforced(t *testing.T) {
	pub, priv := keypair(t)
	issued := time.Now()
	tok := mint(t, priv, []string{"ops_agent"}, issued)

	if _, err := Verify(pub, tok, issued.Add(time.Hour)); !errors.Is(err, ErrExpired) {
		t.Fatalf("expected ErrExpired, got %v", err)
	}
	if _, err := Verify(pub, tok, issued.Add(-time.Hour)); !errors.Is(err, ErrNotYetValid) {
		t.Fatalf("expected ErrNotYetValid, got %v", err)
	}
}

// A console tab left open must not stay privileged indefinitely.
func TestLifetimeCeilingEnforcedAtMint(t *testing.T) {
	_, priv := keypair(t)
	now := time.Now()
	_, err := Mint(priv, Payload{
		ID: "sess_long", Subject: "ops", Roles: []string{"ops_agent"},
		IssuedAt: now.Unix(), ExpiresAt: now.Add(24 * time.Hour).Unix(),
	})
	if !errors.Is(err, ErrLifetimeTooLong) {
		t.Fatalf("mint accepted a 24h session: %v", err)
	}
}

// A session with no roles authorises nothing; refusing to mint it prevents a
// caller treating "no roles" as "unchecked".
func TestRolelessSessionRefused(t *testing.T) {
	_, priv := keypair(t)
	now := time.Now()
	if _, err := Mint(priv, Payload{
		ID: "s", Subject: "ops", Roles: nil,
		IssuedAt: now.Unix(), ExpiresAt: now.Add(time.Minute).Unix(),
	}); err == nil {
		t.Fatal("minted a session with no roles")
	}
}

func TestUnknownFieldsRejected(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	raw := `{"v":"` + Version + `","jti":"s","iss":"` + Issuer +
		`","sub":"ops","roles":["ops_agent"],"method":"passkey","iat":` +
		itoa(now.Unix()) + `,"exp":` + itoa(now.Add(time.Minute).Unix()) + `,"admin":true}`
	tok := signRaw(t, priv, raw)
	if _, err := Verify(pub, tok, now); !errors.Is(err, ErrMalformed) {
		t.Fatalf("expected ErrMalformed, got %v", err)
	}
}

// An authorisation grant must not be usable as a session, or vice versa.
func TestGrantIsNotASession(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	raw := `{"v":"ephera-authorisation-grant/1","jti":"g","iss":"` + Issuer +
		`","sub":"user:demo-self:GHS","method":"passkey","binding":"deadbeef","iat":` +
		itoa(now.Unix()) + `,"exp":` + itoa(now.Add(time.Minute).Unix()) + `}`
	tok := signRaw(t, priv, raw)
	if _, err := Verify(pub, tok, now); err == nil {
		t.Fatal("an authorisation grant verified as an operator session")
	}
}
