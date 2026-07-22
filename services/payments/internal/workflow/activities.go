package workflow

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/ephera/authgrant"
	"github.com/ephera/payments/internal/adapter"
	"github.com/ephera/payments/internal/adapter/airtime"
	"github.com/ephera/payments/internal/adapter/bank"
	"github.com/ephera/payments/internal/adapter/mobilemoney"
	"github.com/ephera/payments/internal/ledgerclient"
	"github.com/google/uuid"
)

// Activities holds sandbox rails + ledger client + in-memory receipts.
type Activities struct {
	rails  map[string]adapter.Rail
	ledger *ledgerclient.Client
	mu     sync.Mutex
	// receipts kept in-process for sandbox GET
	receipts map[string]Receipt
}

func NewActivities() *Activities {
	mm := mobilemoney.NewSim()
	bk := bank.NewSim()
	at := airtime.NewSim()
	ledgerURL := os.Getenv("LEDGER_URL")
	if ledgerURL == "" {
		ledgerURL = "http://localhost:8092"
	}
	return &Activities{
		rails: map[string]adapter.Rail{
			mm.Name(): mm,
			bk.Name(): bk,
			at.Name(): at,
		},
		ledger:   ledgerclient.New(ledgerURL),
		receipts: make(map[string]Receipt),
	}
}

func (a *Activities) Quote(ctx context.Context, rail string, amountMinor int64, currency string) (adapter.Quote, error) {
	r, ok := a.rails[rail]
	if !ok {
		return adapter.Quote{}, fmt.Errorf("unknown rail: %s", rail)
	}
	return r.Quote(ctx, amountMinor, currency, currency)
}

// RequireAuthorisation is a fail-fast pre-check, NOT an authorisation decision.
//
// It parses the grant without verifying its signature and confirms it claims to
// be bound to this exact transfer, so the workflow does not place a hold and
// call a rail for a grant that will be refused at capture. The authority is the
// ledger, which verifies the signature, the validity window and the binding,
// and consumes the grant so it cannot be used twice (ADR 0001, ADR 0002).
//
// Before G2 this was a length check -- any string of eight characters was
// accepted (D-01).
func (a *Activities) RequireAuthorisation(_ context.Context, in DomesticTransferInput) error {
	if in.AuthorisationRef == "" {
		return fmt.Errorf("missing authorisation grant: voice alone is never sufficient")
	}
	claimed, err := authgrant.ParseUnverified(in.AuthorisationRef)
	if err != nil {
		return fmt.Errorf("authorisation is not a grant: %w", err)
	}
	want := authgrant.Binding{
		FromExternalRef: in.FromExternalRef,
		ToExternalRef:   in.ToExternalRef,
		AmountMinor:     in.AmountMinor,
		FeeMinor:        in.FeeMinor,
		Currency:        in.Currency,
		TransferID:      in.TransferID,
	}
	if claimed.Binding != want.Digest() {
		return fmt.Errorf("authorisation grant is not bound to this transfer")
	}
	return nil
}

func (a *Activities) PostLedgerHold(ctx context.Context, fromRef, transferID, idempotencyKey string, amountMinor int64, currency string) (string, error) {
	if fromRef == "" {
		fromRef = "user:demo-self:GHS"
	}
	return a.ledger.PlaceHold(ctx, fromRef, amountMinor, currency, transferID, idempotencyKey+":hold")
}

func (a *Activities) ReleaseLedgerHold(ctx context.Context, holdID string) error {
	if holdID == "" {
		return nil
	}
	return a.ledger.ReleaseHold(ctx, holdID)
}

func (a *Activities) ExecuteRail(ctx context.Context, in DomesticTransferInput) (adapter.ExecutionResult, error) {
	if err := a.RequireAuthorisation(ctx, in); err != nil {
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

func (a *Activities) CaptureLedger(ctx context.Context, in DomesticTransferInput, holdID string, feeMinor int64) (string, error) {
	from := in.FromExternalRef
	if from == "" {
		from = "user:demo-self:GHS"
	}
	to := in.ToExternalRef
	if to == "" {
		// default sandbox recipient mapping
		to = "user:ama:GHS"
	}
	return a.ledger.CaptureTransfer(ctx, map[string]any{
		"fromExternalRef":  from,
		"toExternalRef":    to,
		"amountMinor":      in.AmountMinor,
		"currency":         in.Currency,
		"transferId":       in.TransferID,
		"idempotencyKey":   in.IdempotencyKey + ":capture",
		"authorisationRef": in.AuthorisationRef,
		"holdId":           holdID,
		"description":      fmt.Sprintf("Send to %s", in.RecipientName),
		"feeMinor":         feeMinor,
	})
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
	if err := a.RequireGrantPresent(ctx, in.AuthorisationRef); err != nil {
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

func (a *Activities) FreezeWallet(ctx context.Context, externalRef, reason, authRef string) error {
	if err := a.RequireGrantPresent(ctx, authRef); err != nil {
		return err
	}
	if externalRef == "" {
		externalRef = "user:demo-self:GHS"
	}
	_, err := a.ledger.Freeze(ctx, externalRef, reason, authRef)
	return err
}

// RequireGrantPresent is the pre-check for flows that do not yet post to the
// ledger (airtime) or that carry their own binding shape (freeze). It confirms
// a grant was supplied and is structurally a grant. It is not authorisation --
// binding those flows to a grant is outstanding G2 work.
func (a *Activities) RequireGrantPresent(_ context.Context, authRef string) error {
	if authRef == "" {
		return fmt.Errorf("missing authorisation grant: voice alone is never sufficient")
	}
	if _, err := authgrant.ParseUnverified(authRef); err != nil {
		return fmt.Errorf("authorisation is not a grant: %w", err)
	}
	return nil
}
