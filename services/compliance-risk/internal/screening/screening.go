// Package screening matches a payee name against a watchlist.
//
// # Why this is an interface, and why the sandbox one is still fuzzy
//
// The screening that ships is a fixture: a handful of fictional entries, not a
// licensed sanctions or PEP list. A real deployment consumes a licensed list —
// OFAC, HM Treasury, UN, an EU consolidated list, a commercial PEP feed — and
// that is a data and licensing decision, not a code one. So this package is an
// interface first: [Screener]. A licensed provider implements it (an HTTP
// adapter to a screening vendor, or a bulk-loaded indexed list), and nothing
// else in the platform changes.
//
// But the sandbox matcher used to be exact string equality, which is worse than
// a toy: a sanctioned "Fictional Sanctioned Person" was denied, while
// "Fictional Sanctioned Persons", a dropped syllable, an added middle initial,
// or reordered words all matched nothing and sailed through. Sanctions
// screening that any spelling variation evades is a control in name only, and it
// would teach an integrator the wrong lesson about what screening is. So even
// the fixture matcher is fuzzy: it scores similarity and returns a match with a
// score, and the decision layer treats a strong match differently from a weak
// one — deny on a near-exact hit, review on a plausible one, because fuzzy
// matching produces false positives and blocking a real customer on a
// coincidence is its own harm.
package screening

import (
	"context"
	"sort"
	"strings"
)

// Category is the kind of watchlist an entry sits on.
type Category string

const (
	CategorySanctions    Category = "sanctions"
	CategoryPEP          Category = "pep"
	CategoryAdverseMedia Category = "adverse_media"
)

// MatchType records how a match was made, so a reviewer can see whether it was
// exact or a fuzzy resemblance.
type MatchType string

const (
	MatchExact MatchType = "exact"
	MatchFuzzy MatchType = "fuzzy"
)

// Match is one watchlist hit, with a score so the caller can distinguish a
// near-certain match from a plausible one.
type Match struct {
	Name      string    `json:"name"`
	Category  Category  `json:"category"`
	Source    string    `json:"source"`
	Score     float64   `json:"score"` // 0..1, 1 is an exact normalised match
	MatchType MatchType `json:"matchType"`
}

// Screener matches a name against a watchlist. A licensed provider is expected
// to implement this; the fixture below is the sandbox default.
type Screener interface {
	Screen(ctx context.Context, name string) ([]Match, error)
}

// Entry is one watchlist record.
type Entry struct {
	Name     string
	Category Category
	Source   string
}

// Thresholds control what counts as a match and what counts as strong.
type Thresholds struct {
	// Match is the minimum similarity to report at all. Below it, nothing is
	// returned — a name is not "screened" against every entry it faintly
	// resembles.
	Match float64
	// Strong is the similarity at or above which a match is treated as
	// near-certain (an exact hit, a plural, a trivial typo). The decision layer
	// denies on a strong sanctions match and reviews on a weaker one.
	Strong float64
}

// DefaultThresholds are conservative: report resemblances of 0.80 and up, treat
// 0.92 and up as strong. These are the numbers a real deployment would tune
// against its own false-positive tolerance.
func DefaultThresholds() Thresholds { return Thresholds{Match: 0.80, Strong: 0.92} }

// StrongScore is exposed so callers agree on what "strong" means without
// re-deriving the threshold.
func (t Thresholds) IsStrong(score float64) bool { return score >= t.Strong }

// FuzzyScreener matches against an in-memory list with similarity scoring. It is
// the sandbox implementation; a licensed provider replaces it wholesale.
type FuzzyScreener struct {
	entries    []Entry
	thresholds Thresholds
}

// NewFuzzyScreener builds a screener over the given entries.
func NewFuzzyScreener(entries []Entry, t Thresholds) *FuzzyScreener {
	return &FuzzyScreener{entries: entries, thresholds: t}
}

func (f *FuzzyScreener) Screen(_ context.Context, name string) ([]Match, error) {
	q := normalise(name)
	if q == "" {
		return nil, nil
	}
	qSorted := sortTokens(q)

	var hits []Match
	for _, e := range f.entries {
		en := normalise(e.Name)
		mt := MatchFuzzy
		var score float64
		if en == q {
			score, mt = 1.0, MatchExact
		} else {
			// Token-sorted before comparing, so reordered names ("Person
			// Sanctioned Fictional") do not defeat the match, and a bounded edit
			// distance then absorbs plurals and typos.
			score = similarity(qSorted, sortTokens(en))
		}
		if score >= f.thresholds.Match {
			hits = append(hits, Match{
				Name: e.Name, Category: e.Category, Source: e.Source,
				Score: round(score), MatchType: mt,
			})
		}
	}
	// Strongest first, so a reviewer sees the most likely match at the top.
	sort.SliceStable(hits, func(i, j int) bool { return hits[i].Score > hits[j].Score })
	return hits, nil
}

// normalise lowercases, trims, and collapses whitespace.
func normalise(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(s))), " ")
}

// sortTokens returns the normalised words in sorted order, so word reordering
// does not change the comparison.
func sortTokens(s string) string {
	toks := strings.Fields(s)
	sort.Strings(toks)
	return strings.Join(toks, " ")
}

// similarity is 1 minus the normalised Levenshtein distance, in [0,1].
func similarity(a, b string) float64 {
	if a == b {
		return 1
	}
	m := max(len(a), len(b))
	if m == 0 {
		return 1
	}
	return 1 - float64(levenshtein(a, b))/float64(m)
}

// levenshtein is the classic edit distance, single-row optimised.
func levenshtein(a, b string) int {
	if a == b {
		return 0
	}
	ra, rb := []rune(a), []rune(b)
	if len(ra) == 0 {
		return len(rb)
	}
	if len(rb) == 0 {
		return len(ra)
	}
	prev := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur := make([]int, len(rb)+1)
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min3(cur[j-1]+1, prev[j]+1, prev[j-1]+cost)
		}
		prev = cur
	}
	return prev[len(rb)]
}

func min3(a, b, c int) int {
	m := a
	if b < m {
		m = b
	}
	if c < m {
		m = c
	}
	return m
}

func round(f float64) float64 { return float64(int(f*100+0.5)) / 100 }
