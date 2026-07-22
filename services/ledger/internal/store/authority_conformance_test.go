package store

import (
	"context"
	"testing"

	"github.com/FrankAsanteVanLaarhoven/boundedauth"
	"github.com/FrankAsanteVanLaarhoven/boundedauth/conformance"
)

// The ledger is held to the bounded-authority conformance suite.
//
// This service is where the idea came from, which is exactly why the check
// matters: an origin implementation is the one most likely to be assumed
// correct and least likely to be tested against the contract it inspired. The
// suite was written without reference to this code and has been demonstrated
// to fail stores that do not satisfy it.
//
// It exercises consumeGrant, the same statement CaptureTransfer uses to post
// money, so a change that weakened single use in the money path would fail
// here.
func TestLedgerSatisfiesBoundedAuthorityContract(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	if _, err := st.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS boundedauth_conformance_effects (
			key TEXT PRIMARY KEY, value BYTEA NOT NULL)`); err != nil {
		t.Fatalf("effects table: %v", err)
	}

	conformance.Run(t, conformance.Harness{
		NewStore: func(tb conformance.TB) boundedauth.Store {
			if _, err := st.pool.Exec(ctx,
				`TRUNCATE authorisation_grants, boundedauth_conformance_effects`); err != nil {
				tb.Fatalf("reset: %v", err)
			}
			return st.Authority()
		},
		Write: func(ctx context.Context, key string) error {
			tx, ok := AuthorityTx(ctx)
			if !ok {
				t.Fatal("no transaction on the effect context")
			}
			_, err := tx.Exec(ctx,
				`INSERT INTO boundedauth_conformance_effects (key, value) VALUES ($1,$2)`,
				key, []byte("effect"))
			return err
		},
		Committed: func(tb conformance.TB, key string) bool {
			var n int
			if err := st.pool.QueryRow(ctx,
				`SELECT count(*) FROM boundedauth_conformance_effects WHERE key=$1`, key).Scan(&n); err != nil {
				tb.Fatalf("committed: %v", err)
			}
			return n == 1
		},
		Consumed: func(tb conformance.TB, id string) bool {
			var n int
			if err := st.pool.QueryRow(ctx,
				`SELECT count(*) FROM authorisation_grants WHERE jti=$1`, id).Scan(&n); err != nil {
				tb.Fatalf("consumed: %v", err)
			}
			return n == 1
		},
	})
}
