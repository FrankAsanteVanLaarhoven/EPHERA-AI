package workflow

import (
	"context"
	"fmt"
	"sync"

	"github.com/ephera/payments/internal/adapter"
	"github.com/ephera/payments/internal/adapter/airtime"
	"github.com/ephera/payments/internal/adapter/bank"
	"github.com/ephera/payments/internal/adapter/mobilemoney"
	"github.com/google/uuid"
)

// Activities holds sandbox rails and in-memory evidence.
type Activities struct {
	rails    map[string]adapter.Rail
	mu       sync.Mutex
	receipts map[string]Receipt
	// postedIdempotency prevents double ledger-style posts in the worker process
	postedIdempotency map[string]string
}

func NewActivities() *Activities {
	mm := mobilemoney.NewSim()
	bk := bank.NewSim()
	at := airtime.NewSim()
	return &Activities{
		rails: map[string]adapter.Rail{
			mm.Name(): mm,
			bk.Name(): bk,
			at.Name(): at,
		},
		receipts:          make(map[string]Receipt),
		postedIdempotency: make(map[string]string),
	}
}

func (a *Activities) Quote(ctx context.Context, rail string, amountMinor int64, currency string) (adapter.Quote, error) {
	r, ok := a.rails[rail]
	if !ok {
		return adapter.Quote{}, fmt.Errorf("unknown rail: %s", rail)
	}
	return r.Quote(ctx, amountMinor, currency, currency)
}

func (a *Activities) RequireAuthorisation(_ context.Context, authRef string) error {
	if authRef == "" {
		return fmt.Errorf("missing authorisation: voice alone is never sufficient")
	}
	if len(authRef) < 8 {
		return fmt.Errorf("invalid authorisation reference")
	}
	return nil
}

func (a *Activities) PostLedgerHold(_ context.Context, transferID, idempotencyKey string, amountMinor int64) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if existing, ok := a.postedIdempotency[idempotencyKey+":hold"]; ok {
		return existing, nil
	}
	holdID := "hold_" + uuid.NewString()
	a.postedIdempotency[idempotencyKey+":hold"] = holdID
	// Sandbox: real PostgreSQL postings land when ledger HTTP service is wired.
	_ = transferID
	_ = amountMinor
	return holdID, nil
}

func (a *Activities) ExecuteRail(ctx context.Context, in DomesticTransferInput) (adapter.ExecutionResult, error) {
	if err := a.RequireAuthorisation(ctx, in.AuthorisationRef); err != nil {
		return adapter.ExecutionResult{}, err
	}
	r, ok := a.rails[in.Rail]
	if !ok {
		return adapter.ExecutionResult{}, fmt.Errorf("unknown rail: %s", in.Rail)
	}
	return r.Execute(ctx, adapter.ExecutionRequest{
		TransferID:       in.TransferID,
		IdempotencyKey:   in.IdempotencyKey,
		AmountMinor:      in.AmountMinor,
		Currency:         in.Currency,
		RecipientHint:    in.RecipientHint,
		RecipientName:    in.RecipientName,
		AuthorisationRef: in.AuthorisationRef,
		FailMode:         in.FailMode,
	})
}

func (a *Activities) CaptureLedger(_ context.Context, idempotencyKey, holdID string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if _, ok := a.postedIdempotency[idempotencyKey+":capture"]; ok {
		return nil
	}
	a.postedIdempotency[idempotencyKey+":capture"] = holdID
	return nil
}

func (a *Activities) CreateReceipt(_ context.Context, transferID, status, providerRef, authRef, summary string) (Receipt, error) {
	rec := Receipt{
		ID:            "rcpt_" + uuid.NewString(),
		TransferID:    transferID,
		Summary:       summary,
		Status:        status,
		ProviderRef:   providerRef,
		Authorisation: authRef,
	}
	a.mu.Lock()
	a.receipts[rec.ID] = rec
	a.mu.Unlock()
	return rec, nil
}

func (a *Activities) GetReceipt(_ context.Context, id string) (Receipt, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	r, ok := a.receipts[id]
	if !ok {
		return Receipt{}, fmt.Errorf("receipt not found")
	}
	return r, nil
}

func (a *Activities) ExecuteAirtime(ctx context.Context, in AirtimeInput) (adapter.ExecutionResult, error) {
	if err := a.RequireAuthorisation(ctx, in.AuthorisationRef); err != nil {
		return adapter.ExecutionResult{}, err
	}
	r := a.rails["airtime-sim"]
	return r.Execute(ctx, adapter.ExecutionRequest{
		TransferID:       in.TransferID,
		IdempotencyKey:   in.IdempotencyKey,
		AmountMinor:      in.AmountMinor,
		Currency:         in.Currency,
		RecipientHint:    in.PhoneHint,
		RecipientName:    in.PhoneHint,
		AuthorisationRef: in.AuthorisationRef,
	})
}
