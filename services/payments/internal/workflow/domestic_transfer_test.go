package workflow

import (
	"errors"
	"testing"

	"github.com/ephera/payments/internal/adapter"
	"github.com/stretchr/testify/mock"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/testsuite"
)

// Tests for the money path.
//
// This workflow moves customer funds and had no tests at all (D-45). The one
// that matters most is compensation: when a rail fails, the hold placed on the
// customer's money must be released. If that path is broken the customer's
// funds stay reserved after a payment that never happened, and nothing in a
// green build would say so.

func input() DomesticTransferInput {
	return DomesticTransferInput{
		TransferID:       "tx_1",
		IdempotencyKey:   "idem_1",
		AmountMinor:      25_000,
		FeeMinor:         50,
		Currency:         "GHS",
		RecipientName:    "Ama Mensah",
		FromExternalRef:  "user:demo-self:GHS",
		ToExternalRef:    "user:ama:GHS",
		Rail:             "mobile-money-sim",
		AuthorisationRef: "grant_placeholder",
	}
}

func newEnv(t *testing.T) *testsuite.TestWorkflowEnvironment {
	t.Helper()
	s := &testsuite.WorkflowTestSuite{}
	env := s.NewTestWorkflowEnvironment()
	env.RegisterActivity(&Activities{})
	t.Cleanup(func() { env.AssertExpectations(t) })
	return env
}

var acts *Activities

func quoteResult() adapter.Quote {
	return adapter.Quote{
		SendAmountMinor: 25_000, ReceiveAmountMinor: 25_000, FeeMinor: 50,
		Currency: "GHS", ETA: "Under 2 minutes", RouteSummary: "sandbox",
	}
}

func settledRail() adapter.ExecutionResult {
	return adapter.ExecutionResult{ExecutionID: "mm_1", Status: "settled", ProviderRef: "MM-SIM-1"}
}

func TestTransferSettlesAndCaptures(t *testing.T) {
	env := newEnv(t)
	in := input()

	env.OnActivity(acts.Quote, mock.Anything, in.Rail, in.AmountMinor, in.Currency).
		Return(quoteResult(), nil).Once()
	env.OnActivity(acts.RequireAuthorisation, mock.Anything, in).Return(nil).Once()
	// The hold covers amount plus fee: the customer must have both reserved.
	env.OnActivity(acts.PostLedgerHold, mock.Anything, in.FromExternalRef, in.TransferID,
		in.IdempotencyKey, in.AmountMinor+in.FeeMinor, in.Currency).Return("hold_1", nil).Once()
	env.OnActivity(acts.ExecuteRail, mock.Anything, in).Return(settledRail(), nil).Once()
	env.OnActivity(acts.CaptureLedger, mock.Anything, in, "hold_1", in.FeeMinor).
		Return("je_1", nil).Once()
	env.OnActivity(acts.CreateReceipt, mock.Anything, in.TransferID, "settled",
		mock.Anything, in.AuthorisationRef, mock.Anything).
		Return(Receipt{ID: "rcpt_1", Status: "settled"}, nil).Once()

	env.ExecuteWorkflow(DomesticTransferSim, in)

	if !env.IsWorkflowCompleted() {
		t.Fatal("workflow did not complete")
	}
	if err := env.GetWorkflowError(); err != nil {
		t.Fatalf("workflow error: %v", err)
	}
	var out DomesticTransferResult
	if err := env.GetWorkflowResult(&out); err != nil {
		t.Fatalf("result: %v", err)
	}
	if out.Status != "settled" || out.JournalEntryID != "je_1" {
		t.Fatalf("result %+v", out)
	}
}

