// Package monitoring looks at a customer's recent behaviour rather than at one
// payment in isolation.
//
// The rules in `risk` answer "is this payment allowed". They cannot see the
// shape of a sequence, and the patterns that matter most in practice only exist
// across payments: a series of amounts sitting just under a reporting
// threshold, a burst of payments in a few minutes, funds arriving and being
// pushed straight out to many different people.
//
// Two design choices worth stating.
//
// First, these rules raise alerts and hold for review; they do not deny.
// Behaviour is suggestive, not conclusive — a customer paying eleven different
// people in an hour might be settling a group holiday. Denying on a pattern
// punishes the innocent case, and holding gives a human the chance to look.
//
// Second, every alert carries the observation that produced it. "Structuring"
// on its own is an accusation; "six payments between 9,000 and 10,000 within
// 24 hours" is something an analyst can check and a customer can answer.
package monitoring

import (
	"fmt"
	"time"
)

// Payment is one prior allowed payment, oldest or newest order-independent.
type Payment struct {
	AmountMinor int64
	Recipient   string
	At          time.Time
}

type Alert struct {
	Rule        string `json:"rule"`
	Observation string `json:"observation"`
}

// Thresholds are the tunables. They are a struct rather than constants so a
// deployment can set them from configuration and a test can be explicit about
// what it is exercising.
type Thresholds struct {
	// ReportingThresholdMinor is the value a payment would be reported at.
	// Structuring is the practice of staying just below it.
	ReportingThresholdMinor int64
	// StructuringBandFraction is how far below the threshold still counts as
	// "just under". 0.15 means 85%–100% of the threshold.
	StructuringBandFraction float64
	// StructuringMinCount is how many such payments within the window matter.
	StructuringMinCount int
	StructuringWindow   time.Duration

	// VelocityMaxCount payments within VelocityWindow is unusual.
	VelocityMaxCount int
	VelocityWindow   time.Duration

	// DispersalMinRecipients distinct recipients within DispersalWindow
	// suggests funds being spread rather than spent.
	DispersalMinRecipients int
	DispersalWindow        time.Duration
}

func DefaultThresholds() Thresholds {
	return Thresholds{
		ReportingThresholdMinor: 1_000_000, // 10,000 major units
		StructuringBandFraction: 0.15,
		StructuringMinCount:     3,
		StructuringWindow:       24 * time.Hour,
		VelocityMaxCount:        10,
		VelocityWindow:          time.Hour,
		DispersalMinRecipients:  8,
		DispersalWindow:         time.Hour,
	}
}

// Evaluate returns the alerts raised by this payment in the context of recent
// history. History should contain only payments that were allowed: a refused
// attempt says something about the customer's intent but nothing about the
// movement of money, and mixing them would make every alert unexplainable.
func Evaluate(now time.Time, candidate Payment, history []Payment, t Thresholds) []Alert {
	alerts := []Alert{}

	// Structuring: payments clustered just below the reporting threshold.
	if t.ReportingThresholdMinor > 0 && t.StructuringMinCount > 0 {
		floor := int64(float64(t.ReportingThresholdMinor) * (1 - t.StructuringBandFraction))
		inBand := 0
		if isJustUnder(candidate.AmountMinor, floor, t.ReportingThresholdMinor) {
			inBand++
		}
		for _, p := range history {
			if now.Sub(p.At) <= t.StructuringWindow &&
				isJustUnder(p.AmountMinor, floor, t.ReportingThresholdMinor) {
				inBand++
			}
		}
		if inBand >= t.StructuringMinCount {
			alerts = append(alerts, Alert{
				Rule: "possible_structuring",
				Observation: fmt.Sprintf(
					"%d payments between %d and %d within %s",
					inBand, floor, t.ReportingThresholdMinor, t.StructuringWindow),
			})
		}
	}

	// Velocity: an unusual number of payments in a short window.
	if t.VelocityMaxCount > 0 {
		count := 1
		for _, p := range history {
			if now.Sub(p.At) <= t.VelocityWindow {
				count++
			}
		}
		if count > t.VelocityMaxCount {
			alerts = append(alerts, Alert{
				Rule: "unusual_velocity",
				Observation: fmt.Sprintf("%d payments within %s (threshold %d)",
					count, t.VelocityWindow, t.VelocityMaxCount),
			})
		}
	}

	// Dispersal: funds spread across many distinct recipients quickly.
	if t.DispersalMinRecipients > 0 {
		seen := map[string]bool{candidate.Recipient: true}
		for _, p := range history {
			if now.Sub(p.At) <= t.DispersalWindow {
				seen[p.Recipient] = true
			}
		}
		if len(seen) >= t.DispersalMinRecipients {
			alerts = append(alerts, Alert{
				Rule: "rapid_dispersal",
				Observation: fmt.Sprintf("%d distinct recipients within %s",
					len(seen), t.DispersalWindow),
			})
		}
	}

	return alerts
}

// isJustUnder reports whether an amount sits in the band below the threshold.
// The threshold itself is not "just under" — a payment at or above it is
// reported, which is the behaviour structuring exists to avoid.
func isJustUnder(amount, floor, threshold int64) bool {
	return amount >= floor && amount < threshold
}
