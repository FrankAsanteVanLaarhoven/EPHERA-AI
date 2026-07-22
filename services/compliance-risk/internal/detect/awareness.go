package detect

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// Situation awareness for rare events.
//
// The rarity detector answers "how unusual is this, against what the population
// does". That is necessary but not sufficient to act on: a single rare payment
// and a burst of similar rare payments are different situations, and the right
// response to each differs. One rare large payment to a new payee at 02:00 is a
// customer doing something unusual; twenty of them to the same new payee inside
// ten minutes is an incident.
//
// Situation awareness adds that context. For each observation it says not just
// whether it is rare, but:
//
//   - what specifically made it rare (the lead finding), so an analyst knows
//     where to look first;
//   - whether the value is novel — never seen before — or rare-but-seen;
//   - whether it stands alone or is part of a recent cluster of similar rare
//     events, which is the difference between noise and a developing pattern;
//   - a priority derived from those, and a plain-language narrative.
//
// Everything here is derived from the population the platform has actually seen
// and the rare events it has actually recorded. Nothing is invented, and the
// confidence gate is respected: below MinPopulation no claim is made, because a
// situation built on a small sample is a guess dressed as an alert.

// Priority orders analyst attention. It is deliberately coarse — four levels a
// human can reason about, not a false-precision score.
type Priority string

const (
	// PriorityNone: not rare, or no confident claim can be made.
	PriorityNone Priority = "none"
	// PriorityWatch: rare, but isolated and not novel. Worth recording, not
	// worth waking someone.
	PriorityWatch Priority = "watch"
	// PriorityElevated: rare and novel, or rare with a small cluster forming.
	PriorityElevated Priority = "elevated"
	// PriorityHigh: rare and part of a burst, or extremely rare. Look now.
	PriorityHigh Priority = "high"
)

// Situation is the context around one scored observation.
type Situation struct {
	At        time.Time `json:"at"`
	Confident bool      `json:"confident"`
	Rare      bool      `json:"rare"`
	Surprisal float64   `json:"surprisalBits"`

	// Lead is the single most unusual feature — where an analyst looks first.
	Lead RarityFinding `json:"lead"`
	// Novel is true when the lead value had never been seen before this event.
	Novel bool `json:"novel"`

	// ClusterSize counts recent rare events sharing this lead value, including
	// this one. 1 means isolated; more means a pattern is forming.
	ClusterSize   int           `json:"clusterSize"`
	ClusterWindow time.Duration `json:"clusterWindow"`

	Priority  Priority `json:"priority"`
	Narrative string   `json:"narrative"`
	// Reason explains why no confident claim was made, when Confident is false.
	Reason string `json:"reason,omitempty"`
}

// Count returns how many times a feature value has been observed. Zero means it
// has never been seen, which is what makes an occurrence novel.
func (p *Population) Count(f Feature) int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.counts[f.Name][f.Value]
}

type recentRare struct {
	at       time.Time
	leadName string
	leadVal  string
}

// Awareness scores observations and maintains the situational context around
// the rare ones. It is safe for concurrent use.
type Awareness struct {
	mu   sync.Mutex
	pop  *Population
	bits float64

	// window bounds how far back a "recent cluster" reaches, and the count at
	// which a cluster is treated as a burst.
	window      time.Duration
	burstSize   int
	extremeMult float64 // surprisal beyond this multiple of the threshold is "extreme"

	recent []recentRare

	// OnRare, if set, is called for every rare situation (priority watch and
	// above). It is the activation seam: where a deployment wires logging, an
	// alert, or a case. The detector does not log on its own, because what to do
	// with a situation is an operational choice, not the detector's — and a
	// library that logs on its own is one an operator cannot make quiet.
	OnRare func(Situation)
}

// NewAwareness builds a situation-awareness engine over a population.
//
//   - bitsThreshold: the surprisal (in bits) at or above which an observation is
//     rare — passed straight to the population's own scorer.
//   - window: how far back a cluster of similar rare events reaches.
//   - burstSize: the cluster size (including the current event) at which the
//     situation is a burst and priority becomes high.
func NewAwareness(pop *Population, bitsThreshold float64, window time.Duration, burstSize int) *Awareness {
	if burstSize < 2 {
		burstSize = 2
	}
	return &Awareness{
		pop:         pop,
		bits:        bitsThreshold,
		window:      window,
		burstSize:   burstSize,
		extremeMult: 1.5,
	}
}

// Assess scores an observation against the population, records it, and returns
// the situation around it.
//
// The observation is scored BEFORE it is folded into the population, so it is
// measured against the past rather than against itself; novelty is read from the
// counts as they were just before this event. A rare event is then added to the
// recent-cluster history.
func (a *Awareness) Assess(o Observation) Situation {
	a.mu.Lock()
	s := a.assessLocked(o)
	hook := a.OnRare
	a.mu.Unlock()

	// The activation hook runs outside the lock so a callback that logs, alerts,
	// or calls back into the detector cannot deadlock or serialise scoring.
	if hook != nil && s.Rare && s.Confident {
		hook(s)
	}
	return s
}

