// Package fraud detects authorised push payment (APP) fraud.
//
// # Why this is the hard problem
//
// Every other control in this platform assumes an attacker who is not the
// customer: passkeys prove the device, transaction binding proves the amount,
// maker-checker proves two operators. APP fraud defeats all of it, because the
// customer genuinely authorised the payment. They were told their account was
// compromised and to move money to a "safe account"; they paid an invoice that
// had been intercepted; they sent money to someone they believed they were in a
// relationship with. The signature is valid. The consent is real. The money is
// still stolen.
//
// So this engine looks at a different question from the rest of the platform:
// not "did the account holder authorise this" but "does this look like someone
// being deceived".
//
// # Three design commitments
//
// 1. Explainable, not scored-and-shrugged. Every signal carries the observation
//    behind it. A customer stopped from paying deserves to be told what looked
//    wrong, and a reviewer needs to check it. A number between 0 and 100 with
//    no story is not a control anybody can act on or contest.
//
// 2. Tiered intervention, not a binary block. Blocking a legitimate payment has
//    a real cost borne by someone who did nothing wrong — a missed rent
//    payment, a stranded relative. Most detections should produce a targeted
//    warning naming the specific risk, because a well-aimed warning is what
//    actually breaks the spell of a social-engineering script. Blocking is for
//    the strongest evidence.
//
// 3. No claim of accuracy without data. These weights are reasoned, not
//    learned. There is no labelled fraud data in this platform, so the honest
//    position is that the ENGINE is testable and the WEIGHTS are provisional.
//    The scenario benchmark in this package exists so that changing them is
//    measurable rather than a matter of opinion.
package fraud

import (
	"fmt"
	"sort"
	"time"
)

// Band is the severity of the assessment.
type Band string

const (
	Clear   Band = "clear"
	Caution Band = "caution"
	High    Band = "high"
	Severe  Band = "severe"
)

// Intervention is what should happen to the customer, and it is deliberately
// not a straight function of "how suspicious" — it is a judgement about the
// cost of being wrong in each direction.
type Intervention string

const (
	// Allow: nothing stands out.
	Allow Intervention = "allow"
	// Warn: proceed, but interrupt with a warning naming the specific risk.
	// This is the intervention that actually works against social engineering,
	// because a generic "are you sure?" is ignored and a specific one is not.
	Warn Intervention = "effective_warning"
	// Hold: do not move money; a human reviews.
	Hold Intervention = "hold_for_review"
	// Block: refuse.
	Block Intervention = "block"
)

type Signal struct {
	Name        string `json:"name"`
	Weight      int    `json:"weight"`
	Observation string `json:"observation"`
}

type Assessment struct {
	Score        int          `json:"score"`
	Band         Band         `json:"band"`
	Signals      []Signal     `json:"signals"`
	Intervention Intervention `json:"intervention"`
	// Typology names the pattern this most resembles, when the combination of
	// signals matches a known one. It drives the wording of the warning: naming
	// the actual scam is what breaks the script.
	Typology string `json:"typology,omitempty"`
	// WarningText is what a customer should be shown, when an intervention
	// calls for it.
	WarningText string `json:"warningText,omitempty"`
}

// Profile is what the platform knows about how this customer normally behaves.
type Profile struct {
	AccountAgeDays        int
	TypicalPaymentMinor   int64 // the customer's usual payment size
	LargestEverMinor      int64
	PaymentsLast90d       int
	DistinctPayees90d     int
	AvailableBalanceMinor int64
	// UsualHours are the hours of day this customer normally transacts in.
	// Empty means unknown, which is treated as "no signal" rather than
	// "everything is unusual" — a new customer is not a suspicious one.
	UsualHours map[int]bool
}

// Payee is what the platform knows about the recipient.
type Payee struct {
	Name string
	// PaidByThisCustomerBefore is the single most useful fact in APP fraud:
	// almost all of it goes to someone the victim has never paid.
	PaidByThisCustomerBefore bool
	// AccountAgeDays is the recipient account's age. -1 when unknown.
	AccountAgeDays int
	// DistinctPayers7d is how many different people have paid this account in a
	// week. High fan-in on a young account is the classic mule signature.
	DistinctPayers7d int
	// PriorPaymentsFromThisCustomer counts previous payments, used to spot
	// escalation to a payee only recently established.
	PriorPaymentsFromThisCustomer int
}

