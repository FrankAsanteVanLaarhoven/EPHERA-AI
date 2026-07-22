package screening

import (
	"context"
	"testing"
)

var list = []Entry{
	{Name: "Fictional Sanctioned Person", Category: CategorySanctions, Source: "SANDBOX-FIXTURE"},
	{Name: "Example Blocked Entity", Category: CategorySanctions, Source: "SANDBOX-FIXTURE"},
	{Name: "Fictional Public Official", Category: CategoryPEP, Source: "SANDBOX-FIXTURE"},
}

func screen(t *testing.T, name string) []Match {
	t.Helper()
	m, err := NewFuzzyScreener(list, DefaultThresholds()).Screen(context.Background(), name)
	if err != nil {
		t.Fatalf("screen: %v", err)
	}
	return m
}

func top(t *testing.T, name string) Match {
	t.Helper()
	m := screen(t, name)
	if len(m) == 0 {
		t.Fatalf("no match for %q", name)
	}
	return m[0]
}

// The exact name is a strong, exact match.
func TestExactMatchIsStrong(t *testing.T) {
	m := top(t, "Fictional Sanctioned Person")
	if m.MatchType != MatchExact || m.Score != 1.0 {
		t.Fatalf("exact name scored %v (%s)", m.Score, m.MatchType)
	}
	if !DefaultThresholds().IsStrong(m.Score) {
		t.Fatal("an exact match was not treated as strong")
	}
}

// The variations that used to evade exact matching are now caught. This is the
// whole point: sanctions screening any spelling change defeats is not screening.
func TestSpellingVariationsAreCaught(t *testing.T) {
	for _, name := range []string{
		"Fictional Sanctioned Persons",   // plural
		"fictional  sanctioned   person", // whitespace / case
		"Person Sanctioned Fictional",    // reordered
		"Fictional A. Sanctioned Person", // added initial
		"Fictional Sanction Person",      // dropped syllable
	} {
		m := screen(t, name)
		if len(m) == 0 {
			t.Fatalf("%q evaded the sanctions list", name)
		}
		if m[0].Category != CategorySanctions {
			t.Fatalf("%q matched the wrong category: %s", name, m[0].Category)
		}
	}
}

// A clearly different name is not matched, or the list would flag everyone.
func TestUnrelatedNameIsNotMatched(t *testing.T) {
	for _, name := range []string{"John Smith", "Ama Mensah", "Acme Trading Ltd"} {
		if m := screen(t, name); len(m) != 0 {
			t.Fatalf("%q matched the watchlist at score %.2f", name, m[0].Score)
		}
	}
}

// A PEP match reports the PEP category (the decision layer reviews, not denies).
func TestPEPMatchReportsCategory(t *testing.T) {
	m := top(t, "Fictional Public Official")
	if m.Category != CategoryPEP {
		t.Fatalf("expected a PEP match, got %s", m.Category)
	}
}

// FuzzyScreener satisfies the Screener interface a licensed provider implements.
func TestFuzzyScreenerIsAScreener(t *testing.T) {
	var _ Screener = NewFuzzyScreener(list, DefaultThresholds())
}
