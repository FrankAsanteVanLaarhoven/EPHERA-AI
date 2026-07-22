package store

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("CONTROL_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("CONTROL_TEST_DATABASE_URL not set; skipping store tests")
	}
	st, err := New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(st.Close)
	return st
}

func auditCountFor(t *testing.T, st *Store, target string) int {
	t.Helper()
	var n int
	if err := st.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM audit_log WHERE target = $1`, target).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// Concurrent appends must all be recorded. The append reads the chain tip and
// inserts the next link in a serialisable transaction, so concurrent writers
// conflict; before the retry was added, the losers failed with 40001 and, since
// the callers discarded the error, those audit entries were silently dropped.
// This fires many at once and asserts every one landed and the chain stayed
// intact.
func TestConcurrentAppendsAreNeverDropped(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	// A unique target per run, so audit rows written concurrently by other test
	// packages against the same database are not counted here.
	target := fmt.Sprintf("contention-%d", time.Now().UnixNano())

	const n = 30
	var wg sync.WaitGroup
	var mu sync.Mutex
	var failures []error
	start := make(chan struct{})
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func(i int) {
			defer wg.Done()
			<-start
			if _, err := st.Append(ctx, AuditEntry{
				Actor: "concurrent.test", ActorMethod: "test", SessionID: "s",
				Action: "audit.contention", Target: target, Outcome: "allowed",
				Detail: map[string]any{"i": i},
			}); err != nil {
				mu.Lock()
				failures = append(failures, err)
				mu.Unlock()
			}
		}(i)
	}
	close(start)
	wg.Wait()

	if len(failures) > 0 {
		t.Fatalf("%d of %d concurrent appends failed (audit would be dropped): %v",
			len(failures), n, failures[0])
	}
	if got := auditCountFor(t, st, target); got != n {
		t.Fatalf("expected %d audit rows for this run, got %d — entries were dropped under contention", n, got)
	}

	// The whole chain must still verify end to end after concurrent appends,
	// including any rows other packages appended in parallel — every append goes
	// through the same advisory-locked path, so the chain stays a single line.
	rows, err := st.pool.Query(ctx, `SELECT prev_hash, entry_hash FROM audit_log ORDER BY seq`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	prev := GenesisHash
	links := 0
	for rows.Next() {
		var p, h string
		if err := rows.Scan(&p, &h); err != nil {
			t.Fatal(err)
		}
		if p != prev {
			t.Fatalf("chain broken at link %d: prev_hash %s != expected %s", links, p, prev)
		}
		prev = h
		links++
	}
}
