package workflow

import (
	"fmt"
	"time"

	"github.com/ephera/payments/internal/adapter"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// DomesticTransferSim is the deterministic sandbox transfer workflow.
// Stages: quote → auth check → hold → execute rail → capture → receipt.
func DomesticTransferSim(ctx workflow.Context, in DomesticTransferInput) (DomesticTransferResult, error) {
	logger := workflow.GetLogger(ctx)
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	if in.Rail == "" {
		in.Rail = "mobile-money-sim"
	}
	if in.Currency == "" {
		in.Currency = "GHS"
	}

	var acts *Activities

	var q adapter.Quote
	if err := workflow.ExecuteActivity(ctx, acts.Quote, in.Rail, in.AmountMinor, in.Currency).Get(ctx, &q); err != nil {
		return DomesticTransferResult{}, err
	}

	if err := workflow.ExecuteActivity(ctx, acts.RequireAuthorisation, in.AuthorisationRef).Get(ctx, nil); err != nil {
		logger.Error("authorisation failed", "error", err)
		return DomesticTransferResult{TransferID: in.TransferID, Status: "denied", Message: err.Error()}, err
	}

	var holdID string
	if err := workflow.ExecuteActivity(ctx, acts.PostLedgerHold, in.TransferID, in.IdempotencyKey, in.AmountMinor).Get(ctx, &holdID); err != nil {
		return DomesticTransferResult{}, err
	}

	var exec adapter.ExecutionResult
	if err := workflow.ExecuteActivity(ctx, acts.ExecuteRail, in).Get(ctx, &exec); err != nil {
		return DomesticTransferResult{TransferID: in.TransferID, Status: "failed", Message: err.Error()}, err
	}

	if exec.Status == "failed" {
		recSummary := fmt.Sprintf("Failed send of %d %s to %s", in.AmountMinor, in.Currency, in.RecipientName)
		var rec Receipt
		_ = workflow.ExecuteActivity(ctx, acts.CreateReceipt, in.TransferID, "failed", exec.ProviderRef, in.AuthorisationRef, recSummary).Get(ctx, &rec)
		return DomesticTransferResult{
			TransferID:   in.TransferID,
			Status:       "failed",
			ExecutionID:  exec.ExecutionID,
			ProviderRef:  exec.ProviderRef,
			FeeMinor:     q.FeeMinor,
			RouteSummary: q.RouteSummary,
			ReceiptID:    rec.ID,
			Message:      exec.Message,
		}, nil
	}

	if err := workflow.ExecuteActivity(ctx, acts.CaptureLedger, in.IdempotencyKey, holdID).Get(ctx, nil); err != nil {
		return DomesticTransferResult{}, err
	}

	summary := fmt.Sprintf("Sent %d %s minor units to %s via %s. Fee %d. %s",
		in.AmountMinor, in.Currency, in.RecipientName, in.Rail, q.FeeMinor, q.ETA)
	var rec Receipt
	if err := workflow.ExecuteActivity(ctx, acts.CreateReceipt, in.TransferID, "settled", exec.ProviderRef, in.AuthorisationRef, summary).Get(ctx, &rec); err != nil {
		return DomesticTransferResult{}, err
	}

	return DomesticTransferResult{
		TransferID:   in.TransferID,
		Status:       "settled",
		ExecutionID:  exec.ExecutionID,
		ProviderRef:  exec.ProviderRef,
		FeeMinor:     q.FeeMinor,
		RouteSummary: q.RouteSummary,
		ReceiptID:    rec.ID,
		Message:      exec.Message,
	}, nil
}

// AirtimePurchaseSim buys airtime in the sandbox.
func AirtimePurchaseSim(ctx workflow.Context, in AirtimeInput) (DomesticTransferResult, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 20 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts: 3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)
	var acts *Activities

	if err := workflow.ExecuteActivity(ctx, acts.RequireAuthorisation, in.AuthorisationRef).Get(ctx, nil); err != nil {
		return DomesticTransferResult{TransferID: in.TransferID, Status: "denied", Message: err.Error()}, err
	}

	var exec adapter.ExecutionResult
	if err := workflow.ExecuteActivity(ctx, acts.ExecuteAirtime, in).Get(ctx, &exec); err != nil {
		return DomesticTransferResult{}, err
	}

	summary := fmt.Sprintf("Airtime %d %s for %s", in.AmountMinor, in.Currency, in.PhoneHint)
	var rec Receipt
	_ = workflow.ExecuteActivity(ctx, acts.CreateReceipt, in.TransferID, exec.Status, exec.ProviderRef, in.AuthorisationRef, summary).Get(ctx, &rec)

	return DomesticTransferResult{
		TransferID:  in.TransferID,
		Status:      exec.Status,
		ExecutionID: exec.ExecutionID,
		ProviderRef: exec.ProviderRef,
		ReceiptID:   rec.ID,
		Message:     exec.Message,
	}, nil
}