type Payment struct {
	AmountMinor int64
	At          time.Time
	// FirstPaidPayeeDaysAgo is how long ago this customer first paid this
	// payee. -1 when never.
	FirstPaidPayeeDaysAgo int
}

// Weights are provisional and deliberately visible. They are reasoned from
// published APP fraud typologies, not learned from labelled data, and the
// scenario benchmark exists so that changing them can be measured.
type Weights struct {
	NewPayee              int
	NewPayeeHighValue     int
	YoungPayeeAccount     int
	MuleFanIn             int
	DrainsBalance         int
	FarAboveNormal        int
	UnusualHour           int
	DormantThenLarge      int
	RapidEscalation       int
	FirstPaymentVeryLarge int
}

func DefaultWeights() Weights {
	return Weights{
		NewPayee:              10,
		NewPayeeHighValue:     25,
		YoungPayeeAccount:     20,
		MuleFanIn:             30,
		DrainsBalance:         25,
		FarAboveNormal:        20,
		UnusualHour:           10,
		DormantThenLarge:      15,
		RapidEscalation:       20,
		FirstPaymentVeryLarge: 15,
	}
}

// Assess scores a payment against the customer's own behaviour and what is
// known about the payee.
func Assess(p Payment, profile Profile, payee Payee, w Weights) Assessment {
	var signals []Signal
	add := func(name string, weight int, format string, args ...any) {
		signals = append(signals, Signal{
			Name: name, Weight: weight, Observation: fmt.Sprintf(format, args...),
		})
	}

	newPayee := !payee.PaidByThisCustomerBefore

	// An established relationship damps the size signals.
	//
	// The benchmark caught this: rent to a landlord paid eighteen times over
	// eighteen months was flagged purely for being large. Paying a payee you
	// have paid for years more than usual is ordinary life — school fees, rent,
	// a deposit. Size is only informative about a payee you do not have a
	// history with. "Established" needs both repetition and age, so that a
	// relationship a fraudster built last fortnight does not qualify.
	established := payee.PaidByThisCustomerBefore &&
		payee.PriorPaymentsFromThisCustomer >= 3 &&
		p.FirstPaidPayeeDaysAgo >= 60

	if newPayee {
		add("new_payee", w.NewPayee, "first payment to %s", payee.Name)
	}

	// Size relative to this customer, not to an absolute threshold. A large
	// payment is only notable if it is large *for them*.
	if profile.TypicalPaymentMinor > 0 && !established {
		ratio := float64(p.AmountMinor) / float64(profile.TypicalPaymentMinor)
		if ratio >= 5 {
			add("far_above_normal", w.FarAboveNormal,
				"%.0fx this customer's usual payment size", ratio)
		}
		if newPayee && ratio >= 3 {
			add("new_payee_high_value", w.NewPayeeHighValue,
				"first payment to this payee is %.0fx their usual size", ratio)
		}
	}
	if profile.LargestEverMinor > 0 && !established && p.AmountMinor > profile.LargestEverMinor*2 {
		add("first_payment_very_large", w.FirstPaymentVeryLarge,
			"more than double the largest payment this customer has ever made")
	}

	// A young recipient account, and high fan-in onto it, are the two facts
	// that most reliably distinguish a mule from an ordinary new payee.
	if payee.AccountAgeDays >= 0 && payee.AccountAgeDays <= 30 {
		add("young_payee_account", w.YoungPayeeAccount,
			"recipient account is %d days old", payee.AccountAgeDays)
	}
	// Fan-in is a mule signal only on a young account.
	//
	// The benchmark caught this too: a school receiving payments from thirty
	// parents in a week scored as a collection point. Shops, schools, landlords
	// and utilities all have high fan-in by design — it is what a legitimate
	// business looks like. What distinguishes a mule is fan-in onto an account
	// that did not exist a month ago. An account of unknown age does not
	// qualify: we will not assert a destination is criminal on a fact we do not
	// have.
	if payee.DistinctPayers7d >= 5 && payee.AccountAgeDays >= 0 && payee.AccountAgeDays <= 90 {
		add("mule_fan_in", w.MuleFanIn,
			"%d different people have paid this %d-day-old account in the last 7 days",
			payee.DistinctPayers7d, payee.AccountAgeDays)
	}

	// Emptying an account is characteristic of the "move your money to a safe
	// account" script, which asks for everything rather than an amount.
	if profile.AvailableBalanceMinor > 0 {
		share := float64(p.AmountMinor) / float64(profile.AvailableBalanceMinor)
		if share >= 0.9 {
			add("drains_balance", w.DrainsBalance,
				"leaves %.0f%% of the available balance", (1-share)*100)
		}
	}

	// Hour-of-day only counts when there is a baseline to compare against.
	if len(profile.UsualHours) > 0 && !profile.UsualHours[p.At.Hour()] {
		add("unusual_hour", w.UnusualHour,
			"sent at %02d:00; this customer normally transacts at other times", p.At.Hour())
	}

	if profile.PaymentsLast90d == 0 && profile.AccountAgeDays > 90 && p.AmountMinor > 0 {
		add("dormant_then_large", w.DormantThenLarge,
			"first payment in 90 days on an account %d days old", profile.AccountAgeDays)
	}

	// Escalation to a payee established only days ago is the romance and
	// investment pattern: a small payment to build trust, then larger ones.
	if payee.PriorPaymentsFromThisCustomer > 0 &&
		p.FirstPaidPayeeDaysAgo >= 0 && p.FirstPaidPayeeDaysAgo <= 30 &&
		profile.TypicalPaymentMinor > 0 &&
		float64(p.AmountMinor) >= 3*float64(profile.TypicalPaymentMinor) {
		add("rapid_escalation", w.RapidEscalation,
			"payments to this payee began %d days ago and have grown sharply",
			p.FirstPaidPayeeDaysAgo)
	}

	score := 0
	for _, s := range signals {
		score += s.Weight
	}
	if score > 100 {
		score = 100
	}
	sort.SliceStable(signals, func(i, j int) bool { return signals[i].Weight > signals[j].Weight })

	band := bandFor(score)
	typology, warning := classify(signals, band)

	return Assessment{
		Score:        score,
		Band:         band,
		Signals:      signals,
		Intervention: interventionFor(band, typology),
		Typology:     typology,
		WarningText:  warning,
	}
}

