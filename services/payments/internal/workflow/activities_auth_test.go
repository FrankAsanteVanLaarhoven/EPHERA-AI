package workflow

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/ephera/authgrant"
)

func transferInput() DomesticTransferInput {
	return DomesticTransferInput{
		FromExternalRef: "user:alice:GHS", ToExternalRef: "user:bob:GHS",
		AmountMinor: 50_000, FeeMinor: 250, Currency: "GHS",
		TransferID: "tx_auth_1",
	}
}

func bindingFor(in DomesticTransferInput) authgrant.Binding {
	return authgrant.Binding{
		FromExternalRef: in.FromExternalRef, ToExternalRef: in.ToExternalRef,
		AmountMinor: in.AmountMinor, FeeMinor: in.FeeMinor,
		Currency: in.Currency, TransferID: in.TransferID,
	}
}

// H1: the signature is verified before the rail. A grant with a correct binding
// but a forged signature must be refused by RequireAuthorisation — the activity
// the workflow runs before it places a hold or calls a rail — not left to be
// caught at capture, which happens after the irreversible payout.
func TestForgedGrantIsRefusedBeforeTheRail(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(nil)
	a := &Activities{authPublicKey: pub}
	in := transferInput()
	now := time.Now()

	// A genuine grant from the trusted issuer authorises.
	good, err := authgrant.Mint(priv, authgrant.Payload{
		ID: "g1", Subject: in.FromExternalRef, Method: authgrant.MethodPasskey,
		Binding: bindingFor(in).Digest(), IssuedAt: now.Unix(), ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	in.AuthorisationRef = good
	if err := a.RequireAuthorisation(context.Background(), in); err != nil {
		t.Fatalf("a genuine grant was refused: %v", err)
	}

	// A grant with the CORRECT binding but a forged signature (a different key).
	_, attackerPriv, _ := ed25519.GenerateKey(nil)
	forged, _ := authgrant.Mint(attackerPriv, authgrant.Payload{
		ID: "g2", Subject: in.FromExternalRef, Method: authgrant.MethodPasskey,
		Binding: bindingFor(in).Digest(), IssuedAt: now.Unix(), ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})
	// Sanity: it is bound to this exact transfer, so a binding-only check would pass it.
	claimed, _ := authgrant.ParseUnverified(forged)
	if claimed.Binding != bindingFor(in).Digest() {
		t.Fatal("precondition: the forged grant should carry the correct binding")
	}
	in.AuthorisationRef = forged
	if err := a.RequireAuthorisation(context.Background(), in); err == nil {
		t.Fatal("a forged-signature grant passed the pre-rail check; it would have reached the rail")
	}
}

// A grant bound to a different transfer is refused (repointing), and the check
// fails closed when no key is configured.
func TestAuthorisationBindingAndFailClosed(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(nil)
	in := transferInput()
	now := time.Now()
	grant, _ := authgrant.Mint(priv, authgrant.Payload{
		ID: "g3", Subject: in.FromExternalRef, Method: authgrant.MethodPasskey,
		Binding: bindingFor(in).Digest(), IssuedAt: now.Unix(), ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})

	// No key configured -> fail closed.
	noKey := &Activities{}
	in.AuthorisationRef = grant
	if err := noKey.RequireAuthorisation(context.Background(), in); err == nil {
		t.Fatal("authorisation succeeded with no public key configured")
	}

	// Right key, but present the grant for a larger amount (repointing).
	a := &Activities{authPublicKey: pub}
	repointed := in
	repointed.AmountMinor = 500_000
	repointed.AuthorisationRef = grant
	if err := a.RequireAuthorisation(context.Background(), repointed); err == nil {
		t.Fatal("a grant was accepted for a larger amount than it authorised")
	}

	// A structurally broken token is refused.
	broken := in
	broken.AuthorisationRef = "not-a-grant." + base64.RawURLEncoding.EncodeToString([]byte("x"))
	if err := a.RequireAuthorisation(context.Background(), broken); err == nil || !strings.Contains(err.Error(), "not valid") {
		t.Fatalf("a malformed grant was not refused cleanly: %v", err)
	}
}
