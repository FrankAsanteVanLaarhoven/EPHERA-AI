package detect

import (
	"fmt"
	"sync"
	"time"
)

// Self-protection for a detector that has no ground truth.
//
// A detector with no labels cannot tell whether it is right. It can, however,
// tell when it has started behaving unlike itself — flagging far more than
// usual, or suddenly flagging nothing — and either is a reason to stop trusting
// it before customers pay for the mistake.
//
// Both directions matter, and they fail differently:
//
//   - Flagging everything is visible immediately. Customers are stopped, the
//     review queue floods, and someone notices within the hour.
//   - Flagging nothing is invisible. Payments flow, no queue builds, and the
//     first evidence is a fraud report weeks later. This is the more dangerous
//     failure and the one a naive alert-rate monitor misses, because a quiet
//     system looks like a healthy one.
//
// So both are treated as degradation, and the response is the same: revert to
// the last configuration known to behave, refuse to promote anything on its
// own, and tell a human.

type State string

const (
	Healthy    State = "healthy"
	Degraded   State = "degraded"
	FallenBack State = "fallen_back"
)

// Baseline is what "behaving normally" looks like for this detector, measured
// while a human considered it to be working.
type Baseline struct {
	// ExpectedFlagRate is the share of payments the detector normally flags.
	ExpectedFlagRate float64
	// Tolerance is how far it may move before that counts as degradation, as a
	// multiple in either direction. 3 means "more than 3x or less than a third".
	Tolerance float64
	// MinSample is how many decisions are needed before the rate is judged.
	// Judging a rate on a handful of payments produces a fallback every quiet
	// hour.
	MinSample int
}

func DefaultBaseline() Baseline {
	return Baseline{ExpectedFlagRate: 0.05, Tolerance: 3, MinSample: 200}
}

type Monitor struct {
	mu       sync.Mutex
	baseline Baseline
	decided  int
	flagged  int
	state    State
	reason   string
	since    time.Time
}

func NewMonitor(b Baseline, now time.Time) *Monitor {
	return &Monitor{baseline: b, state: Healthy, since: now}
}

// Record one decision.
func (m *Monitor) Record(flagged bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.decided++
	if flagged {
		m.flagged++
	}
}

// Evaluate judges the window and returns the state. A caller runs this
// periodically and acts on a change.
func (m *Monitor) Evaluate(now time.Time) (State, string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.decided < m.baseline.MinSample {
		return m.state, fmt.Sprintf(
			"%d decisions in this window; %d needed before the rate is judged",
			m.decided, m.baseline.MinSample)
	}

	rate := float64(m.flagged) / float64(m.decided)
	upper := m.baseline.ExpectedFlagRate * m.baseline.Tolerance
	lower := m.baseline.ExpectedFlagRate / m.baseline.Tolerance

	switch {
	case rate > upper:
		m.state, m.since = FallenBack, now
		m.reason = fmt.Sprintf(
			"flagging %.1f%% of payments against an expected %.1f%%; customers are being stopped at %.0fx the normal rate",
			rate*100, m.baseline.ExpectedFlagRate*100, rate/m.baseline.ExpectedFlagRate)
	case rate < lower:
		// The quiet failure. A detector that has stopped detecting looks
		// exactly like a calm day.
		m.state, m.since = FallenBack, now
		m.reason = fmt.Sprintf(
			"flagging %.1f%% against an expected %.1f%%; a detector that has gone quiet is indistinguishable from a quiet day and must not be assumed healthy",
			rate*100, m.baseline.ExpectedFlagRate*100)
	default:
		m.state = Healthy
		m.reason = fmt.Sprintf("flagging %.1f%% against an expected %.1f%%",
			rate*100, m.baseline.ExpectedFlagRate*100)
	}

	m.decided, m.flagged = 0, 0
	return m.state, m.reason
}

func (m *Monitor) State() (State, string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state, m.reason
}

// Recover returns the detector to service. It is deliberately explicit and
// takes an operator: a detector that reinstates itself after falling back has
// not been constrained by the fallback at all, and the second failure would
// look exactly like the first.
func (m *Monitor) Recover(operator string, now time.Time) error {
	if operator == "" {
		return fmt.Errorf("recovery must record which operator authorised it")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.state != FallenBack {
		return fmt.Errorf("detector is %s, not fallen back", m.state)
	}
	m.state, m.since = Healthy, now
	m.reason = "returned to service by " + operator
	m.decided, m.flagged = 0, 0
	return nil
}
