package store

import (
	"context"
	"errors"
	"os"
	"testing"

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
	return st
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

	jeID, err := st.CaptureTransfer(ctx, TransferRequest{
		FromExternalRef:  from,
		ToExternalRef:    to,
		AmountMinor:      30_000,
		FeeMinor:         50,
		Currency:         "GHS",
		TransferID:       "tx_" + uuid.NewString(),
		IdempotencyKey:   idem,
		AuthorisationRef: "ref_placeholder",
	})
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
	again, err := st.CaptureTransfer(ctx, TransferRequest{
		FromExternalRef:  from,
		ToExternalRef:    to,
		AmountMinor:      30_000,
		FeeMinor:         50,
		Currency:         "GHS",
		TransferID:       "tx_" + uuid.NewString(),
		IdempotencyKey:   idem,
		AuthorisationRef: "ref_placeholder",
	})
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

	_, err := st.CaptureTransfer(ctx, TransferRequest{
		FromExternalRef:  from,
		ToExternalRef:    to,
		AmountMinor:      5_000,
		Currency:         "GHS",
		TransferID:       "tx_" + uuid.NewString(),
		IdempotencyKey:   "idem_" + uuid.NewString(),
		AuthorisationRef: "ref_placeholder",
	})
	if !errors.Is(err, ErrInsufficientFunds) {
		t.Fatalf("expected ErrInsufficientFunds, got %v", err)
	}
	if got := balanceOf(t, st, from); got != 1_000 {
		t.Fatalf("sender balance moved: %d", got)
	}
}
