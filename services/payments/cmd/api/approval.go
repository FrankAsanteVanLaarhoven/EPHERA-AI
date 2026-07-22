package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"
)

// The prepare-approval token proves a transfer went through prepare, where
// compliance is consulted, before it is submitted.
//
// Compliance is checked at prepare — tier, limits, screening — but the submit
// path only checked the kill switch and the presence of a grant. A client could
// therefore skip prepare entirely: choose its own transfer id, obtain a grant
// bound to it, and POST the transfer directly, moving money with no compliance
// decision ever taken. This closes that gap without giving payments a database:
// prepare returns a token that is an HMAC over the transfer's identity, and
// submit refuses anything without a matching one.
//
// Compliance is not re-run at submit on purpose: Decide records the decision and
// consumes the limit, so running it twice would double-count. The token carries
// the fact that an approved decision happened, not a second decision.

// loadPrepareSecret reads the shared secret used to sign approval tokens. If it
// is unset it generates an ephemeral one and says so: prepares and submits made
// by the same running instance still work, but a restart invalidates in-flight
// prepares, which the five-minute grant lifetime already bounds. A multi-instance
// deployment MUST set PAYMENTS_PREPARE_SECRET so any instance can verify a token
// another issued.
func loadPrepareSecret() []byte {
	if s := os.Getenv("PAYMENTS_PREPARE_SECRET"); s != "" {
		return []byte(s)
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		log.Fatalf("prepare secret: %v", err)
	}
	log.Printf("WARNING: PAYMENTS_PREPARE_SECRET is not set; using an ephemeral secret. " +
		"Prepares do not survive a restart, and a multi-instance deployment will reject " +
		"tokens issued by another instance.")
	return buf
}

// approvalToken binds the token to the identity of the transfer, so it cannot be
// moved to a different amount, payer or currency. The transfer id, which the
// grant also binds, ties it to this specific transfer.
func approvalToken(secret []byte, transferID, fromExternalRef string, amountMinor int64, currency string) string {
	mac := hmac.New(sha256.New, secret)
	fmt.Fprintf(mac, "%s|%s|%d|%s", transferID, fromExternalRef, amountMinor, currency)
	return hex.EncodeToString(mac.Sum(nil))
}

// validApprovalToken checks a presented token in constant time.
func validApprovalToken(secret []byte, presented, transferID, fromExternalRef string, amountMinor int64, currency string) bool {
	want := approvalToken(secret, transferID, fromExternalRef, amountMinor, currency)
	return hmac.Equal([]byte(presented), []byte(want))
}
