package passkey

import (
	"bytes"
	"encoding/hex"
	"errors"
	"testing"

	"github.com/ephera/authgrant"
	"github.com/ephera/identity-access/internal/webauthntest"
	"github.com/go-webauthn/webauthn/webauthn"
)

func newAuthenticator(t *testing.T, rpID, origin string) *webauthntest.Authenticator {
	t.Helper()
	a, err := webauthntest.New(rpID, origin)
	if err != nil {
		t.Fatalf("authenticator: %v", err)
	}
	return a
}

func assertion(t *testing.T, a *webauthntest.Authenticator, challenge string, handle []byte) []byte {
	t.Helper()
	b, err := a.AssertionResponse(challenge, handle)
	if err != nil {
		t.Fatalf("assertion: %v", err)
	}
	return b
}

const (
	testRPID   = "ephera.test"
	testOrigin = "https://ephera.test"
)

type testUser struct {
	handle []byte
	creds  []webauthn.Credential
}

func (u *testUser) WebAuthnID() []byte                         { return u.handle }
func (u *testUser) WebAuthnName() string                       { return "user:demo-self:GHS" }
func (u *testUser) WebAuthnDisplayName() string                { return "Demo" }
func (u *testUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

func service(t *testing.T) *Service {
	t.Helper()
	s, err := New(testRPID, "EPHERA", []string{testOrigin})
	if err != nil {
		t.Fatalf("service: %v", err)
	}
	return s
}

func binding() authgrant.Binding {
	return authgrant.Binding{
		FromExternalRef: "user:demo-self:GHS",
		ToExternalRef:   "user:ama:GHS",
		AmountMinor:     25_000,
		FeeMinor:        50,
		Currency:        "GHS",
		TransferID:      "tx_passkey_1",
	}
}

// register runs a full registration ceremony and returns the stored credential.
func register(t *testing.T, s *Service, u *testUser, a *webauthntest.Authenticator) *webauthn.Credential {
	t.Helper()
	opts, sess, err := s.BeginRegistration(u)
	if err != nil {
		t.Fatalf("begin registration: %v", err)
	}
	body := a.RegistrationResponse(opts.Response.Challenge.String())
	cred, err := s.FinishRegistration(u, *sess, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("finish registration: %v", err)
	}
	u.creds = append(u.creds, *cred)
	return cred
}

func TestRegistrationAndAuthorisation(t *testing.T) {
	s := service(t)
	u := &testUser{handle: []byte("handle-0000000000000000000000001")}
	a := newAuthenticator(t, testRPID, testOrigin)
	register(t, s, u, a)

	b := binding()
	opts, sess, err := s.BeginAuthorisation(u, b)
	if err != nil {
		t.Fatalf("begin authorisation: %v", err)
	}

	// The challenge the device is asked to sign is the transaction digest, not
	// an opaque random value.
	digest, _ := hex.DecodeString(b.Digest())
	if !bytes.Equal(opts.Response.Challenge, digest) {
		t.Fatal("challenge is not the transaction binding digest")
	}

	body := assertion(t, a, opts.Response.Challenge.String(), u.handle)
	if _, err := s.FinishAuthorisation(u, *sess, b, bytes.NewReader(body)); err != nil {
		t.Fatalf("finish authorisation: %v", err)
	}
}

// The defining property of the design: a device signature obtained for one
// transfer cannot authorise a different one.
func TestAssertionCannotBeRepointed(t *testing.T) {
	s := service(t)
	u := &testUser{handle: []byte("handle-0000000000000000000000002")}
	a := newAuthenticator(t, testRPID, testOrigin)
	register(t, s, u, a)

	agreed := binding()
	opts, sess, err := s.BeginAuthorisation(u, agreed)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	body := assertion(t, a, opts.Response.Challenge.String(), u.handle)

	tampered := map[string]func(*authgrant.Binding){
		"amount inflated":   func(b *authgrant.Binding) { b.AmountMinor = 900_000 },
		"recipient changed": func(b *authgrant.Binding) { b.ToExternalRef = "user:attacker:GHS" },
		"fee raised":        func(b *authgrant.Binding) { b.FeeMinor = 5_000 },
		"currency changed":  func(b *authgrant.Binding) { b.Currency = "GBP" },
	}
	for name, mutate := range tampered {
		t.Run(name, func(t *testing.T) {
			other := binding()
			mutate(&other)
			_, err := s.FinishAuthorisation(u, *sess, other, bytes.NewReader(body))
			if !errors.Is(err, ErrBindingMismatch) {
				t.Fatalf("expected ErrBindingMismatch, got %v", err)
			}
		})
	}
}

// A signature from any key other than the registered credential must fail,
// even when it claims the right credential id.
func TestForgedAssertionRejected(t *testing.T) {
	s := service(t)
	u := &testUser{handle: []byte("handle-0000000000000000000000003")}
	a := newAuthenticator(t, testRPID, testOrigin)
	register(t, s, u, a)

	b := binding()
	opts, sess, err := s.BeginAuthorisation(u, b)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	body, err := a.ForgedAssertionResponse(opts.Response.Challenge.String(), u.handle)
	if err != nil {
		t.Fatalf("forge: %v", err)
	}
	if _, err := s.FinishAuthorisation(u, *sess, b, bytes.NewReader(body)); err == nil {
		t.Fatal("assertion signed by an unknown key was accepted")
	}
}

// An assertion produced for a different relying party or origin must not be
// accepted here.
func TestWrongOriginRejected(t *testing.T) {
	s := service(t)
	u := &testUser{handle: []byte("handle-0000000000000000000000004")}
	a := newAuthenticator(t, testRPID, testOrigin)
	register(t, s, u, a)

	b := binding()
	opts, sess, err := s.BeginAuthorisation(u, b)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}

	evil := newAuthenticator(t, testRPID, "https://phishing.example")
	evil.SetKeyAndCredential(a.Key(), a.CredentialID())
	body := assertion(t, evil, opts.Response.Challenge.String(), u.handle)

	if _, err := s.FinishAuthorisation(u, *sess, b, bytes.NewReader(body)); err == nil {
		t.Fatal("assertion from a different origin was accepted")
	}
}

// A subject with no registered passkey cannot start an authorisation ceremony.
// There is no fallback to a weaker method.
func TestNoCredentialRefused(t *testing.T) {
	s := service(t)
	u := &testUser{handle: []byte("handle-0000000000000000000000005")}
	if _, _, err := s.BeginAuthorisation(u, binding()); !errors.Is(err, ErrNoCredential) {
		t.Fatalf("expected ErrNoCredential, got %v", err)
	}
}
