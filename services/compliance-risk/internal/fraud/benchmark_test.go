package fraud

import (
	"fmt"
	"testing"
	"time"
)

// A reproducible benchmark for APP fraud detection.
//
// # What this is, and what it is not
//
// It is NOT a claim of accuracy. There is no labelled fraud data in this
// platform, so nothing here demonstrates how the engine would perform on real
// traffic. Any figure produced by running scenarios someone wrote by hand is a
// measure of agreement with the author, not of truth.
//
// What it IS: a fixed set of typologies drawn from published APP fraud
// patterns, and — just as importantly — a set of legitimate payments that look
// superficially alarming. It makes two things measurable that are otherwise
// argued about:
//
//   - Does a change to the weights still catch the patterns it used to?
//   - What does that change cost in false positives on ordinary customers?
//
// The second matters more than it usually gets credit for. Detection rate alone
// is trivially maximised by suspecting everyone, and every point of it is paid
// for by someone whose rent payment was stopped. Both numbers are asserted
// here, so neither can be improved quietly at the other's expense.

type scenario struct {
	name string
	// why explains the typology, so a failing case is diagnosable without
	// reverse-engineering the numbers.
	why      string
	payment  Payment
	profile  Profile
	payee    Payee
	fraud    bool
	expectAt Band // minimum band for fraud; maximum band for legitimate
}

func hours(hs ...int) map[int]bool {
	m := map[int]bool{}
	for _, h := range hs {
		m[h] = true
	}
	return m
}

// An ordinary customer: a year old, pays about 200 GHS at a time, daytime.
func ordinary() Profile {
	return Profile{
		AccountAgeDays: 400, TypicalPaymentMinor: 20_000, LargestEverMinor: 60_000,
		PaymentsLast90d: 40, DistinctPayees90d: 9, AvailableBalanceMinor: 400_000,
		UsualHours: hours(8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20),
	}
}

func at(hour int) time.Time {
	return time.Date(2026, 7, 22, hour, 0, 0, 0, time.UTC)
}