func (a *Awareness) assessLocked(o Observation) Situation {
	res := a.pop.Score(o, a.bits)
	s := Situation{
		At:        o.At,
		Confident: res.Confident,
		Rare:      res.Rare,
		Surprisal: res.Surprisal,
		Reason:    res.Reason,
	}

	// No confident claim below the minimum population. The observation still
	// contributes to the population so it can become confident later.
	if !res.Confident {
		s.Priority = PriorityNone
		s.Narrative = res.Reason
		a.pop.Observe(o)
		return s
	}

	if len(res.Findings) > 0 {
		s.Lead = res.Findings[0]
		// Novelty is read before this observation is folded in.
		s.Novel = a.pop.Count(s.Lead.Feature) == 0
	}

	if !res.Rare {
		s.Priority = PriorityNone
		s.Narrative = fmt.Sprintf("Ordinary payment (%.1f bits, below the %.1f-bit threshold).",
			res.Surprisal, a.bits)
		a.pop.Observe(o)
		return s
	}

	// A rare event: correlate with recent rare events sharing the same lead
	// value, prune anything outside the window, and record this one.
	a.prune(o.At)
	cluster := 1
	for _, r := range a.recent {
		if r.leadName == s.Lead.Feature.Name && r.leadVal == s.Lead.Feature.Value {
			cluster++
		}
	}
	s.ClusterSize = cluster
	s.ClusterWindow = a.window
	a.recent = append(a.recent, recentRare{
		at: o.At, leadName: s.Lead.Feature.Name, leadVal: s.Lead.Feature.Value,
	})

	s.Priority = a.priority(res, s)
	s.Narrative = narrate(res, s, a.window)

	a.pop.Observe(o)
	return s
}

// priority derives the coarse level from rarity, novelty and clustering.
func (a *Awareness) priority(res RarityResult, s Situation) Priority {
	burst := s.ClusterSize >= a.burstSize
	extreme := res.Surprisal >= a.bits*a.extremeMult
	switch {
	case burst || extreme:
		// A developing pattern, or a single event far past the threshold.
		return PriorityHigh
	case s.Novel || s.ClusterSize > 1:
		// A first-ever value, or a small cluster forming.
		return PriorityElevated
	default:
		return PriorityWatch
	}
}

// prune drops recent rare events older than the window.
func (a *Awareness) prune(now time.Time) {
	cutoff := now.Add(-a.window)
	kept := a.recent[:0]
	for _, r := range a.recent {
		if r.at.After(cutoff) {
			kept = append(kept, r)
		}
	}
	a.recent = kept
}

func narrate(res RarityResult, s Situation, window time.Duration) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Rare payment (%.1f bits, ~1 in %d). ", res.Surprisal, oneInN(res.Surprisal))
	if s.Lead.Observation != "" {
		fmt.Fprintf(&b, "Most unusual: %s. ", s.Lead.Observation)
	}
	if s.Novel {
		b.WriteString("This value has never been seen before. ")
	}
	switch {
	case s.ClusterSize >= 3:
		fmt.Fprintf(&b, "%d similar rare payments in the last %s — a developing pattern, not an isolated event.",
			s.ClusterSize, humaniseWindow(window))
	case s.ClusterSize == 2:
		fmt.Fprintf(&b, "A second similar rare payment inside %s — worth watching for more.",
			humaniseWindow(window))
	default:
		b.WriteString("Isolated so far.")
	}
	return strings.TrimSpace(b.String())
}

// oneInN turns surprisal bits into a "1 in N" figure a person can hold. It is a
// deliberately rounded framing, not a precise probability.
func oneInN(bits float64) int {
	n := 1.0
	for i := 0; i < int(bits) && n < 1e9; i++ {
		n *= 2
	}
	return int(n)
}

func humaniseWindow(w time.Duration) string {
	switch {
	case w >= time.Hour:
		return fmt.Sprintf("%dh", int(w.Hours()))
	case w >= time.Minute:
		return fmt.Sprintf("%dm", int(w.Minutes()))
	default:
		return w.String()
	}
}

// ActiveClusters summarises the rare-event clusters currently in the window, so
// an operator can see the live situation across all rare events at once rather
// than one alert at a time. Most active first.
func (a *Awareness) ActiveClusters(now time.Time) []ClusterSummary {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.prune(now)

	byLead := map[string]*ClusterSummary{}
	for _, r := range a.recent {
		key := r.leadName + "=" + r.leadVal
		c := byLead[key]
		if c == nil {
			c = &ClusterSummary{Feature: r.leadName, Value: r.leadVal, FirstAt: r.at, LastAt: r.at}
			byLead[key] = c
		}
		c.Count++
		if r.at.Before(c.FirstAt) {
			c.FirstAt = r.at
		}
		if r.at.After(c.LastAt) {
			c.LastAt = r.at
		}
	}
	out := make([]ClusterSummary, 0, len(byLead))
	for _, c := range byLead {
		out = append(out, *c)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out
}

// ClusterSummary is one active cluster of similar rare events in the window.
type ClusterSummary struct {
	Feature string    `json:"feature"`
	Value   string    `json:"value"`
	Count   int       `json:"count"`
	FirstAt time.Time `json:"firstAt"`
	LastAt  time.Time `json:"lastAt"`
}
