package store

import (
	"context"
	"crypto/ed25519"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/ephera/authgrant"
	"github.com/google/uuid"
)

// Integration tests against a real Postgres with all migrations applied.
//
// Skipped unless LEDGER_TEST_DATABASE_URL is set, so `go test ./...` stays
// runnable without infrastructure. Continuous integration sets it and applies
// the migrations first.
//
// These cover the invariants that must hold in the database itself rather than
// in application code, because the ledger is the authority (ADR 0001) and a
// defect in any caller must not be able to corrupt it.

// testSigner is the identity service's key for the duration of a test. Each
// test gets a fresh pair, so a grant minted in one test cannot verify in
// another.
var testSigner ed25519.PrivateKey

func testStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("LEDGER_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("LEDGER_TEST_DATABASE_URL not set; skipping ledger integration tests")
	}
	st, err := New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(st.Close)

	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	testSigner = priv
	st.SetAuthorisationKey(pub)
	// The test harness mints sandbox-authenticator grants, so the test store is
	// a sandbox. Production ledgers leave this closed.
	st.AllowSandboxMethod(true)
	return st
}

// grantFor mints a grant bound to exactly the transfer described, the way the
// identity service would.
func grantFor(t *testing.T, req TransferRequest) string {
	t.Helper()
	now := time.Now()
	binding := authgrant.Binding{
		FromExternalRef: req.FromExternalRef,
		ToExternalRef:   req.ToExternalRef,
		AmountMinor:     req.AmountMinor,
		FeeMinor:        req.FeeMinor,
		Currency:        req.Currency,
		TransferID:      req.TransferID,
	}
	g, err := authgrant.Mint(testSigner, authgrant.Payload{
		ID:        "grant_" + uuid.NewString(),
		Subject:   req.FromExternalRef,
		Method:    authgrant.MethodSandboxAuthenticator,
		Binding:   binding.Digest(),
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint grant: %v", err)
	}
	return g
}

// authorised fills in a grant for a transfer request built by a test.
func authorised(t *testing.T, req TransferRequest) TransferRequest {
	t.Helper()
	req.AuthorisationRef = grantFor(t, req)
	return req
}

// openWallet creates an isolated funded wallet so tests do not depend on, or
// disturb, the sandbox seed accounts.
func openWallet(t *testing.T, st *Store, currency string, openingMinor int64) string {
	t.Helper()
	ctx := context.Background()
	ref := "test:" + uuid.NewString() + ":" + currency

	var acctID uuid.UUID
	err := st.pool.QueryRow(ctx, `
		INSERT INTO accounts (external_ref, owner_id, currency, account_type)
		VALUES ($1, gen_random_uuid(), $2, 'user_wallet')
		RETURNING id
	`, ref, currency).Scan(&acctID)
	if err != nil {
		t.Fatalf("open account: %v", err)
	}
	if _, err := st.pool.Exec(ctx, `
		INSERT INTO account_balances (account_id, currency, balance_minor, hold_minor)
		VALUES ($1, $2, 0, 0)
	`, acctID, currency); err != nil {
		t.Fatalf("open balance: %v", err)
	}
	if openingMinor == 0 {
		return ref
	}

	// Fund it the way the seed does: a balanced entry against system clearing.
	var clearingID uuid.UUID
	if err := st.pool.QueryRow(ctx,
		`SELECT id FROM accounts WHERE external_ref = $1`, "system:clearing:"+currency).Scan(&clearingID); err != nil {
		t.Fatalf("clearing account: %v", err)
	}
	tx, err := st.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	jeID := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO journal_entries (id, idempotency_key, transfer_id, description)
		VALUES ($1, $2, $3, 'test opening balance')
	`, jeID, "test_open_"+ref, "test_open"); err != nil {
		t.Fatalf("journal: %v", err)
	}
	if err := insertPosting(ctx, tx, jeID, clearingID, openingMinor, currency, "debit"); err != nil {
		t.Fatalf("posting: %v", err)
	}
	if err := insertPosting(ctx, tx, jeID, acctID, openingMinor, currency, "credit"); err != nil {
		t.Fatalf("posting: %v", err)
	}
	if err := adjustBalance(ctx, tx, clearingID, -openingMinor); err != nil {
		t.Fatalf("balance: %v", err)
	}
	if err := adjustBalance(ctx, tx, acctID, openingMinor); err != nil {
		t.Fatalf("balance: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit opening balance: %v", err)
	}
	return ref
}

func balanceOf(t *testing.T, st *Store, ref string) int64 {
	t.Helper()
	a, err := st.GetByExternalRef(context.Background(), ref)
	if err != nil {
		t.Fatalf("read %s: %v", ref, err)
	}
	return a.Balance
}

// D-03 regression. Reproduced against a live ledger on 2026-07-21: a negative
// amount inverted the posting direction, crediting the sender and debiting the
// recipient, with no hold and an arbitrary authorisation string.
func TestNegativeAmountCannotReverseTransfer(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	attacker := openWallet(t, st, "GHS", 0)
	victim := openWallet(t, st, "GHS", 50_000)

	_, err := st.CaptureTransfer(ctx, TransferRequest{
		FromExternalRef:  attacker,
		ToExternalRef:    victim,
		AmountMinor:      -80_000,
		Currency:         "GHS",
		TransferID:       "tx_" + uuid.NewString(),
		IdempotencyKey:   "idem_" + uuid.NewString(),
		AuthorisationRef: "aaaaaaaa",
	})
	if err == nil {
		t.Fatal("negative transfer was accepted")
	}
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected ErrInvalidRequest, got %v", err)
	}
	if got := balanceOf(t, st, attacker); got != 0 {
		t.Fatalf("attacker balance moved: %d", got)
	}
	if got := balanceOf(t, st, victim); got != 50_000 {
		t.Fatalf("victim balance moved: %d", got)
	}
}

// D-04 regression. The constraint in 001 was a tautology, so a customer wallet
// could be driven below zero. The floor is now a trigger that distinguishes
// customer accounts from system accounts.
func TestCustomerWalletCannotGoNegative(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	wallet := openWallet(t, st, "GHS", 1_000)
	var acctID uuid.UUID
	if err := st.pool.QueryRow(ctx,
		`SELECT id FROM accounts WHERE external_ref = $1`, wallet).Scan(&acctID); err != nil {
		t.Fatalf("lookup: %v", err)
	}

	// Direct write, bypassing every application-level check.
	_, err := st.pool.Exec(ctx,
		`UPDATE account_balances SET balance_minor = -1 WHERE account_id = $1`, acctID)
	if err == nil {
		t.Fatal("database accepted a negative customer balance")
	}
	if got := balanceOf(t, st, wallet); got != 1_000 {
		t.Fatalf("balance changed despite rejection: %d", got)
	}
}

// System accounts carry the platform's own position and must still be allowed
// to go negative -- the sandbox opening balance depends on it.
func TestSystemAccountMayGoNegative(t *testing.T) {
	st := testStore(t)
	wallet := openWallet(t, st, "GHS", 25_000)
	if got := balanceOf(t, st, wallet); got != 25_000 {
		t.Fatalf("opening balance not applied: %d", got)
	}
	if got := balanceOf(t, st, "system:clearing:GHS"); got >= 0 {
		t.Fatalf("expected clearing account to be negative after funding, got %d", got)
	}
}

// D-05 regression. Reproduced on 2026-07-21: a one-legged journal entry was
// accepted. Balance is now enforced by a deferred constraint trigger.
func TestUnbalancedJournalEntryRejected(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	wallet := openWallet(t, st, "GHS", 0)
	var acctID uuid.UUID
	if err := st.pool.QueryRow(ctx,
		`SELECT id FROM accounts WHERE external_ref = $1`, wallet).Scan(&acctID); err != nil {
		t.Fatalf("lookup: %v", err)
	}

	tx, err := st.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	jeID := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO journal_entries (id, idempotency_key, transfer_id, description)
		VALUES ($1, $2, 'tx_unbalanced', 'one leg only')
	`, jeID, "idem_"+uuid.NewString()); err != nil {
		t.Fatalf("journal: %v", err)
	}
	if err := insertPosting(ctx, tx, jeID, acctID, 999_999, "GHS", "credit"); err != nil {
		t.Fatalf("posting: %v", err)
	}
	if err := tx.Commit(ctx); err == nil {
		t.Fatal("database accepted an unbalanced journal entry")
	}
}