// The compensation path. A rail that reports failure must release the hold, and
// must not capture: the money never moved, so the reservation must not stand.
func TestFailedRailReleasesTheHoldAndDoesNotCapture(t *testing.T) {
	env := newEnv(t)
	in := input()

	env.OnActivity(acts.Quote, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(quoteResult(), nil).Once()
	env.OnActivity(acts.RequireAuthorisation, mock.Anything, mock.Anything).Return(nil).Once()
	env.OnActivity(acts.PostLedgerHold, mock.Anything, mock.Anything, mock.Anything,
		mock.Anything, mock.Anything, mock.Anything).Return("hold_2", nil).Once()
	env.OnActivity(acts.ExecuteRail, mock.Anything, mock.Anything).
		Return(adapter.ExecutionResult{ExecutionID: "mm_2", Status: "failed",
			Message: "simulated provider rejection"}, nil).Once()

	// The assertion that matters: the exact hold is released.
	env.OnActivity(acts.ReleaseLedgerHold, mock.Anything, "hold_2").Return(nil).Once()
	env.OnActivity(acts.CreateReceipt, mock.Anything, in.TransferID, "failed",
		mock.Anything, mock.Anything, mock.Anything).
		Return(Receipt{ID: "rcpt_2", Status: "failed"}, nil).Once()

	env.ExecuteWorkflow(DomesticTransferSim, in)

	if err := env.GetWorkflowError(); err != nil {
		t.Fatalf("a failed rail should not fail the workflow: %v", err)
	}
	var out DomesticTransferResult
	_ = env.GetWorkflowResult(&out)
	if out.Status != "failed" {
		t.Fatalf("status %q", out.Status)
	}
	if out.JournalEntryID != "" {
		t.Fatalf("a failed payment produced a journal entry: %q", out.JournalEntryID)
	}
	// CaptureLedger was never mocked; if the workflow called it the environment
	// would fail on an unexpected activity.
}

// A rail that errors outright — rather than returning a failed result — must
// also release the hold. This is the path a timeout or an unreachable provider
// takes, and it is the easier one to get wrong.
func TestErroringRailAlsoReleasesTheHold(t *testing.T) {
	env := newEnv(t)

	env.OnActivity(acts.Quote, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(quoteResult(), nil).Once()
	env.OnActivity(acts.RequireAuthorisation, mock.Anything, mock.Anything).Return(nil).Once()
	env.OnActivity(acts.PostLedgerHold, mock.Anything, mock.Anything, mock.Anything,
		mock.Anything, mock.Anything, mock.Anything).Return("hold_3", nil).Once()
	env.OnActivity(acts.ExecuteRail, mock.Anything, mock.Anything).
		Return(adapter.ExecutionResult{}, temporal.NewNonRetryableApplicationError(
			"provider unreachable", "rail_error", errors.New("dial failed"))).Once()
	env.OnActivity(acts.ReleaseLedgerHold, mock.Anything, "hold_3").Return(nil).Once()

	env.ExecuteWorkflow(DomesticTransferSim, input())

	if env.GetWorkflowError() == nil {
		t.Fatal("an erroring rail should surface as a workflow error")
	}
}

// Authorisation is checked before any money is reserved. A refused
// authorisation must not place a hold on the customer's funds.
func TestRefusedAuthorisationPlacesNoHold(t *testing.T) {
	env := newEnv(t)

	env.OnActivity(acts.Quote, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(quoteResult(), nil).Once()
	env.OnActivity(acts.RequireAuthorisation, mock.Anything, mock.Anything).
		Return(temporal.NewNonRetryableApplicationError(
			"authorisation grant is not bound to this transfer", "unauthorised", nil)).Once()

	// PostLedgerHold is deliberately not mocked. If the workflow reserved funds
	// for an unauthorised payment, the environment fails on an unexpected call.
	env.ExecuteWorkflow(DomesticTransferSim, input())

	if env.GetWorkflowError() == nil {
		t.Fatal("a refused authorisation should fail the workflow")
	}
}

// The fee is fixed when the transfer is prepared and covered by the
// authorisation grant. The workflow must use that fee, not the one the rail
// quotes, or the customer would authorise one amount and be debited another.
func TestFeeComesFromThePreparedTransferNotTheQuote(t *testing.T) {
	env := newEnv(t)
	in := input()
	in.FeeMinor = 50

	// The rail quotes a different fee. It must not be used.
	divergent := quoteResult()
	divergent.FeeMinor = 9_999

	env.OnActivity(acts.Quote, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(divergent, nil).Once()
	env.OnActivity(acts.RequireAuthorisation, mock.Anything, mock.Anything).Return(nil).Once()
	// Hold must be amount + the prepared fee, not amount + the quoted fee.
	env.OnActivity(acts.PostLedgerHold, mock.Anything, in.FromExternalRef, in.TransferID,
		in.IdempotencyKey, in.AmountMinor+50, in.Currency).Return("hold_4", nil).Once()
	env.OnActivity(acts.ExecuteRail, mock.Anything, mock.Anything).Return(settledRail(), nil).Once()
	env.OnActivity(acts.CaptureLedger, mock.Anything, mock.Anything, "hold_4", int64(50)).
		Return("je_4", nil).Once()
	env.OnActivity(acts.CreateReceipt, mock.Anything, mock.Anything, mock.Anything,
		mock.Anything, mock.Anything, mock.Anything).
		Return(Receipt{ID: "rcpt_4"}, nil).Once()

	env.ExecuteWorkflow(DomesticTransferSim, in)

	if err := env.GetWorkflowError(); err != nil {
		t.Fatalf("workflow error: %v", err)
	}
	var out DomesticTransferResult
	_ = env.GetWorkflowResult(&out)
	if out.FeeMinor != 50 {
		t.Fatalf("reported fee %d; the customer authorised 50", out.FeeMinor)
	}
}

// A capture that fails must surface. Silently returning success here would
// report a settled payment that the ledger never recorded.
func TestFailedCaptureFailsTheWorkflow(t *testing.T) {
	env := newEnv(t)

	env.OnActivity(acts.Quote, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(quoteResult(), nil).Once()
	env.OnActivity(acts.RequireAuthorisation, mock.Anything, mock.Anything).Return(nil).Once()
	env.OnActivity(acts.PostLedgerHold, mock.Anything, mock.Anything, mock.Anything,
		mock.Anything, mock.Anything, mock.Anything).Return("hold_5", nil).Once()
	env.OnActivity(acts.ExecuteRail, mock.Anything, mock.Anything).Return(settledRail(), nil).Once()
	env.OnActivity(acts.CaptureLedger, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return("", temporal.NewNonRetryableApplicationError(
			"authorisation grant already used", "grant_used", nil)).Once()

	env.ExecuteWorkflow(DomesticTransferSim, input())

	if env.GetWorkflowError() == nil {
		t.Fatal("a failed capture was reported as success")
	}
}