func scenarios() []scenario {
	return []scenario{
		// ---- Fraud typologies ----
		{
			name:  "safe_account_impersonation",
			why:   "Caller impersonates the bank and tells the customer to move everything to a 'safe account' they have never paid.",
			payee: Payee{Name: "Safe Account", AccountAgeDays: 3, DistinctPayers7d: 2},
			payment: Payment{AmountMinor: 390_000, At: at(2), FirstPaidPayeeDaysAgo: -1},
			profile: ordinary(), fraud: true, expectAt: Severe,
		},
		{
			name:  "mule_cash_out",
			why:   "Recipient is a freshly opened account collecting money from many unrelated people — the collection point in a cash-out chain.",
			payee: Payee{Name: "Collector", AccountAgeDays: 5, DistinctPayers7d: 11},
			payment: Payment{AmountMinor: 80_000, At: at(14), FirstPaidPayeeDaysAgo: -1},
			profile: ordinary(), fraud: true, expectAt: Severe,
		},
		{
			name:  "invoice_redirection",
			why:   "Intercepted invoice: a large first payment to a recently created account the customer believes is their supplier.",
			payee: Payee{Name: "Supplier Ltd", AccountAgeDays: 11, DistinctPayers7d: 1},
			payment: Payment{AmountMinor: 250_000, At: at(11), FirstPaidPayeeDaysAgo: -1},
			profile: ordinary(), fraud: true, expectAt: High,
		},
		{
			name:  "romance_escalation",
			why:   "Payments to a payee first paid two weeks ago, now far above the customer's usual size.",
			payee: Payee{Name: "Friend", AccountAgeDays: 60, DistinctPayers7d: 1,
				PaidByThisCustomerBefore: true, PriorPaymentsFromThisCustomer: 4},
			payment: Payment{AmountMinor: 120_000, At: at(23), FirstPaidPayeeDaysAgo: 14},
			profile: ordinary(), fraud: true, expectAt: Caution,
		},
		{
			name:  "dormant_account_takeover",
			why:   "A long-dormant account suddenly empties to a brand new payee — consistent with account takeover rather than the customer acting.",
			payee: Payee{Name: "Unknown", AccountAgeDays: 2, DistinctPayers7d: 3},
			payment: Payment{AmountMinor: 280_000, At: at(4), FirstPaidPayeeDaysAgo: -1},
			profile: Profile{
				AccountAgeDays: 800, TypicalPaymentMinor: 15_000, LargestEverMinor: 40_000,
				PaymentsLast90d: 0, AvailableBalanceMinor: 300_000,
				UsualHours: hours(9, 10, 11, 12, 13, 14),
			},
			fraud: true, expectAt: Severe,
		},

		// ---- Legitimate payments that look alarming ----
		// These are the ones that decide whether this engine is usable. Each is
		// something an ordinary customer really does.
		{
			name:  "legitimate_rent_to_established_landlord",
			why:   "Large, regular, to a payee paid many times before. Size alone must not trigger.",
			payee: Payee{Name: "Landlord", AccountAgeDays: 900, DistinctPayers7d: 3,
				PaidByThisCustomerBefore: true, PriorPaymentsFromThisCustomer: 18},
			payment: Payment{AmountMinor: 150_000, At: at(9), FirstPaidPayeeDaysAgo: 540},
			profile: ordinary(), fraud: false, expectAt: Clear,
		},
		{
			name:  "legitimate_first_payment_to_family",
			why:   "A modest first payment to a new payee. New payees are ordinary; most are not fraud.",
			payee: Payee{Name: "Cousin", AccountAgeDays: 700, DistinctPayers7d: 2},
			payment: Payment{AmountMinor: 25_000, At: at(13), FirstPaidPayeeDaysAgo: -1},
			profile: ordinary(), fraud: false, expectAt: Caution,
		},
		{
			name:  "legitimate_new_customer_first_ever_payment",
			why:   "A new customer has no baseline. Absence of history must not be read as suspicion.",
			payee: Payee{Name: "Shop", AccountAgeDays: 400, DistinctPayers7d: 4},
			payment: Payment{AmountMinor: 30_000, At: at(10), FirstPaidPayeeDaysAgo: -1},
			profile: Profile{AccountAgeDays: 2, AvailableBalanceMinor: 50_000},
			fraud:   false, expectAt: Caution,
		},
		{
			name:  "legitimate_late_night_payment_by_night_worker",
			why:   "The customer routinely transacts at night. Their own baseline says this is normal.",
			payee: Payee{Name: "Colleague", AccountAgeDays: 500, DistinctPayers7d: 1,
				PaidByThisCustomerBefore: true, PriorPaymentsFromThisCustomer: 6},
			payment: Payment{AmountMinor: 20_000, At: at(3), FirstPaidPayeeDaysAgo: 200},
			profile: func() Profile { p := ordinary(); p.UsualHours = hours(0, 1, 2, 3, 4, 22, 23); return p }(),
			fraud:   false, expectAt: Clear,
		},
		{
			name:  "legitimate_school_fees_large_but_known",
			why:   "Several times the usual size, but to a long-established payee — school fees, once a term.",
			payee: Payee{Name: "School", AccountAgeDays: 2000, DistinctPayers7d: 30,
				PaidByThisCustomerBefore: true, PriorPaymentsFromThisCustomer: 9},
			payment: Payment{AmountMinor: 140_000, At: at(12), FirstPaidPayeeDaysAgo: 800},
			profile: ordinary(), fraud: false, expectAt: Caution,
		},
	}
}

func rank(b Band) int {
	switch b {
	case Severe:
		return 3
	case High:
		return 2
	case Caution:
		return 1
	default:
		return 0
	}
}