// A journal entry with no postings at all never fires the postings trigger, so
// it is checked from the entry side.
func TestJournalEntryWithoutPostingsRejected(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	tx, err := st.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO journal_entries (id, idempotency_key, transfer_id, description)
		VALUES (gen_random_uuid(), $1, 'tx_empty', 'no postings')
	`, "idem_"+uuid.NewString()); err != nil {
		t.Fatalf("journal: %v", err)
	}
	if err := tx.Commit(ctx); err == nil {
		t.Fatal("database accepted a journal entry with no postings")
	}
}

// Postings carry magnitude; the sign belongs to direction.
func TestNegativePostingRejected(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	wallet := openWallet(t, st, "GHS", 0)
	var acctID uuid.UUID
	if err := st.pool.QueryRow(ctx,
		`SELECT id FROM accounts WHERE external_ref = $1`, wallet).Scan(&acctID); err != nil {
		t.Fatalf("lookup: %v", err)
	}

	tx, err := st.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	jeID := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO journal_entries (id, idempotency_key, transfer_id, description)
		VALUES ($1, $2, 'tx_neg', 'negative posting')
	`, jeID, "idem_"+uuid.NewString()); err != nil {
		t.Fatalf("journal: %v", err)
	}
	if err := insertPosting(ctx, tx, jeID, acctID, -500, "GHS", "credit"); err == nil {
		t.Fatal("database accepted a negative posting amount")
	}
}

