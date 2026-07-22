package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/FrankAsanteVanLaarhoven/boundedauth"
	"github.com/jackc/pgx/v5"
)

// The ledger as an implementation of the bounded-authority contract.
//
// The contract was extracted from this service, which makes it easy to assume
// the two still agree. They agree only if the same statement is exercised by
// both, so the consuming INSERT lives in one place: CaptureTransfer calls it
// on the transaction that carries the postings, and the adapter below calls it
// on a transaction it opens for a caller's effect. The conformance suite runs
// against the adapter and therefore against the statement that posts money.
//
// What that demonstrates: the ledger's single-use mechanism satisfies a
// contract defined without reference to it, checked by a suite that has been
// shown to fail stores which do not.
//
// What it does not demonstrate: CaptureTransfer does not route through
// Consume. It opens its own transaction, because it does considerably more
// than one effect — holds, postings, fee splits, evidence and a receipt. The
// shared statement is what ties them together, not a shared control flow.

// grantConsumption is the ledger's record of a spent authorisation.
type grantConsumption struct {
	JTI            string
	Subject        string
	Method         string
	BindingDigest  string
	TransferID     string
	JournalEntryID any // nil where the effect is not a posting
	IssuedAt       int64
	ExpiresAt      int64
}

// consumeGrant records the grant as spent. It must be called on the same
// transaction as the effect the grant authorises; that is the whole guarantee,
// and it is why this takes a pgx.Tx rather than a pool.
func consumeGrant(ctx context.Context, tx pgx.Tx, c grantConsumption) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO authorisation_grants
			(jti, subject, method, binding_digest, transfer_id, journal_entry_id, issued_at, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6, to_timestamp($7), to_timestamp($8))
	`, c.JTI, c.Subject, c.Method, c.BindingDigest, c.TransferID, c.JournalEntryID,
		c.IssuedAt, c.ExpiresAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrGrantAlreadyUsed
		}
		return err
	}
	return nil
}

type authorityTxKey struct{}

// AuthorityTx returns the transaction the current effect is running on. Host
// code inside an effect must use this rather than the pool: a write on another
// connection commits independently of the credential being spent.
func AuthorityTx(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(authorityTxKey{}).(pgx.Tx)
	return tx, ok
}

// AuthorityStore adapts the ledger to boundedauth.Store.
type AuthorityStore struct{ s *Store }

// Authority exposes the ledger's single-use mechanism under the general
// contract, so it can be conformance-tested and so other services in this
// platform can spend authority atomically with their own effects.
func (s *Store) Authority() *AuthorityStore { return &AuthorityStore{s: s} }

func (a *AuthorityStore) Consume(ctx context.Context, rec boundedauth.Consumption, effect func(context.Context) error) error {
	tx, err := a.s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("authority: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	// The credential's validity window is deliberately not carried by the
	// general contract: it was enforced at verification, and retaining it after
	// the fact would be retaining part of the credential. The consumption time
	// is recorded for all three columns, which is what a spent credential's
	// window amounts to.
	at := rec.ConsumedAt.Unix()
	if err := consumeGrant(ctx, tx, grantConsumption{
		JTI: rec.ID, Subject: rec.Subject, Method: string(rec.Method),
		BindingDigest: rec.Binding, TransferID: rec.Reference,
		JournalEntryID: nil, IssuedAt: at, ExpiresAt: at,
	}); err != nil {
		if errors.Is(err, ErrGrantAlreadyUsed) {
			return boundedauth.ErrAlreadyConsumed
		}
		return err
	}

	if err := effect(context.WithValue(ctx, authorityTxKey{}, tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
