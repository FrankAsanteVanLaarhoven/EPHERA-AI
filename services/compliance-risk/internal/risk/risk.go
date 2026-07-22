// Package risk decides whether a payment may proceed.
//
// The decision is deterministic and every outcome carries its reasons, because
// a refusal has to be explainable to the customer who was refused and to an
// examiner asking why. A rule that cannot be explained is not a control.
//
// Three things are checked, in order of severity:
//
//  1. Customer standing — blocked or under review beats everything else.
//  2. Screening — a sanctions match denies; a politically-exposed-person match
//     goes to review rather than denying, because being a public official is
//     not itself wrongdoing.
//  3. Limits — single-transaction, daily velocity, and a tighter ceiling for a
//     recipient the customer has not paid before.
package risk

import (
	"fmt"
	"strings"
)

type Outcome string

const (
	// Allow: the payment may proceed.
	Allow Outcome = "allow"
	// Review: hold for a human. Money does not move until a case is cleared.
	Review Outcome = "review"
	// Deny: refuse outright.
	Deny Outcome = "deny"
)

type Tier struct {
	Name                   string
	Rank                   int
	DailyLimitMinor        int64
	SingleLimitMinor       int64
	NewRecipientLimitMinor int64
}

// Input is everything the decision depends on. It is explicit rather than
// fetched inside the engine so the rules stay pure and testable.
type Input struct {
	Subject        string
	CustomerStatus string // active | under_review | blocked
	Tier           Tier
	AmountMinor    int64
	Currency       string
	RecipientName  string
	// SpentTodayMinor is the total already sent today, excluding this payment.
	SpentTodayMinor int64
	// KnownRecipient is false the first time a customer pays someone.
	KnownRecipient bool
	// ScreeningHits are matches against the screening list, by category.
	ScreeningHits []ScreeningHit
}

type ScreeningHit struct {
	Category string // sanctions | pep | adverse_media
	Name     string
	Source   string
}

type Decision struct {
	Outcome Outcome  `json:"outcome"`
	Reasons []string `json:"reasons"`
	// RemainingDailyMinor is what would be left if this payment proceeded.
	RemainingDailyMinor int64 `json:"remainingDailyMinor"`
}

// Evaluate applies the rules. It never returns Allow with reasons that would
// have denied: the most severe outcome wins, and every triggered rule is
// reported so the customer is told everything that is wrong at once rather than
// discovering it one refusal at a time.
func Evaluate(in Input) Decision {
	var reasons []string
	outcome := Allow

	escalate := func(to Outcome, reason string) {
		reasons = append(reasons, reason)
		if severity(to) > severity(outcome) {
			outcome = to
		}
	}

	switch in.CustomerStatus {
	case "blocked":
		escalate(Deny, "customer_blocked")
	case "under_review":
		escalate(Review, "customer_under_review")
	}

	for _, hit := range in.ScreeningHits {
		switch hit.Category {
		case "sanctions":
			escalate(Deny, "sanctions_match:"+hit.Name)
		case "pep":
			// Being a politically exposed person is not wrongdoing. It calls for
			// a look, not a refusal.
			escalate(Review, "pep_match:"+hit.Name)
		case "adverse_media":
			escalate(Review, "adverse_media_match:"+hit.Name)
		}
	}

	if in.AmountMinor <= 0 {
		escalate(Deny, "non_positive_amount")
	}

	if in.Tier.Rank == 0 || in.Tier.SingleLimitMinor == 0 {
		escalate(Deny, fmt.Sprintf("tier_cannot_send:%s", in.Tier.Name))
	} else {
		if in.AmountMinor > in.Tier.SingleLimitMinor {
			escalate(Deny, fmt.Sprintf("over_single_limit:%d>%d",
				in.AmountMinor, in.Tier.SingleLimitMinor))
		}
		if in.SpentTodayMinor+in.AmountMinor > in.Tier.DailyLimitMinor {
			escalate(Deny, fmt.Sprintf("over_daily_limit:%d+%d>%d",
				in.SpentTodayMinor, in.AmountMinor, in.Tier.DailyLimitMinor))
		}
		if !in.KnownRecipient && in.AmountMinor > in.Tier.NewRecipientLimitMinor {
			// A first payment to someone new is the classic shape of an
			// authorised-push-payment fraud, so it gets a lower ceiling and a
			// look rather than an outright refusal.
			escalate(Review, fmt.Sprintf("over_new_recipient_limit:%d>%d",
				in.AmountMinor, in.Tier.NewRecipientLimitMinor))
		}
	}

	remaining := in.Tier.DailyLimitMinor - in.SpentTodayMinor - in.AmountMinor
	if remaining < 0 {
		remaining = 0
	}
	if reasons == nil {
		reasons = []string{}
	}
	return Decision{Outcome: outcome, Reasons: reasons, RemainingDailyMinor: remaining}
}

func severity(o Outcome) int {
	switch o {
	case Deny:
		return 2
	case Review:
		return 1
	default:
		return 0
	}
}

// NormaliseName prepares a name for screening comparison. Matching is
// deliberately simple and documented: case-folded, whitespace-collapsed exact
// comparison. Real screening uses fuzzy matching against a licensed list, and
// pretending otherwise would be the same error as the connect-layer's fake
// cryptography.
func NormaliseName(name string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(name))), " ")
}