// The happy path must still work, and must post a balanced entry.
func TestTransferPostsBalancedEntry(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)
	idem := "idem_" + uuid.NewString()

	req := authorised(t, TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     30_000,
		FeeMinor:        50,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  idem,
	})

	jeID, err := st.CaptureTransfer(ctx, req)
	if err != nil {
		t.Fatalf("transfer: %v", err)
	}

	if got := balanceOf(t, st, from); got != 100_000-30_000-50 {
		t.Fatalf("sender balance %d", got)
	}
	if got := balanceOf(t, st, to); got != 30_000 {
		t.Fatalf("recipient balance %d", got)
	}

	var net int64
	if err := st.pool.QueryRow(ctx, `
		SELECT sum(CASE WHEN direction = 'credit' THEN amount_minor ELSE -amount_minor END)
		FROM postings WHERE journal_entry_id = $1
	`, jeID).Scan(&net); err != nil {
		t.Fatalf("sum postings: %v", err)
	}
	if net != 0 {
		t.Fatalf("journal entry not balanced: net %d", net)
	}

	// Replaying the same idempotency key must return the same entry, not a
	// second debit.
	again, err := st.CaptureTransfer(ctx, req)
	if err != nil {
		t.Fatalf("replay: %v", err)
	}
	if again != jeID {
		t.Fatalf("replay created a new entry: %s vs %s", again, jeID)
	}
	if got := balanceOf(t, st, from); got != 100_000-30_000-50 {
		t.Fatalf("replay moved money: %d", got)
	}
}

// Insufficient funds must be refused before any posting is written.
func TestInsufficientFundsRefused(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 1_000)
	to := openWallet(t, st, "GHS", 0)

	_, err := st.CaptureTransfer(ctx, authorised(t, TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     5_000,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  "idem_" + uuid.NewString(),
	}))
	if !errors.Is(err, ErrInsufficientFunds) {
		t.Fatalf("expected ErrInsufficientFunds, got %v", err)
	}
	if got := balanceOf(t, st, from); got != 1_000 {
		t.Fatalf("sender balance moved: %d", got)
	}
}

