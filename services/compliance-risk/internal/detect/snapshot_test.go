package detect

import (
	"bytes"
	"math"
	"testing"
	"time"
)

// buildPopulation seeds a population with a repeatable, skewed distribution so
// rarity is meaningful: common values seen often, one rare tail value.
func buildPopulation(t *testing.T) *Population {
	t.Helper()
	p := NewPopulation()
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 1000; i++ {
		band := "band:2"
		if i%50 == 0 {
			band = "band:9" // rare tail: 2% of traffic
		}
		p.Observe(Observation{
			At: base.Add(time.Duration(i) * time.Second),
			Features: []Feature{
				{Name: "amount_band", Value: band},
				{Name: "payee_type", Value: "known"},
				{Name: "hour_band", Value: "day"},
			},
		})
	}
	return p
}

func TestPopulationSnapshotRoundTrip(t *testing.T) {
	orig := buildPopulation(t)

	// Marshal to JSON and back through the disk-shaped path.
	var buf bytes.Buffer
	if err := orig.WriteSnapshot(&buf); err != nil {
		t.Fatalf("WriteSnapshot: %v", err)
	}
	restored, err := ReadPopulation(&buf)
	if err != nil {
		t.Fatalf("ReadPopulation: %v", err)
	}

	if restored.Total() != orig.Total() {
		t.Fatalf("total: restored %d, orig %d", restored.Total(), orig.Total())
	}

	// The distribution must be identical: same probability and same count for
	// every feature value that matters, common and rare alike.
	for _, f := range []Feature{
		{Name: "amount_band", Value: "band:2"},
		{Name: "amount_band", Value: "band:9"},
		{Name: "payee_type", Value: "known"},
		{Name: "amount_band", Value: "band:never-seen"},
	} {
		if got, want := restored.Count(f), orig.Count(f); got != want {
			t.Errorf("Count(%s=%s): restored %d, orig %d", f.Name, f.Value, got, want)
		}
		if got, want := restored.probability(f), orig.probability(f); math.Abs(got-want) > 1e-12 {
			t.Errorf("probability(%s=%s): restored %v, orig %v", f.Name, f.Value, got, want)
		}
	}
}

// TestWarmStartMatchesNeverRestarted is the property that justifies persistence:
// a detector restored from a snapshot must score an observation exactly as one
// that never restarted. If warm-start disagreed with continuous operation, the
// snapshot would be a second, subtly different detector — worse than none.
func TestWarmStartMatchesNeverRestarted(t *testing.T) {
	continuous := buildPopulation(t)

	var buf bytes.Buffer
	if err := continuous.WriteSnapshot(&buf); err != nil {
		t.Fatalf("WriteSnapshot: %v", err)
	}
	warm, err := ReadPopulation(&buf)
	if err != nil {
		t.Fatalf("ReadPopulation: %v", err)
	}

	probe := Observation{
		At: time.Date(2026, 1, 2, 2, 0, 0, 0, time.UTC),
		Features: []Feature{
			{Name: "amount_band", Value: "band:9"},   // rare tail
			{Name: "payee_type", Value: "new"},        // never seen
			{Name: "hour_band", Value: "night"},       // never seen
		},
	}
	const bits = 12.0

	a := NewAwareness(continuous, bits, time.Hour, 3)
	b := NewAwareness(warm, bits, time.Hour, 3)

	sc := a.Assess(probe)
	sw := b.Assess(probe)

	if sc.Rare != sw.Rare || sc.Confident != sw.Confident {
		t.Fatalf("rare/confident differ: continuous %+v vs warm %+v", sc, sw)
	}
	if math.Abs(sc.Surprisal-sw.Surprisal) > 1e-9 {
		t.Fatalf("surprisal differs: continuous %v, warm %v", sc.Surprisal, sw.Surprisal)
	}
	if sc.Priority != sw.Priority {
		t.Fatalf("priority differs: continuous %q, warm %q", sc.Priority, sw.Priority)
	}
	if sc.Novel != sw.Novel {
		t.Fatalf("novelty differs: continuous %v, warm %v", sc.Novel, sw.Novel)
	}
}

func TestAwarenessPopulationSnapshotIsConsistent(t *testing.T) {
	a := NewAwareness(buildPopulation(t), 12.0, time.Hour, 3)
	snap := a.PopulationSnapshot()
	if snap.Version != SnapshotVersion {
		t.Fatalf("version %q, want %q", snap.Version, SnapshotVersion)
	}
	if snap.Total != 1000 {
		t.Fatalf("total %d, want 1000", snap.Total)
	}
}

func TestLoadPopulationFailsClosed(t *testing.T) {
	good := NewPopulation().Snapshot()

	cases := []struct {
		name string
		snap PopulationSnapshot
	}{
		{"unknown version", PopulationSnapshot{Version: "detect.population/999", Counts: map[string]map[string]int{}}},
		{"empty version", PopulationSnapshot{Version: "", Counts: map[string]map[string]int{}}},
		{"negative total", PopulationSnapshot{Version: SnapshotVersion, Total: -1, Counts: map[string]map[string]int{}}},
		{"negative count", PopulationSnapshot{Version: SnapshotVersion, Total: 5, Counts: map[string]map[string]int{"a": {"x": -3}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := LoadPopulation(tc.snap); err == nil {
				t.Fatalf("expected refusal for %s, got nil error", tc.name)
			}
		})
	}

	// The known-good snapshot must still load.
	if _, err := LoadPopulation(good); err != nil {
		t.Fatalf("good snapshot refused: %v", err)
	}
}
