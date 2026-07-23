package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/ephera/compliance-risk/internal/detect"
)

// Persisting the rare-event reference distribution across restarts.
//
// The situation-awareness population is learned from what the platform has
// actually seen. Without persistence it is rebuilt from zero on every restart,
// and for the first hours after a deploy every value is unseen, everything looks
// rare, and ordinary customers trip the alarm. Warm-starting from a snapshot
// removes that cold-start window.
//
// This is entirely off the money path: the distribution informs advisory
// situation context (ADR 0004), never an allow/deny outcome. It is opt-in —
// nothing is written unless COMPLIANCE_AWARENESS_SNAPSHOT names a file.

// loadAwarenessPopulation warm-starts from a snapshot file if one is configured
// and trustworthy. A missing file is the normal first-run case; a corrupt or
// wrong-version file is refused and the service starts clean rather than compute
// rarity from a distribution it cannot trust.
func loadAwarenessPopulation(path string) *detect.Population {
	if path == "" {
		return detect.NewPopulation()
	}
	f, err := os.Open(path)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("awareness snapshot: cannot open %s (%v) — starting clean", path, err)
		}
		return detect.NewPopulation()
	}
	defer f.Close()

	pop, err := detect.ReadPopulation(f)
	if err != nil {
		log.Printf("awareness snapshot: refusing %s (%v) — starting clean", path, err)
		return detect.NewPopulation()
	}
	log.Printf("awareness snapshot: warm-started from %s (%d observations)", path, pop.Total())
	return pop
}

// writeAwarenessSnapshot writes the current distribution to path atomically:
// a temp file in the same directory, then a rename. A crash mid-write cannot
// leave a half-written snapshot that the next boot would have to refuse.
func writeAwarenessSnapshot(path string, a *detect.Awareness) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".awareness-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op once the rename has succeeded

	if err := json.NewEncoder(tmp).Encode(a.PopulationSnapshot()); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

// persistAwareness periodically snapshots the distribution and flushes once more
// on shutdown, so the most recent window of observations survives a restart. It
// is a no-op when no snapshot path is configured.
func persistAwareness(ctx context.Context, path string, a *detect.Awareness, interval time.Duration) {
	if path == "" {
		return
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			if err := writeAwarenessSnapshot(path, a); err != nil {
				log.Printf("awareness snapshot: final write failed: %v", err)
			} else {
				log.Printf("awareness snapshot: flushed to %s on shutdown", path)
			}
			return
		case <-t.C:
			if err := writeAwarenessSnapshot(path, a); err != nil {
				log.Printf("awareness snapshot: periodic write failed: %v", err)
			}
		}
	}
}

// snapshotInterval is how often the distribution is persisted while running.
func snapshotInterval() time.Duration {
	if v := os.Getenv("COMPLIANCE_AWARENESS_SNAPSHOT_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			return d
		}
		log.Printf("awareness snapshot: invalid interval %q — using 5m", v)
	}
	return 5 * time.Minute
}
