package main

import "testing"

func TestApprovalToken(t *testing.T) {
	secret := []byte("test-secret")
	tok := approvalToken(secret, "tx_1", "user:alice", 50_000, "GHS")

	// The token prepare issued verifies.
	if !validApprovalToken(secret, tok, "tx_1", "user:alice", 50_000, "GHS") {
		t.Fatal("a freshly issued approval token did not verify")
	}

	// A submit that skipped prepare has no token.
	if validApprovalToken(secret, "", "tx_1", "user:alice", 50_000, "GHS") {
		t.Fatal("an empty token was accepted — a client could skip prepare")
	}

	// The token is bound to the transfer's identity: it cannot be moved to a
	// different amount, payer, currency or transfer id.
	for name, args := range map[string][4]any{
		"amount":   {"tx_1", "user:alice", int64(999_999), "GHS"},
		"payer":    {"tx_1", "user:mallory", int64(50_000), "GHS"},
		"currency": {"tx_1", "user:alice", int64(50_000), "NGN"},
		"transfer": {"tx_2", "user:alice", int64(50_000), "GHS"},
	} {
		if validApprovalToken(secret, tok, args[0].(string), args[1].(string), args[2].(int64), args[3].(string)) {
			t.Fatalf("the token verified for a changed %s", name)
		}
	}

	// A token minted under a different secret does not verify.
	other := approvalToken([]byte("other-secret"), "tx_1", "user:alice", 50_000, "GHS")
	if validApprovalToken(secret, other, "tx_1", "user:alice", 50_000, "GHS") {
		t.Fatal("a token from a different secret verified")
	}
}
