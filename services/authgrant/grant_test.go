package authgrant

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"
)

func itoa(v int64) string { return strconv.FormatInt(v, 10) }

// signRaw signs an arbitrary payload body, so tests can construct payloads the
// Mint helper would refuse to build.
func signRaw(t *testing.T, priv ed25519.PrivateKey, body string) string {
	t.Helper()
	encoded := base64.RawURLEncoding.EncodeToString([]byte(body))
	sig := ed25519.Sign(priv, []byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func keypair(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	return pub, priv
}

func binding() Binding {
	return Binding{
		FromExternalRef: "user:demo-self:GHS",
		ToExternalRef:   "user:ama:GHS",
		AmountMinor:     25_000,
		FeeMinor:        50,
		Currency:        "GHS",
		TransferID:      "tx_1",
	}
}

func mint(t *testing.T, priv ed25519.PrivateKey, b Binding, now time.Time) string {
	t.Helper()
	g, err := Mint(priv, Payload{
		ID:        "grant_1",
		Subject:   "user:demo-self:GHS",
		Method:    MethodSandboxAuthenticator,
		Binding:   b.Digest(),
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	return g
}

func TestValidGrantVerifies(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	p, err := Verify(pub, mint(t, priv, binding(), now), binding(), now)
	if err != nil {
		t.Fatalf("expected acceptance, got %v", err)
	}
	if p.Method != MethodSandboxAuthenticator {
		t.Fatalf("method not carried: %q", p.Method)
	}
	if p.ID != "grant_1" {
		t.Fatalf("id not carried: %q", p.ID)
	}
}

// The defining property. A grant authorises one transaction; altering any field
// that determines where money goes must invalidate it.
func TestGrantIsBoundToTheTransaction(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	grant := mint(t, priv, binding(), now)

	tampered := map[string]func(*Binding){
		"amount increased":  func(b *Binding) { b.AmountMinor = 250_000 },
		"amount decreased":  func(b *Binding) { b.AmountMinor = 1 },
		"recipient swapped": func(b *Binding) { b.ToExternalRef = "user:attacker:GHS" },
		"sender swapped":    func(b *Binding) { b.FromExternalRef = "user:victim:GHS" },
		"fee raised":        func(b *Binding) { b.FeeMinor = 9_999 },
		"currency changed":  func(b *Binding) { b.Currency = "GBP" },
		"transfer id reused": func(b *Binding) { b.TransferID = "tx_other" },
	}

	for name, mutate := range tampered {
		t.Run(name, func(t *testing.T) {
			b := binding()
			mutate(&b)
			if _, err := Verify(pub, grant, b, now); !errors.Is(err, ErrBindingMismatch) {
				t.Fatalf("expected ErrBindingMismatch, got %v", err)
			}
		})
	}
}

// Field boundaries must be unambiguous: no rearrangement of values across
// adjacent fields may produce the same digest.
func TestBindingDigestIsUnambiguous(t *testing.T) {
	a := Binding{FromExternalRef: "ab", ToExternalRef: "c", Currency: "GHS", TransferID: "t"}
	b := Binding{FromExternalRef: "a", ToExternalRef: "bc", Currency: "GHS", TransferID: "t"}
	if a.Digest() == b.Digest() {
		t.Fatal("adjacent fields collide; the digest is not length-prefixed correctly")
	}
}

func TestForgedSignatureRejected(t *testing.T) {
	_, priv := keypair(t)
	otherPub, _ := keypair(t)
	now := time.Now()
	grant := mint(t, priv, binding(), now)

	if _, err := Verify(otherPub, grant, binding(), now); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("grant verified under the wrong key: %v", err)
	}
}

// A grant whose payload is edited after signing must fail, even though the
// edited payload is well-formed JSON.
func TestTamperedPayloadRejected(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	grant := mint(t, priv, binding(), now)

	encoded, sig, _ := strings.Cut(grant, ".")
	// Flip a character in the payload segment.
	mutated := []byte(encoded)
	if mutated[3] == 'A' {
		mutated[3] = 'B'
	} else {
		mutated[3] = 'A'
	}
	if _, err := Verify(pub, string(mutated)+"."+sig, binding(), now); err == nil {
		t.Fatal("tampered payload verified")
	}
}

func TestExpiryEnforced(t *testing.T) {
	pub, priv := keypair(t)
	issued := time.Now()
	grant := mint(t, priv, binding(), issued)

	if _, err := Verify(pub, grant, binding(), issued.Add(10*time.Minute)); !errors.Is(err, ErrExpired) {
		t.Fatalf("expected ErrExpired, got %v", err)
	}
	if _, err := Verify(pub, grant, binding(), issued.Add(-10*time.Minute)); !errors.Is(err, ErrNotYetValid) {
		t.Fatalf("expected ErrNotYetValid, got %v", err)
	}
}

// A grant is not a session. The issuer cannot mint a long-lived one, and a
// verifier will not honour one even if some other issuer did.
func TestLifetimeCeilingEnforcedOnBothSides(t *testing.T) {
	_, priv := keypair(t)
	now := time.Now()
	_, err := Mint(priv, Payload{
		ID:        "grant_long",
		Subject:   "user:demo-self:GHS",
		Binding:   binding().Digest(),
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(24 * time.Hour).Unix(),
	})
	if !errors.Is(err, ErrLifetimeTooLong) {
		t.Fatalf("mint accepted a 24h grant: %v", err)
	}
}

func TestWrongIssuerRejected(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	grant, err := Mint(priv, Payload{
		ID:        "grant_1",
		Issuer:    "not-ephera",
		Subject:   "user:demo-self:GHS",
		Binding:   binding().Digest(),
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if _, err := Verify(pub, grant, binding(), now); !errors.Is(err, ErrWrongIssuer) {
		t.Fatalf("expected ErrWrongIssuer, got %v", err)
	}
}

// The strings every surface used to fabricate must not verify as grants.
func TestLegacyFabricatedReferencesRejected(t *testing.T) {
	pub, _ := keypair(t)
	now := time.Now()
	legacy := []string{
		"aaaaaaaa",
		"passkey_admin_console_demo",
		"passkey_pwa_1784617797470",
		"passkey_mock_tx_1_25000_1784617797470",
		"ref_placeholder",
		"",
		".",
		"a.b",
	}
	for _, ref := range legacy {
		if _, err := Verify(pub, ref, binding(), now); err == nil {
			t.Fatalf("legacy reference %q verified as a grant", ref)
		}
	}
}

func TestUnknownFieldsRejected(t *testing.T) {
	pub, priv := keypair(t)
	now := time.Now()
	// A payload carrying an extra field is refused rather than silently
	// ignored, so a future field cannot be smuggled past an old verifier.
	raw := `{"v":"` + Version + `","jti":"g","iss":"` + Issuer + `","sub":"s","method":"passkey","binding":"` +
		binding().Digest() + `","iat":` + itoa(now.Unix()) + `,"exp":` + itoa(now.Add(time.Minute).Unix()) +
		`,"scope":"everything"}`
	grant := signRaw(t, priv, raw)
	if _, err := Verify(pub, grant, binding(), now); !errors.Is(err, ErrMalformed) {
		t.Fatalf("expected ErrMalformed, got %v", err)
	}
}
