package detect

import (
	"encoding/json"
	"fmt"
	"io"
)

// Persisting the reference distribution.
//
// The rarity detector learns nothing more than what the population has actually
// done — a set of counts. That state is valuable across restarts: a detector
// that starts every run from an empty population treats the first hours after a
// restart as a population of zero, where every value is unseen, everything looks
// rare, and every ordinary customer trips the alarm. Persisting the distribution
// and restoring it lets a new run warm-start from what an earlier run had
// already seen.
//
// What is persisted is the population, not a fitted opaque model: the counts are
// the same inspectable integers on disk as in memory, so a rarity claim can
// still be traced back to them after a reload. The recent-cluster buffer that
// Awareness keeps is deliberately NOT persisted — it is time-bounded operational
// state, and a cluster restored hours later would assert a burst that is no
// longer happening.

// SnapshotVersion identifies the on-disk snapshot format. A snapshot written by
// a version this build does not recognise is refused rather than misread: a
// reference distribution loaded wrong computes rarity wrong, silently, on the
// path that decides whether a customer is stopped.
const SnapshotVersion = "detect.population/1"

// PopulationSnapshot is the serialisable, inspectable state of a Population.
type PopulationSnapshot struct {
	Version string                    `json:"version"`
	Total   int                       `json:"total"`
	Counts  map[string]map[string]int `json:"counts"`
}

// Snapshot returns a deep copy of the population's learned distribution, safe to
// marshal and to keep while observation continues. Copying under the read lock
// makes it a consistent point-in-time view.
func (p *Population) Snapshot() PopulationSnapshot {
	p.mu.RLock()
	defer p.mu.RUnlock()
	counts := make(map[string]map[string]int, len(p.counts))
	for name, vals := range p.counts {
		cp := make(map[string]int, len(vals))
		for v, c := range vals {
			cp[v] = c
		}
		counts[name] = cp
	}
	return PopulationSnapshot{Version: SnapshotVersion, Total: p.total, Counts: counts}
}

// LoadPopulation rebuilds a Population from a snapshot. It fails closed: an
// unrecognised version, a negative total, or a negative count is refused rather
// than loaded into a state that would miscompute rarity. A refused load is a
// signal to start clean and rebuild, not to proceed on a corrupt distribution.
func LoadPopulation(s PopulationSnapshot) (*Population, error) {
	if s.Version != SnapshotVersion {
		return nil, fmt.Errorf("detect: unknown snapshot version %q (want %q)", s.Version, SnapshotVersion)
	}
	if s.Total < 0 {
		return nil, fmt.Errorf("detect: snapshot total is negative (%d)", s.Total)
	}
	counts := make(map[string]map[string]int, len(s.Counts))
	for name, vals := range s.Counts {
		cp := make(map[string]int, len(vals))
		for v, c := range vals {
			if c < 0 {
				return nil, fmt.Errorf("detect: snapshot count for %s=%q is negative (%d)", name, v, c)
			}
			cp[v] = c
		}
		counts[name] = cp
	}
	return &Population{counts: counts, total: s.Total}, nil
}

// WriteSnapshot marshals the population's distribution to w as JSON.
func (p *Population) WriteSnapshot(w io.Writer) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(p.Snapshot())
}

// ReadPopulation reads a JSON snapshot from r and rebuilds the population,
// applying the same fail-closed checks as LoadPopulation.
func ReadPopulation(r io.Reader) (*Population, error) {
	var s PopulationSnapshot
	if err := json.NewDecoder(r).Decode(&s); err != nil {
		return nil, fmt.Errorf("detect: decode snapshot: %w", err)
	}
	return LoadPopulation(s)
}

// PopulationSnapshot exposes the underlying population's distribution for
// persistence, taken consistently under the Awareness lock so it does not race
// with an in-flight Assess.
func (a *Awareness) PopulationSnapshot() PopulationSnapshot {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.pop.Snapshot()
}
