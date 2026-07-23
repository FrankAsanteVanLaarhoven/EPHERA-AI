package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/ephera/compliance-risk/internal/detect"
)

func seedAwareness(t *testing.T) *detect.Awareness {
	t.Helper()
	a := detect.NewAwareness(detect.NewPopulation(), 12, 15*time.Minute, 3)
	base := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	for i := 0; i < 800; i++ {
		a.Assess(detect.Observation{
			At: base.Add(time.Duration(i) * time.Second),
			Features: []detect.Feature{
				{Name: "amount_band", Value: "band:3"},
				{Name: "payee_type", Value: "known"},
			},
		})
	}
	return a
}

func TestSnapshotWriteThenWarmStart(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sub", "awareness.json") // sub dir must be created

	a := seedAwareness(t)
	if err := writeAwarenessSnapshot(path, a); err != nil {
		t.Fatalf("writeAwarenessSnapshot: %v", err)
	}

	pop := loadAwarenessPopulation(path)
	if pop.Total() != a.PopulationSnapshot().Total {
		t.Fatalf("warm-start total %d, want %d", pop.Total(), a.PopulationSnapshot().Total)
	}
	if pop.Total() != 800 {
		t.Fatalf("warm-start total %d, want 800", pop.Total())
	}
}

func TestLoadMissingFileStartsClean(t *testing.T) {
	pop := loadAwarenessPopulation(filepath.Join(t.TempDir(), "does-not-exist.json"))
	if pop.Total() != 0 {
		t.Fatalf("missing file should start clean, got total %d", pop.Total())
	}
}

func TestLoadEmptyPathStartsClean(t *testing.T) {
	if pop := loadAwarenessPopulation(""); pop.Total() != 0 {
		t.Fatalf("empty path should start clean, got total %d", pop.Total())
	}
}

func TestLoadCorruptFileStartsCleanNotCrash(t *testing.T) {
	path := filepath.Join(t.TempDir(), "corrupt.json")
	if err := os.WriteFile(path, []byte("{not valid json"), 0o600); err != nil {
		t.Fatal(err)
	}
	pop := loadAwarenessPopulation(path)
	if pop.Total() != 0 {
		t.Fatalf("corrupt file should start clean, got total %d", pop.Total())
	}
}

func TestLoadWrongVersionStartsClean(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wrongver.json")
	// A structurally valid snapshot with an unrecognised version must be refused.
	if err := os.WriteFile(path,
		[]byte(`{"version":"detect.population/999","total":5,"counts":{}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if pop := loadAwarenessPopulation(path); pop.Total() != 0 {
		t.Fatalf("wrong-version file should start clean, got total %d", pop.Total())
	}
}

func TestSnapshotIntervalDefaultAndOverride(t *testing.T) {
	t.Setenv("COMPLIANCE_AWARENESS_SNAPSHOT_INTERVAL", "")
	if got := snapshotInterval(); got != 5*time.Minute {
		t.Fatalf("default interval %v, want 5m", got)
	}
	t.Setenv("COMPLIANCE_AWARENESS_SNAPSHOT_INTERVAL", "30s")
	if got := snapshotInterval(); got != 30*time.Second {
		t.Fatalf("override interval %v, want 30s", got)
	}
	t.Setenv("COMPLIANCE_AWARENESS_SNAPSHOT_INTERVAL", "garbage")
	if got := snapshotInterval(); got != 5*time.Minute {
		t.Fatalf("invalid interval should fall back to 5m, got %v", got)
	}
}
