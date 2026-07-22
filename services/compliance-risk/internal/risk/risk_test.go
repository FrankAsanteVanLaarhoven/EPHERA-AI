package risk

import (
	"strings"
	"testing"
)

func verified() Tier {
	return Tier{
		Name: "verified", Rank: 2,
		DailyLimitMinor: 500_000, SingleLimitMinor: 200_000, NewRecipientLimitMinor: 50_000,
	}
}

func base(in Input) Input {
	if in.CustomerStatus == "" {
		in.CustomerStatus = "active"
	}
	if in.Tier.Name == "" {
		in.Tier = verified()
	}
	if in.Currency == "" {
		in.Currency = "GHS"
	}
	if in.RecipientName == "" {
		in.RecipientName = "Ama Mensah"
	}
	return in
}

func hasReason(d Decision, prefix string) bool {
	for _, r := range d.Reasons {
		if strings.HasPrefix(r, prefix) {
			return true
		}
	}
	return false
}

func TestOrdinaryPaymentIsAllowed(t *testing.T) {
	d := Evaluate(base(Input{AmountMinor: 25_000, KnownRecipient: true}))
	if d.Outcome != Allow {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
	if d.RemainingDailyMinor != 475_000 {
		t.Fatalf("remaining %d", d.RemainingDailyMinor)
	}
}

// D-33. An unverified customer cannot send at all, which is the point of a tier
// the customer cannot set for themselves.
func TestUnverifiedTierCannotSend(t *testing.T) {
	d := Evaluate(base(Input{
		AmountMinor: 100,
		Tier:        Tier{Name: "unverified", Rank: 0},
	}))
	if d.Outcome != Deny || !hasReason(d, "tier_cannot_send") {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
}

// D-39. Limits used to exist only as numbers on the device that the send path
// never read.
func TestSingleAndDailyLimitsAreEnforced(t *testing.T) {
	over := Evaluate(base(Input{AmountMinor: 250_000, KnownRecipient: true}))
	if over.Outcome != Deny || !hasReason(over, "over_single_limit") {
		t.Fatalf("single limit: %s %v", over.Outcome, over.Reasons)
	}

	daily := Evaluate(base(Input{
		AmountMinor: 100_000, SpentTodayMinor: 450_000, KnownRecipient: true,
	}))
	if daily.Outcome != Deny || !hasReason(daily, "over_daily_limit") {
		t.Fatalf("daily limit: %s %v", daily.Outcome, daily.Reasons)
	}

	// Exactly at the daily limit is allowed; the limit is a ceiling, not a gap.
	exact := Evaluate(base(Input{
		AmountMinor: 50_000, SpentTodayMinor: 450_000, KnownRecipient: true,
	}))
	if exact.Outcome != Allow {
		t.Fatalf("exactly at the limit was refused: %v", exact.Reasons)
	}
	if exact.RemainingDailyMinor != 0 {
		t.Fatalf("remaining %d", exact.RemainingDailyMinor)
	}
}

// A first payment to someone new is the shape of an authorised-push-payment
// fraud: a lower ceiling, and a look rather than a refusal.
func TestNewRecipientGoesToReviewNotDenial(t *testing.T) {
	d := Evaluate(base(Input{AmountMinor: 60_000, KnownRecipient: false}))
	if d.Outcome != Review || !hasReason(d, "over_new_recipient_limit") {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
	// The same amount to a known recipient is fine.
	known := Evaluate(base(Input{AmountMinor: 60_000, KnownRecipient: true}))
	if known.Outcome != Allow {
		t.Fatalf("known recipient refused: %v", known.Reasons)
	}
}

func TestSanctionsMatchDenies(t *testing.T) {
	d := Evaluate(base(Input{
		AmountMinor: 1_000, KnownRecipient: true,
		ScreeningHits: []ScreeningHit{{Category: "sanctions", Name: "fictional sanctioned person", Strong: true}},
	}))
	if d.Outcome != Deny || !hasReason(d, "sanctions_match") {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
}

// Being a public official is not wrongdoing. It calls for a look, not a refusal.
func TestPepMatchReviewsRatherThanDenies(t *testing.T) {
	d := Evaluate(base(Input{
		AmountMinor: 1_000, KnownRecipient: true,
		ScreeningHits: []ScreeningHit{{Category: "pep", Name: "fictional public official"}},
	}))
	if d.Outcome != Review || !hasReason(d, "pep_match") {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
}

func TestBlockedCustomerIsDenied(t *testing.T) {
	d := Evaluate(base(Input{AmountMinor: 1, CustomerStatus: "blocked", KnownRecipient: true}))
	if d.Outcome != Deny || !hasReason(d, "customer_blocked") {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
}

func TestUnderReviewCustomerIsHeld(t *testing.T) {
	d := Evaluate(base(Input{AmountMinor: 1_000, CustomerStatus: "under_review", KnownRecipient: true}))
	if d.Outcome != Review {
		t.Fatalf("outcome %s, reasons %v", d.Outcome, d.Reasons)
	}
}

// The most severe outcome wins, and every triggered rule is reported so the
// customer is told everything at once rather than one refusal at a time.
func TestMostSevereOutcomeWinsAndAllReasonsAreReported(t *testing.T) {
	d := Evaluate(base(Input{
		AmountMinor: 400_000, // over single limit -> deny
		ScreeningHits: []ScreeningHit{
			{Category: "pep", Name: "fictional public official"}, // review
		},
	}))
	if d.Outcome != Deny {
		t.Fatalf("expected deny to win, got %s", d.Outcome)
	}
	if !hasReason(d, "pep_match") || !hasReason(d, "over_single_limit") {
		t.Fatalf("reasons lost: %v", d.Reasons)
	}
}

func TestNonPositiveAmountIsDenied(t *testing.T) {
	for _, amount := range []int64{0, -1} {
		d := Evaluate(base(Input{AmountMinor: amount, KnownRecipient: true}))
		if d.Outcome != Deny {
			t.Fatalf("amount %d was not denied: %v", amount, d.Reasons)
		}
	}
}

// An allowed decision must carry no reasons that would have refused it.
func TestAllowCarriesNoRefusingReasons(t *testing.T) {
	d := Evaluate(base(Input{AmountMinor: 1_000, KnownRecipient: true}))
	if d.Outcome != Allow {
		t.Fatalf("outcome %s", d.Outcome)
	}
	if len(d.Reasons) != 0 {
		t.Fatalf("allow carried reasons: %v", d.Reasons)
	}
}

func TestNameNormalisation(t *testing.T) {
	cases := map[string]string{
		"  Ama   MENSAH ": "ama mensah",
		"Ama Mensah":      "ama mensah",
		"AMA\tMENSAH":     "ama mensah",
	}
	for in, want := range cases {
		if got := NormaliseName(in); got != want {
			t.Fatalf("NormaliseName(%q) = %q, want %q", in, got, want)
		}
	}
}

// A near-certain sanctions match denies; a weaker resemblance holds for review
// rather than auto-denying a possibly-innocent customer.
func TestStrongSanctionsDeniesWeakReviews(t *testing.T) {
	base := Input{
		CustomerStatus: "active",
		Tier:           Tier{Rank: 3, SingleLimitMinor: 1_000_000, DailyLimitMinor: 5_000_000, NewRecipientLimitMinor: 1_000_000},
		AmountMinor:    10_000, Currency: "GHS", RecipientName: "x",
	}

	strong := base
	strong.ScreeningHits = []ScreeningHit{{Category: "sanctions", Name: "Fictional Sanctioned Person", Score: 1.0, Strong: true}}
	if d := Evaluate(strong); d.Outcome != Deny {
		t.Fatalf("a strong sanctions match did not deny: %s", d.Outcome)
	}

	weak := base
	weak.ScreeningHits = []ScreeningHit{{Category: "sanctions", Name: "Fictitious Sanctioned Person", Score: 0.83, Strong: false}}
	if d := Evaluate(weak); d.Outcome != Review {
		t.Fatalf("a weak sanctions match did not hold for review: %s", d.Outcome)
	}
}