// D-01. The ledger accepted any non-empty string as authorisation. Reproduced
// against a live ledger on 2026-07-21 with the string "aaaaaaaa". It must now
// refuse anything that is not a grant signed by the identity service.
func TestUnsignedAuthorisationRefused(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)

	fabricated := []string{
		"aaaaaaaa",
		"passkey_admin_console_demo",
		"passkey_pwa_1784617797470",
		"passkey_mock_tx_1_25000_1784617797470",
		"ref_placeholder",
	}
	for _, ref := range fabricated {
		_, err := st.CaptureTransfer(ctx, TransferRequest{
			FromExternalRef:  from,
			ToExternalRef:    to,
			AmountMinor:      1_000,
			Currency:         "GHS",
			TransferID:       "tx_" + uuid.NewString(),
			IdempotencyKey:   "idem_" + uuid.NewString(),
			AuthorisationRef: ref,
		})
		if !errors.Is(err, ErrUnauthorised) {
			t.Fatalf("fabricated reference %q was accepted: %v", ref, err)
		}
	}
	if got := balanceOf(t, st, from); got != 100_000 {
		t.Fatalf("balance moved: %d", got)
	}
}

// A grant authorises one transaction. Presenting it for a different amount,
// recipient or sender must fail even though the signature is genuine.
func TestGrantCannotBeRepointed(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)
	attacker := openWallet(t, st, "GHS", 0)

	agreed := TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     1_000,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  "idem_" + uuid.NewString(),
	}
	grant := grantFor(t, agreed)

	// Same grant, larger amount.
	inflated := agreed
	inflated.AmountMinor = 90_000
	inflated.AuthorisationRef = grant
	if _, err := st.CaptureTransfer(ctx, inflated); !errors.Is(err, ErrUnauthorised) {
		t.Fatalf("inflated amount accepted: %v", err)
	}

	// Same grant, different recipient.
	redirected := agreed
	redirected.ToExternalRef = attacker
	redirected.AuthorisationRef = grant
	if _, err := st.CaptureTransfer(ctx, redirected); !errors.Is(err, ErrUnauthorised) {
		t.Fatalf("redirected recipient accepted: %v", err)
	}

	if got := balanceOf(t, st, from); got != 100_000 {
		t.Fatalf("balance moved: %d", got)
	}
	if got := balanceOf(t, st, attacker); got != 0 {
		t.Fatalf("attacker received funds: %d", got)
	}
}

// Single use. A genuine grant, replayed under a fresh idempotency key, must be
// refused -- otherwise one authorisation drains an account.
func TestGrantIsSingleUse(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)

	req := authorised(t, TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     10_000,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  "idem_" + uuid.NewString(),
	})
	if _, err := st.CaptureTransfer(ctx, req); err != nil {
		t.Fatalf("first use: %v", err)
	}

	replay := req
	replay.IdempotencyKey = "idem_" + uuid.NewString()
	if _, err := st.CaptureTransfer(ctx, replay); !errors.Is(err, ErrGrantAlreadyUsed) {
		t.Fatalf("expected ErrGrantAlreadyUsed, got %v", err)
	}

	if got := balanceOf(t, st, from); got != 90_000 {
		t.Fatalf("replay moved money: %d", got)
	}
	if got := balanceOf(t, st, to); got != 10_000 {
		t.Fatalf("recipient credited twice: %d", got)
	}
}