// TestBenchmark is the headline: it reports detection and false-positive rates
// together and fails if either regresses.
func TestBenchmark(t *testing.T) {
	w := DefaultWeights()
	var fraudTotal, fraudCaught, legitTotal, legitFalse int

	for _, sc := range scenarios() {
		a := Assess(sc.payment, sc.profile, sc.payee, w)
		if sc.fraud {
			fraudTotal++
			if rank(a.Band) >= rank(sc.expectAt) {
				fraudCaught++
			} else {
				t.Errorf("MISSED %s: got %s (score %d), expected at least %s\n  why: %s\n  signals: %v",
					sc.name, a.Band, a.Score, sc.expectAt, sc.why, names(a.Signals))
			}
			// A detection nobody can explain is not actionable.
			if a.Intervention != Allow && a.WarningText == "" {
				t.Errorf("%s intervened with no explanation for the customer", sc.name)
			}
			continue
		}
		legitTotal++
		if rank(a.Band) > rank(sc.expectAt) {
			legitFalse++
			t.Errorf("FALSE POSITIVE %s: got %s (score %d), expected at most %s\n  why: %s\n  signals: %v",
				sc.name, a.Band, a.Score, sc.expectAt, sc.why, names(a.Signals))
		}
		// Legitimate payments must never be blocked outright by this engine.
		if a.Intervention == Block {
			t.Errorf("%s was blocked; blocking an ordinary customer is the costliest error here", sc.name)
		}
	}

	t.Logf("detection %d/%d typologies; false positives %d/%d legitimate payments",
		fraudCaught, fraudTotal, legitFalse, legitTotal)
}

func names(ss []Signal) []string {
	out := make([]string, 0, len(ss))
	for _, s := range ss {
		out = append(out, s.Name)
	}
	return out
}

// Only the mule pattern blocks. Everything else warns or holds, because
// stopping a legitimate payment costs someone who did nothing wrong.
func TestOnlyMuleDestinationsAreBlocked(t *testing.T) {
	for _, sc := range scenarios() {
		a := Assess(sc.payment, sc.profile, sc.payee, DefaultWeights())
		if a.Intervention == Block && a.Typology != "mule_account" {
			t.Fatalf("%s blocked on typology %q; only a mule destination should block",
				sc.name, a.Typology)
		}
	}
}

// A warning that does not name the scam is one customers click through while
// the fraudster talks them past it.
func TestWarningsNameTheScam(t *testing.T) {
	for _, sc := range scenarios() {
		if !sc.fraud {
			continue
		}
		a := Assess(sc.payment, sc.profile, sc.payee, DefaultWeights())
		if a.Typology == "" {
			continue // unclassified but still flagged; generic wording is acceptable
		}
		if len(a.WarningText) < 60 {
			t.Fatalf("%s: warning for %q is too thin to interrupt a script: %q",
				sc.name, a.Typology, a.WarningText)
		}
	}
}

// Every signal must carry its observation. The engine's whole claim to being
// reviewable rests on this.
func TestEverySignalIsExplained(t *testing.T) {
	for _, sc := range scenarios() {
		a := Assess(sc.payment, sc.profile, sc.payee, DefaultWeights())
		for _, s := range a.Signals {
			if s.Observation == "" {
				t.Fatalf("%s: signal %q has no observation", sc.name, s.Name)
			}
		}
	}
}

// A customer with no history must not be treated as suspicious for having none.
// Getting this wrong penalises exactly the people a mobile-money platform in
// this corridor exists to serve.
func TestAbsenceOfHistoryIsNotEvidence(t *testing.T) {
	newCustomer := Profile{AccountAgeDays: 1, AvailableBalanceMinor: 100_000}
	a := Assess(
		Payment{AmountMinor: 20_000, At: at(11), FirstPaidPayeeDaysAgo: -1},
		newCustomer,
		Payee{Name: "Shop", AccountAgeDays: 500, DistinctPayers7d: 3},
		DefaultWeights(),
	)
	if a.Intervention == Block || a.Intervention == Hold {
		t.Fatalf("a new customer's ordinary first payment was %s (signals %v)",
			a.Intervention, names(a.Signals))
	}
}

// The benchmark must be sensitive: weakening the engine has to show up as a
// measurable loss, or the numbers mean nothing.
func TestBenchmarkDetectsAWeakenedEngine(t *testing.T) {
	weak := DefaultWeights()
	weak.MuleFanIn = 0
	weak.DrainsBalance = 0
	weak.YoungPayeeAccount = 0

	missed := 0
	for _, sc := range scenarios() {
		if !sc.fraud {
			continue
		}
		if rank(Assess(sc.payment, sc.profile, sc.payee, weak).Band) < rank(sc.expectAt) {
			missed++
		}
	}
	if missed == 0 {
		t.Fatal("removing three of the strongest signals changed nothing; the benchmark cannot detect a regression")
	}
	fmt.Printf("weakened engine misses %d typologies\n", missed)
}
