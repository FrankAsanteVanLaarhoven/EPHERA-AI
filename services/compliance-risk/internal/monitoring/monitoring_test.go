package monitoring

import (
	"strings"
	"testing"
	"time"
)

var now = time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)

func ago(d time.Duration) time.Time { return now.Add(-d) }

func hasRule(alerts []Alert, rule string) bool {
	for _, a := range alerts {
		if a.Rule == rule {
			return true
		}
	}
	return false
}

func TestOrdinaryBehaviourRaisesNothing(t *testing.T) {
	alerts := Evaluate(now,
		Payment{AmountMinor: 5_000, Recipient: "ama", At: now},
		[]Payment{
			{AmountMinor: 2_000, Recipient: "kofi", At: ago(3 * time.Hour)},
			{AmountMinor: 7_500, Recipient: "ama", At: ago(20 * time.Hour)},
		},
		DefaultThresholds())
	if len(alerts) != 0 {
		t.Fatalf("expected no alerts, got %v", alerts)
	}
}

// The classic pattern: amounts sitting just below the reporting threshold.
func TestStructuringIsDetected(t *testing.T) {
	th := DefaultThresholds() // threshold 1,000,000; band from 850,000
	history := []Payment{
		{AmountMinor: 900_000, Recipient: "a", At: ago(2 * time.Hour)},
		{AmountMinor: 950_000, Recipient: "b", At: ago(5 * time.Hour)},
	}
	alerts := Evaluate(now, Payment{AmountMinor: 990_000, Recipient: "c", At: now}, history, th)
	if !hasRule(alerts, "possible_structuring") {
		t.Fatalf("structuring not detected: %v", alerts)
	}
	// The alert must carry what was observed, not just a label.
	for _, a := range alerts {
		if a.Rule == "possible_structuring" && !strings.Contains(a.Observation, "3 payments") {
			t.Fatalf("observation does not say what was seen: %q", a.Observation)
		}
	}
}

// A payment at or above the threshold is reported, so it is not structuring.
// Counting it would make the rule fire on customers behaving openly.
func TestPaymentsAtOrAboveTheThresholdAreNotStructuring(t *testing.T) {
	th := DefaultThresholds()
	history := []Payment{
		{AmountMinor: 1_000_000, Recipient: "a", At: ago(time.Hour)},
		{AmountMinor: 1_200_000, Recipient: "b", At: ago(2 * time.Hour)},
	}
	alerts := Evaluate(now, Payment{AmountMinor: 1_500_000, Recipient: "c", At: now}, history, th)
	if hasRule(alerts, "possible_structuring") {
		t.Fatalf("open payments were called structuring: %v", alerts)
	}
}

// Amounts well below the threshold are ordinary spending, not avoidance.
func TestSmallPaymentsAreNotStructuring(t *testing.T) {
	th := DefaultThresholds()
	history := []Payment{
		{AmountMinor: 5_000, Recipient: "a", At: ago(time.Hour)},
		{AmountMinor: 6_000, Recipient: "b", At: ago(2 * time.Hour)},
	}
	alerts := Evaluate(now, Payment{AmountMinor: 4_000, Recipient: "c", At: now}, history, th)
	if hasRule(alerts, "possible_structuring") {
		t.Fatalf("ordinary spending was called structuring: %v", alerts)
	}
}

// History outside the window is not evidence of a current pattern.
func TestStructuringWindowIsRespected(t *testing.T) {
	th := DefaultThresholds()
	history := []Payment{
		{AmountMinor: 900_000, Recipient: "a", At: ago(48 * time.Hour)},
		{AmountMinor: 950_000, Recipient: "b", At: ago(72 * time.Hour)},
	}
	alerts := Evaluate(now, Payment{AmountMinor: 990_000, Recipient: "c", At: now}, history, th)
	if hasRule(alerts, "possible_structuring") {
		t.Fatalf("stale history triggered an alert: %v", alerts)
	}
}

func TestUnusualVelocityIsDetected(t *testing.T) {
	th := DefaultThresholds() // more than 10 in an hour
	history := make([]Payment, 0, 12)
	for i := 0; i < 12; i++ {
		history = append(history, Payment{
			AmountMinor: 1_000, Recipient: "r", At: ago(time.Duration(i) * time.Minute),
		})
	}
	alerts := Evaluate(now, Payment{AmountMinor: 1_000, Recipient: "r", At: now}, history, th)
	if !hasRule(alerts, "unusual_velocity") {
		t.Fatalf("velocity not detected: %v", alerts)
	}
}

func TestRapidDispersalIsDetected(t *testing.T) {
	th := DefaultThresholds() // 8 distinct recipients in an hour
	history := []Payment{}
	for _, r := range []string{"a", "b", "c", "d", "e", "f", "g"} {
		history = append(history, Payment{AmountMinor: 1_000, Recipient: r, At: ago(10 * time.Minute)})
	}
	alerts := Evaluate(now, Payment{AmountMinor: 1_000, Recipient: "h", At: now}, history, th)
	if !hasRule(alerts, "rapid_dispersal") {
		t.Fatalf("dispersal not detected: %v", alerts)
	}
}

// Paying the same person repeatedly is not dispersal.
func TestRepeatedPaymentsToOnePersonAreNotDispersal(t *testing.T) {
	th := DefaultThresholds()
	history := []Payment{}
	for i := 0; i < 9; i++ {
		history = append(history, Payment{AmountMinor: 1_000, Recipient: "same", At: ago(time.Duration(i) * time.Minute)})
	}
	alerts := Evaluate(now, Payment{AmountMinor: 1_000, Recipient: "same", At: now}, history, th)
	if hasRule(alerts, "rapid_dispersal") {
		t.Fatalf("repeated payments to one person called dispersal: %v", alerts)
	}
}

// Several patterns can hold at once, and each is reported separately so an
// analyst sees every reason rather than the first one.
func TestMultiplePatternsAreAllReported(t *testing.T) {
	th := DefaultThresholds()
	history := []Payment{}
	for i, r := range []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"} {
		history = append(history, Payment{
			AmountMinor: 900_000, Recipient: r, At: ago(time.Duration(i) * time.Minute),
		})
	}
	alerts := Evaluate(now, Payment{AmountMinor: 950_000, Recipient: "z", At: now}, history, th)
	for _, rule := range []string{"possible_structuring", "unusual_velocity", "rapid_dispersal"} {
		if !hasRule(alerts, rule) {
			t.Fatalf("%s missing from %v", rule, alerts)
		}
	}
}

// Every alert must say what was observed. A label alone is an accusation an
// analyst cannot check and a customer cannot answer.
func TestEveryAlertCarriesItsObservation(t *testing.T) {
	th := DefaultThresholds()
	history := []Payment{}
	for i := 0; i < 12; i++ {
		history = append(history, Payment{
			AmountMinor: 900_000, Recipient: string(rune('a' + i)), At: ago(time.Duration(i) * time.Minute),
		})
	}
	alerts := Evaluate(now, Payment{AmountMinor: 950_000, Recipient: "z", At: now}, history, th)
	if len(alerts) == 0 {
		t.Fatal("expected alerts")
	}
	for _, a := range alerts {
		if strings.TrimSpace(a.Observation) == "" {
			t.Fatalf("alert %q carries no observation", a.Rule)
		}
	}
}
