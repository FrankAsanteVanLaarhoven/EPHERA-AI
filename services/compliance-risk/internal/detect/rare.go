// Package detect finds rare events without labelled data, and protects itself
// from its own degradation.
//
// # Why rarity rather than a learned model
//
// This platform has no labelled fraud. Not a little — none. Supervised learning
// needs examples of the thing you want to catch, and a model trained on
// invented labels learns the person who invented them. Reinforcement learning
// needs a reward signal, and there is no reward here that would not also be
// fabricated; an agent optimising an invented reward while moving customer
// money is a category of risk this platform's own trust boundaries exist to
// prevent (ADR 0002, ADR 0004).
//
// Rarity is computable without labels. It answers a narrower question — "how
// unusual is this, against what this population actually does" — and it answers
// it from data the platform genuinely has. That is a smaller claim than
// "detects fraud", and it is one that can be checked.
//
// # Self-protection, not self-modification
//
// "Self-healing" here means the detector watches its own behaviour and falls
// back to a known-good configuration when it degrades. It does NOT mean the
// detector tunes its own thresholds against live money. A control that adjusts
// itself in production, with no labels to tell it whether it is getting better,
// will drift toward whatever makes its own numbers look good — and the only
// evidence it was wrong is customers who were wrongly stopped, or fraud that
// was quietly let through.
//
// So the loop is: detect degradation, revert to the last configuration known to
// behave, refuse to escalate on its own, and raise an operational alert. A
// human promotes a new configuration. Nothing here promotes itself.
package detect

import (
	"fmt"
	"math"
	"sort"
	"sync"
	"time"
)

// Feature is one observable of a payment, already bucketed into a category.
// Bucketing rather than raw values keeps rarity computable on modest volumes
// and keeps the explanation readable: "amount band 5, new payee, 02:00" is
// something a reviewer can check.
type Feature struct {
	Name  string
	Value string
}

// Observation is one payment reduced to its features.
type Observation struct {
	Features []Feature
	At       time.Time
}

// Population is what the platform has actually seen, used as the reference
// distribution. It is deliberately explicit rather than a fitted model: the
// counts can be inspected, and a rarity claim can be traced back to them.
type Population struct {
	mu     sync.RWMutex
	counts map[string]map[string]int // feature name -> value -> count
	total  int
}

func NewPopulation() *Population {
	return &Population{counts: map[string]map[string]int{}}
}

func (p *Population) Observe(o Observation) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.total++
	for _, f := range o.Features {
		if p.counts[f.Name] == nil {
			p.counts[f.Name] = map[string]int{}
		}
		p.counts[f.Name][f.Value]++
	}
}

func (p *Population) Total() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.total
}

// Rarity of a feature value, as a probability with Laplace smoothing so an
// unseen value is rare rather than impossible. Treating the never-before-seen
// as probability zero would make every first occurrence infinitely surprising,
// which in a growing platform means every new customer.
func (p *Population) probability(f Feature) float64 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	distinct := len(p.counts[f.Name])
	if distinct == 0 {
		distinct = 1
	}
	seen := p.counts[f.Name][f.Value]
	return float64(seen+1) / float64(p.total+distinct)
}

// RarityFinding is one feature that stood out, with the evidence behind it.
type RarityFinding struct {
	Feature     Feature `json:"feature"`
	Probability float64 `json:"probability"`
	Surprisal   float64 `json:"surprisal"`
	Observation string  `json:"observation"`
}

type RarityResult struct {
	// Surprisal is the total information content in bits. Higher means the
	// combination is less like anything the platform has seen.
	Surprisal float64         `json:"surprisal"`
	Rare      bool            `json:"rare"`
	Findings  []RarityFinding `json:"findings"`
	// Confident is false when the population is too small to make a rarity
	// claim. Reporting "rare" from thirty observations is noise dressed as
	// signal, and acting on it means stopping customers on the strength of a
	// small sample.
	Confident bool `json:"confident"`
	Reason    string `json:"reason"`
}

// MinPopulation is the number of observations below which no rarity claim is
// made at all.
const MinPopulation = 500

// Score measures how unusual an observation is against the population.
func (p *Population) Score(o Observation, bitsThreshold float64) RarityResult {
	if p.Total() < MinPopulation {
		return RarityResult{
			Confident: false,
			Reason: fmt.Sprintf(
				"population is %d observations; no rarity claim is made below %d",
				p.Total(), MinPopulation),
		}
	}

	var total float64
	findings := make([]RarityFinding, 0, len(o.Features))
	for _, f := range o.Features {
		prob := p.probability(f)
		bits := -math.Log2(prob)
		total += bits
		findings = append(findings, RarityFinding{
			Feature: f, Probability: prob, Surprisal: bits,
			Observation: fmt.Sprintf("%s=%s occurs in %.2f%% of payments",
				f.Name, f.Value, prob*100),
		})
	}
	sort.SliceStable(findings, func(i, j int) bool {
		return findings[i].Surprisal > findings[j].Surprisal
	})

	return RarityResult{
		Surprisal: total,
		Rare:      total >= bitsThreshold,
		Findings:  findings,
		Confident: true,
	}
}
