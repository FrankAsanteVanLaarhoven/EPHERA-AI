package workflow

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

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
	// authPublicKey verifies grant signatures BEFORE the irreversible rail runs.
	// The ledger verifies authoritatively at capture, but capture is downstream
	// of the rail payout, so without this a forged grant reaches the rail before
	// anyone checks its signature. Empty means the worker fails closed: it will
	// not run a rail it cannot first authorise.
	authPublicKey ed25519.PublicKey
}

func NewActivities() *Activities {
	mm := mobilemoney.NewSim()
	bk := bank.NewSim()
	at := airtime.NewSim()
	ledgerURL := os.Getenv("LEDGER_URL")
	if ledgerURL == "" {
		ledgerURL = "http://localhost:8092"
	}
	a := &Activities{
		rails: map[string]adapter.Rail{
			mm.Name(): mm,
			bk.Name(): bk,
			at.Name(): at,
		},
		ledger:   ledgerclient.New(ledgerURL),
		receipts: make(map[string]Receipt),
	}
	// The grant-signing public key — the identity service's public key, the same
	// value the ledger holds, so a dedicated var falls back to the ledger's.
	// Without it the worker refuses to authorise, and so refuses to run a rail.
	pubHex := os.Getenv("PAYMENTS_AUTH_PUBLIC_KEY")
	if pubHex == "" {
		pubHex = os.Getenv("LEDGER_AUTH_PUBLIC_KEY")
	}
	if raw, err := hex.DecodeString(pubHex); err == nil && len(raw) == ed25519.PublicKeySize {
		a.authPublicKey = ed25519.PublicKey(raw)
	} else {
		log.Printf("WARNING: no valid grant public key configured " +
			"(PAYMENTS_AUTH_PUBLIC_KEY / LEDGER_AUTH_PUBLIC_KEY); the worker will refuse to authorise transfers")
	}
	return a
}

func (a *Activities) Quote(ctx context.Context, rail string, amountMinor int64, currency string) (adapter.Quote, error) {
	r, ok := a.rails[rail]
	if !ok {
		return adapter.Quote{}, fmt.Errorf("unknown rail: %s", rail)
	}
	return r.Quote(ctx, amountMinor, currency, currency)
}

// RequireAuthorisation verifies the grant's SIGNATURE and binding before the
// workflow places a hold or runs a rail.
//
// This used to be a signature-free pre-check: it parsed the grant and compared
// its binding, but left the signature to be checked at capture — which runs
// AFTER the irreversible rail payout. A client that knew the transfer fields
// could therefore compute the correct binding digest, present a grant with a
// forged signature, pass this check and the rail, and only be refused at
// capture, by which point the money had left (H1). The signature is now checked
// here, before anything irreversible happens.
//
// The ledger remains the authority: it verifies again and, crucially, consumes
// the grant single-use in the same transaction as the postings (ADR 0001, ADR
// 0002). This is defence in depth at the point before the irreversible action,
// not a replacement for the ledger's check.
//
// It fails closed: with no public key configured, no transfer is authorised.
func (a *Activities) RequireAuthorisation(_ context.Context, in DomesticTransferInput) error {
	if in.AuthorisationRef == "" {
		return fmt.Errorf("missing authorisation grant: voice alone is never sufficient")
	}
	if len(a.authPublicKey) == 0 {
		return fmt.Errorf("no grant public key configured; the transfer cannot be authorised")
	}
	want := authgrant.Binding{
		FromExternalRef: in.FromExternalRef,
		ToExternalRef:   in.ToExternalRef,
		AmountMinor:     in.AmountMinor,
		FeeMinor:        in.FeeMinor,
		Currency:        in.Currency,
		TransferID:      in.TransferID,
	}
	if _, err := authgrant.Verify(a.authPublicKey, in.AuthorisationRef, want, time.Now()); err != nil {
		// Every verification failure is an authorisation failure. The specific
		// reason aids diagnosis; it does not help a caller find an accepted shape.
		return fmt.Errorf("authorisation grant is not valid for this transfer: %w", err)
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

// CreateReceipt no longer mints a receipt. For a settled payment the ledger has
// already issued one inside the same transaction as the postings, so the receipt
// cannot describe money that did not move; this reads that one back rather than
// composing a second account of the same event from values the worker happens to
// hold. Two receipts for one payment is one receipt too many, and the one worth
// keeping is the one the money is bound to.
//
// A payment that never posted has no ledger receipt, so the worker still issues
// its own for the failure record — a failure is not evidence of a posting.
func (a *Activities) CreateReceipt(ctx context.Context, transferID, status, providerRef, authRef, summary string) (Receipt, error) {
	rec := Receipt{
		ID:            "rcpt_" + uuid.NewString(),
		TransferID:    transferID,
		Summary:       summary,
		Status:        status,
		ProviderRef:   providerRef,
		Authorisation: authRef,
	}
	if lr, intact, err := a.ledger.ReceiptForTransfer(ctx, transferID); err == nil && lr.ID != "" {
		rec.ID = lr.ID
		rec.Authorisation = lr.GrantID
		rec.LedgerEntryID = lr.JournalEntryID
		rec.AmountMinor, rec.FeeMinor, rec.Currency = lr.AmountMinor, lr.FeeMinor, lr.Currency
		rec.AuthorisationMethod = lr.AuthorisationMethod
		rec.ContentHash, rec.Verified = lr.ContentHash, intact
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