func bandFor(score int) Band {
	switch {
	case score >= 70:
		return Severe
	case score >= 45:
		return High
	case score >= 20:
		return Caution
	default:
		return Clear
	}
}

// interventionFor decides what happens to the customer.
//
// Only the mule pattern blocks outright: a young account collecting money from
// many different people in a week is not a judgement about the customer's
// intentions, it is a fact about the destination, and paying it is very likely
// to lose the money for good. Everything else warns or holds, because the cost
// of stopping a legitimate payment falls on someone who did nothing wrong.
func interventionFor(band Band, typology string) Intervention {
	if typology == "mule_account" {
		return Block
	}
	switch band {
	case Severe:
		return Hold
	case High:
		return Warn
	case Caution:
		return Warn
	default:
		return Allow
	}
}

func has(signals []Signal, name string) bool {
	for _, s := range signals {
		if s.Name == name {
			return true
		}
	}
	return false
}

// classify names the pattern and writes the warning.
//
// Naming the specific scam is the point. Published work on APP fraud is
// consistent that generic confirmation prompts are ignored — customers click
// through them while the fraudster talks them through it — and that warnings
// naming the actual scenario are what interrupt the script.
func classify(signals []Signal, band Band) (string, string) {
	switch {
	case has(signals, "mule_fan_in") && has(signals, "young_payee_account"):
		return "mule_account", "This account was opened very recently and is receiving money from many different people in a short time. That is what a money-mule account looks like. We are not sending this payment."

	case has(signals, "drains_balance") && has(signals, "new_payee") &&
		(has(signals, "far_above_normal") || has(signals, "new_payee_high_value")):
		return "safe_account_impersonation", "You are about to send almost everything in your account to someone you have never paid. No bank, police force or official will ever ask you to move money to a “safe account”. If someone has told you to make this payment, stop and call the organisation back on a number you find yourself."

	case has(signals, "rapid_escalation"):
		return "escalating_relationship", "Your payments to this person started recently and are growing quickly. This is the pattern of romance and investment scams. If you have not met this person face to face, or they have promised returns, please stop and talk to someone you trust."

	case has(signals, "new_payee_high_value") && has(signals, "young_payee_account"):
		return "redirected_payment", "This is a large first payment to a recently opened account. If you are paying an invoice or bank details you received by email or message, call the supplier on a number you already had and check the details before paying."

	case band == Clear:
		return "", ""

	default:
		return "", "This payment is unusual for your account. If someone has asked you to make it, or is with you now, please stop and check independently before continuing."
	}
}