// A grant signed by anyone other than the configured issuer key is worthless.
func TestGrantFromAnotherSignerRefused(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)

	req := TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     1_000,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  "idem_" + uuid.NewString(),
	}

	// An attacker with their own key mints a perfectly well-formed grant.
	_, rogue, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	binding := authgrant.Binding{
		FromExternalRef: req.FromExternalRef,
		ToExternalRef:   req.ToExternalRef,
		AmountMinor:     req.AmountMinor,
		Currency:        req.Currency,
		TransferID:      req.TransferID,
	}
	forged, err := authgrant.Mint(rogue, authgrant.Payload{
		ID:        "grant_" + uuid.NewString(),
		Subject:   req.FromExternalRef,
		Method:    authgrant.MethodPasskey,
		Binding:   binding.Digest(),
		IssuedAt:  time.Now().Unix(),
		ExpiresAt: time.Now().Add(time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	req.AuthorisationRef = forged

	if _, err := st.CaptureTransfer(ctx, req); !errors.Is(err, ErrUnauthorised) {
		t.Fatalf("grant from an unknown signer accepted: %v", err)
	}
	if got := balanceOf(t, st, from); got != 100_000 {
		t.Fatalf("balance moved: %d", got)
	}
}

// With no public key the ledger cannot tell a real grant from a forged one, so
// it must refuse every transfer rather than fall back to accepting a string.
func TestLedgerFailsClosedWithoutAKey(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)
	req := authorised(t, TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     1_000,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  "idem_" + uuid.NewString(),
	})

	st.SetAuthorisationKey(nil)
	if _, err := st.CaptureTransfer(ctx, req); !errors.Is(err, ErrGrantNotVerifiable) {
		t.Fatalf("expected ErrGrantNotVerifiable, got %v", err)
	}
	if got := balanceOf(t, st, from); got != 100_000 {
		t.Fatalf("balance moved: %d", got)
	}
}

// The authorisation method travels with the grant into evidence, so a sandbox
// authorisation can never be mistaken for a verified passkey downstream.
func TestEvidenceRecordsTheAuthorisationMethod(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 50_000)
	to := openWallet(t, st, "GHS", 0)
	req := authorised(t, TransferRequest{
		FromExternalRef: from,
		ToExternalRef:   to,
		AmountMinor:     2_500,
		Currency:        "GHS",
		TransferID:      "tx_" + uuid.NewString(),
		IdempotencyKey:  "idem_" + uuid.NewString(),
	})
	if _, err := st.CaptureTransfer(ctx, req); err != nil {
		t.Fatalf("transfer: %v", err)
	}

	var method string
	var jti *string
	if err := st.pool.QueryRow(ctx, `
		SELECT method, grant_jti FROM authorisation_evidence WHERE transfer_id = $1
	`, req.TransferID).Scan(&method, &jti); err != nil {
		t.Fatalf("read evidence: %v", err)
	}
	if method != string(authgrant.MethodSandboxAuthenticator) {
		t.Fatalf("evidence claims method %q; the grant said %q",
			method, authgrant.MethodSandboxAuthenticator)
	}
	if jti == nil || *jti == "" {
		t.Fatal("evidence does not reference the grant that authorised it")
	}
}

// --- receipts ---

// A receipt is written in the same transaction as the postings, so it cannot
// describe a payment the ledger did not make.
func TestReceiptIsIssuedWithThePosting(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)
	req := authorised(t, TransferRequest{
		FromExternalRef: from, ToExternalRef: to,
		AmountMinor: 30_000, FeeMinor: 50, Currency: "GHS",
		TransferID:     "tx_" + uuid.NewString(),
		IdempotencyKey: "idem_" + uuid.NewString(),
		Description:    "Send to Ama",
	})
	jeID, err := st.CaptureTransfer(ctx, req)
	if err != nil {
		t.Fatalf("transfer: %v", err)
	}

	rec, err := st.ReceiptForTransfer(ctx, req.TransferID)
	if err != nil {
		t.Fatalf("receipt: %v", err)
	}
	// Every field must match what was posted, not what a caller intended.
	if rec.JournalEntryID != jeID {
		t.Fatalf("receipt cites journal entry %q, posting was %q", rec.JournalEntryID, jeID)
	}
	if rec.AmountMinor != 30_000 || rec.FeeMinor != 50 {
		t.Fatalf("receipt says %d + %d", rec.AmountMinor, rec.FeeMinor)
	}
	// The authorisation method travels from the grant, so a sandbox
	// authorisation cannot be presented to a customer as a passkey one.
	if rec.AuthorisationMethod != "sandbox_authenticator" {
		t.Fatalf("receipt claims method %q", rec.AuthorisationMethod)
	}
	if rec.GrantID == "" {
		t.Fatal("receipt does not cite the grant that authorised it")
	}
}

