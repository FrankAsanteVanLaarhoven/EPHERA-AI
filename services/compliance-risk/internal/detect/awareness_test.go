package detect

import (
	"testing"
	"time"
)

func obsAt(amountBand, payee, hour string, at time.Time) Observation {
	return Observation{Features: []Feature{
		{Name: "amount_band", Value: amountBand},
		{Name: "payee_type", Value: payee},
		{Name: "hour_band", Value: hour},
	}, At: at}
}

// A population big enough to make confident rarity claims.
func awarePopulation() *Population {
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

// An ordinary payment is no situation at all.
func TestOrdinaryPaymentHasNoPriority(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)
	s := a.Assess(obs("small", "known", "day"))
	if s.Rare || s.Priority != PriorityNone {
		t.Fatalf("an ordinary payment produced a situation: rare=%v priority=%s", s.Rare, s.Priority)
	}
}

// A single rare, novel payment: elevated, isolated, and it names what to look at.
func TestIsolatedNovelRareEventIsElevated(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)
	// One novel feature (an unseen amount band) with ordinary payee/hour: rare,
	// but not extreme — the situation is elevated, not high.
	s := a.Assess(obsAt("huge", "known", "day", now))
	if !s.Rare {
		t.Fatalf("an unseen amount band was not rare (%.1f bits)", s.Surprisal)
	}
	if !s.Novel {
		t.Fatal("a never-before-seen value was not marked novel")
	}
	if s.ClusterSize != 1 {
		t.Fatalf("an isolated event had cluster size %d", s.ClusterSize)
	}
	if s.Priority != PriorityElevated {
		t.Fatalf("an isolated novel rare event was %s, expected elevated", s.Priority)
	}
	if s.Lead.Feature.Name != "amount_band" {
		t.Fatalf("the lead finding was %q, expected amount_band", s.Lead.Feature.Name)
	}
	if s.Narrative == "" {
		t.Fatal("no narrative produced")
	}
}

// A burst of similar rare payments is a different, higher situation than one.
func TestBurstOfSimilarRareEventsBecomesHigh(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)

	s1 := a.Assess(obsAt("huge", "known", "day", now))
	s2 := a.Assess(obsAt("huge", "known", "day", now.Add(1*time.Minute)))
	s3 := a.Assess(obsAt("huge", "known", "day", now.Add(2*time.Minute)))

	if s1.ClusterSize != 1 || s2.ClusterSize != 2 || s3.ClusterSize != 3 {
		t.Fatalf("cluster sizes were %d, %d, %d; expected 1, 2, 3", s1.ClusterSize, s2.ClusterSize, s3.ClusterSize)
	}
	if s3.Priority != PriorityHigh {
		t.Fatalf("a burst at the threshold was %s, expected high", s3.Priority)
	}
	// The second (no longer novel) is elevated because a cluster is forming.
	if s2.Novel {
		t.Fatal("the second occurrence of the same value was still marked novel")
	}
	if s2.Priority != PriorityElevated {
		t.Fatalf("a forming cluster was %s, expected elevated", s2.Priority)
	}
}

// Events outside the window do not count toward a cluster.
func TestRareEventsOutsideTheWindowDoNotCluster(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)
	a.Assess(obsAt("huge", "known", "day", now))
	// 20 minutes later, outside the 10-minute window: the earlier event is pruned.
	s := a.Assess(obsAt("huge", "known", "day", now.Add(20*time.Minute)))
	if s.ClusterSize != 1 {
		t.Fatalf("an event outside the window still clustered: size %d", s.ClusterSize)
	}
}

// No confident situation is built below the minimum population.
func TestNoSituationBelowMinimumPopulation(t *testing.T) {
	p := NewPopulation()
	for i := 0; i < 50; i++ {
		p.Observe(obs("small", "known", "day"))
	}
	a := NewAwareness(p, 8, 10*time.Minute, 3)
	s := a.Assess(obsAt("huge", "new", "night", now))
	if s.Confident {
		t.Fatal("a confident situation was built from 50 observations")
	}
	if s.Priority != PriorityNone {
		t.Fatalf("a low-population observation was prioritised %s", s.Priority)
	}
	if s.Reason == "" {
		t.Fatal("no reason given for withholding the claim")
	}
}

// The live view across all rare clusters in the window, most active first.
func TestActiveClustersSummary(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)
	a.Assess(obsAt("huge", "new", "night", now))
	a.Assess(obsAt("huge", "new", "night", now.Add(1*time.Minute)))
	a.Assess(obsAt("unheard_of", "known", "day", now.Add(2*time.Minute)))

	clusters := a.ActiveClusters(now.Add(3 * time.Minute))
	if len(clusters) == 0 {
		t.Fatal("no active clusters reported after a burst")
	}
	// Most active first: amount_band=huge (2) before the single unheard_of.
	if clusters[0].Count < 2 {
		t.Fatalf("the busiest cluster reported count %d", clusters[0].Count)
	}
}

// An extremely rare single event — several unusual features at once — is high
// priority even with no cluster, because how unusual it is carries the weight.
func TestExtremelyRareEventIsHighEvenIsolated(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)
	s := a.Assess(obsAt("huge", "new", "night", now))
	if s.ClusterSize != 1 {
		t.Fatalf("precondition: expected an isolated event, cluster %d", s.ClusterSize)
	}
	if s.Priority != PriorityHigh {
		t.Fatalf("an extremely rare isolated event was %s (%.1f bits), expected high",
			s.Priority, s.Surprisal)
	}
}

// The activation hook fires for rare situations and stays silent for ordinary
// ones — the seam a deployment uses to log or alert.
func TestActivationHookFiresOnlyForRare(t *testing.T) {
	a := NewAwareness(awarePopulation(), 8, 10*time.Minute, 3)
	var fired []Situation
	a.OnRare = func(s Situation) { fired = append(fired, s) }

	a.Assess(obs("small", "known", "day"))       // ordinary
	a.Assess(obsAt("huge", "known", "day", now)) // rare

	if len(fired) != 1 {
		t.Fatalf("hook fired %d times, expected once (only the rare event)", len(fired))
	}
	if !fired[0].Rare || fired[0].Narrative == "" {
		t.Fatal("the hook received a situation with no rarity or narrative")
	}
}
