package detect

import (
	"fmt"
	"testing"
	"time"
)

var now = time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)

func obs(amountBand, payee, hour string) Observation {
	return Observation{Features: []Feature{
		{Name: "amount_band", Value: amountBand},
		{Name: "payee_type", Value: payee},
		{Name: "hour_band", Value: hour},
	}, At: now}
}

// A population of ordinary payments, plus a handful of unusual ones so the
// rarity claim is against something realistic rather than a uniform block.
func populated() *Population {
	p := NewPopulation()
	for i := 0; i < 900; i++ {
		p.Observe(obs("small", "known", "day"))
	}
	for i := 0; i < 90; i++ {
		p.Observe(obs("medium", "known", "day"))
	}
	for i := 0; i < 10; i++ {
		p.Observe(obs("large", "new", "night"))
	}
	return p
}

// No rarity claim is made from a small population. Reporting "rare" from thirty
// observations means stopping customers on the strength of a small sample.
func TestNoClaimBelowMinimumPopulation(t *testing.T) {
	p := NewPopulation()
	for i := 0; i < 30; i++ {
		p.Observe(obs("small", "known", "day"))
	}
	r := p.Score(obs("large", "new", "night"), 10)
	if r.Confident {
		t.Fatal("a rarity claim was made from 30 observations")
	}
	if r.Rare {
		t.Fatal("an unconfident result was still marked rare")
	}
	if r.Reason == "" {
		t.Fatal("no reason given for withholding the claim")
	}
}

func TestOrdinaryPaymentIsNotRare(t *testing.T) {
	r := populated().Score(obs("small", "known", "day"), 10)
	if !r.Confident {
		t.Fatalf("expected a confident result: %s", r.Reason)
	}
	if r.Rare {
		t.Fatalf("the most common payment shape was called rare (%.1f bits)", r.Surprisal)
	}
}

func TestUnusualCombinationIsRare(t *testing.T) {
	// A combination never seen: a large payment to a new payee at night is
	// present in the population, but "huge" amount band is not.
	r := populated().Score(obs("huge", "new", "night"), 10)
	if !r.Rare {
		t.Fatalf("an unseen combination was not rare (%.1f bits)", r.Surprisal)
	}
	// The explanation must lead with the thing that was actually unusual.
	if r.Findings[0].Feature.Name != "amount_band" {
		t.Fatalf("the rarest feature was %q, expected amount_band", r.Findings[0].Feature.Name)
	}
	if r.Findings[0].Observation == "" {
		t.Fatal("the rarest finding carries no observation")
	}
}

// A never-before-seen value must be rare, not impossible. Treating the unseen
// as probability zero makes every first occurrence infinitely surprising, which
// in a growing platform means every new customer.
func TestUnseenValueIsRareNotImpossible(t *testing.T) {
	r := populated().Score(obs("unheard_of", "known", "day"), 10)
	for _, f := range r.Findings {
		if f.Probability <= 0 {
			t.Fatalf("feature %v was assigned zero probability", f.Feature)
		}
	}
}

// --- self-protection ---

func TestHealthyDetectorStaysInService(t *testing.T) {
	m := NewMonitor(DefaultBaseline(), now)
	for i := 0; i < 300; i++ {
		m.Record(i%20 == 0) // 5%, exactly the baseline
	}
	state, reason := m.Evaluate(now)
	if state != Healthy {
		t.Fatalf("a detector behaving normally was %s: %s", state, reason)
	}
}

// Flagging everything is the visible failure: customers stopped, queue flooded.
func TestOverFlaggingFallsBack(t *testing.T) {
	m := NewMonitor(DefaultBaseline(), now)
	for i := 0; i < 300; i++ {
		m.Record(i%2 == 0) // 50% against an expected 5%
	}
	state, reason := m.Evaluate(now)
	if state != FallenBack {
		t.Fatalf("a detector stopping half of all payments was %s", state)
	}
	if reason == "" {
		t.Fatal("fell back with no explanation")
	}
}

// The dangerous one. A detector that has stopped detecting looks exactly like a
// calm day, and the first evidence is a fraud report weeks later.
func TestGoingQuietAlsoFallsBack(t *testing.T) {
	m := NewMonitor(DefaultBaseline(), now)
	for i := 0; i < 300; i++ {
		m.Record(false) // flagging nothing at all
	}
	state, reason := m.Evaluate(now)
	if state != FallenBack {
		t.Fatalf("a detector that stopped detecting was reported %s — a quiet system read as a healthy one", state)
	}
	fmt.Println("quiet-failure reason:", reason)
}

// A rate is not judged on a handful of payments, or every quiet hour produces a
// fallback.
func TestSmallSampleIsNotJudged(t *testing.T) {
	m := NewMonitor(DefaultBaseline(), now)
	for i := 0; i < 10; i++ {
		m.Record(true) // 100%, but only ten decisions
	}
	if state, _ := m.Evaluate(now); state != Healthy {
		t.Fatalf("a ten-payment window triggered %s", state)
	}
}

// A detector that reinstates itself has not been constrained by the fallback.
func TestRecoveryRequiresAnOperator(t *testing.T) {
	m := NewMonitor(DefaultBaseline(), now)
	for i := 0; i < 300; i++ {
		m.Record(true)
	}
	m.Evaluate(now)

	if err := m.Recover("", now); err == nil {
		t.Fatal("the detector returned itself to service with no operator recorded")
	}
	if err := m.Recover("risk.analyst@ephera.internal", now); err != nil {
		t.Fatalf("recovery by an operator failed: %v", err)
	}
	state, reason := m.State()
	if state != Healthy {
		t.Fatalf("state after recovery is %s", state)
	}
	if reason == "" {
		t.Fatal("recovery recorded no reason")
	}
}

// Recovering something that has not fallen back is refused, so "recover" cannot
// be used as a way to reset the window and hide a developing problem.
func TestRecoveringAHealthyDetectorIsRefused(t *testing.T) {
	m := NewMonitor(DefaultBaseline(), now)
	if err := m.Recover("ops@ephera.internal", now); err == nil {
		t.Fatal("a healthy detector accepted a recovery")
	}
}