// A refused payment issues no receipt. A receipt for a payment that never
// happened is worse than none.
func TestNoReceiptForARefusedPayment(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 1_000)
	to := openWallet(t, st, "GHS", 0)
	transferID := "tx_" + uuid.NewString()
	_, err := st.CaptureTransfer(ctx, authorised(t, TransferRequest{
		FromExternalRef: from, ToExternalRef: to,
		AmountMinor: 5_000, Currency: "GHS", // more than the balance
		TransferID: transferID, IdempotencyKey: "idem_" + uuid.NewString(),
	}))
	if !errors.Is(err, ErrInsufficientFunds) {
		t.Fatalf("expected insufficient funds, got %v", err)
	}
	if _, err := st.ReceiptForTransfer(ctx, transferID); !errors.Is(err, ErrNotFound) {
		t.Fatal("a refused payment produced a receipt")
	}
}

func TestReceiptVerifiesAgainstItsOwnHash(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 60_000)
	to := openWallet(t, st, "GHS", 0)
	req := authorised(t, TransferRequest{
		FromExternalRef: from, ToExternalRef: to, AmountMinor: 5_000, Currency: "GHS",
		TransferID: "tx_" + uuid.NewString(), IdempotencyKey: "idem_" + uuid.NewString(),
	})
	if _, err := st.CaptureTransfer(ctx, req); err != nil {
		t.Fatalf("transfer: %v", err)
	}
	rec, _ := st.ReceiptForTransfer(ctx, req.TransferID)

	_, intact, err := st.VerifyReceipt(ctx, rec.ID)
	if err != nil || !intact {
		t.Fatalf("a freshly issued receipt did not verify (intact=%v err=%v)", intact, err)
	}
}

// Receipts are evidence: the database refuses to change or remove one.
func TestReceiptsAreImmutable(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 60_000)
	to := openWallet(t, st, "GHS", 0)
	req := authorised(t, TransferRequest{
		FromExternalRef: from, ToExternalRef: to, AmountMinor: 5_000, Currency: "GHS",
		TransferID: "tx_" + uuid.NewString(), IdempotencyKey: "idem_" + uuid.NewString(),
	})
	if _, err := st.CaptureTransfer(ctx, req); err != nil {
		t.Fatalf("transfer: %v", err)
	}
	rec, _ := st.ReceiptForTransfer(ctx, req.TransferID)

	if _, err := st.pool.Exec(ctx,
		`UPDATE receipts SET amount_minor = 1 WHERE id = $1`, rec.ID); err == nil {
		t.Fatal("a receipt was altered")
	}
	if _, err := st.pool.Exec(ctx, `DELETE FROM receipts WHERE id = $1`, rec.ID); err == nil {
		t.Fatal("a receipt was deleted")
	}
}

// A grant minted with the sandbox authenticator must be refused by a ledger
// that has not opted in — the money path fails closed on a sandbox
// authorisation. authgrant.Verify does not check the method, so the ledger must.
func TestSandboxAuthenticatorGrantRefusedByDefault(t *testing.T) {
	st := testStore(t)
	st.AllowSandboxMethod(false) // a production-shaped ledger
	ctx := context.Background()

	from := openWallet(t, st, "GHS", 100_000)
	to := openWallet(t, st, "GHS", 0)
	req := authorised(t, TransferRequest{ // authorised() mints a sandbox-method grant
		FromExternalRef: from, ToExternalRef: to, AmountMinor: 10_000, Currency: "GHS",
		TransferID: "tx_" + uuid.NewString(), IdempotencyKey: "idem_" + uuid.NewString(),
	})
	_, err := st.CaptureTransfer(ctx, req)
	if !errors.Is(err, ErrUnauthorised) {
		t.Fatalf("a sandbox-authenticator grant posted money on a closed ledger: %v", err)
	}

	// The same ledger, opted in, accepts it — so the refusal is the gate, not a
	// broken grant.
	st.AllowSandboxMethod(true)
	if _, err := st.CaptureTransfer(ctx, req); err != nil {
		t.Fatalf("sandbox grant refused even after opting in: %v", err)
	}
}
