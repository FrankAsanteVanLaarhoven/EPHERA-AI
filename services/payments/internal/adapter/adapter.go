package adapter

import (
	"context"
	"time"
)

// Quote is a fee/route proposal before authorisation.
type Quote struct {
	SendAmountMinor    int64  `json:"sendAmountMinor"`
	ReceiveAmountMinor int64  `json:"receiveAmountMinor"`
	FeeMinor           int64  `json:"feeMinor"`
	FxMarkupMinor      int64  `json:"fxMarkupMinor,omitempty"`
	Currency           string `json:"currency"`
	ReceiveCurrency    string `json:"receiveCurrency"`
	ETA                string `json:"eta"`
	RouteSummary       string `json:"routeSummary"`
	Adapter            string `json:"adapter"`
}

// ExecutionRequest is only valid after cryptographic authorisation evidence exists.
type ExecutionRequest struct {
	TransferID         string `json:"transferId"`
	IdempotencyKey     string `json:"idempotencyKey"`
	AmountMinor        int64  `json:"amountMinor"`
	Currency           string `json:"currency"`
	RecipientHint      string `json:"recipientHint"`
	RecipientName      string `json:"recipientName"`
	AuthorisationRef   string `json:"authorisationRef"`
	FailMode           string `json:"failMode,omitempty"` // empty | timeout | reject
}

type ExecutionResult struct {
	ExecutionID string    `json:"executionId"`
	Status      string    `json:"status"` // submitted | settled | failed
	ProviderRef string    `json:"providerRef"`
	SettledAt   time.Time `json:"settledAt,omitempty"`
	Message     string    `json:"message,omitempty"`
}

type StatusResult struct {
	ExecutionID string `json:"executionId"`
	Status      string `json:"status"`
	Message     string `json:"message,omitempty"`
}

// Rail is the adapter interface all payment rails implement.
type Rail interface {
	Name() string
	Quote(ctx context.Context, amountMinor int64, currency, receiveCurrency string) (Quote, error)
	Execute(ctx context.Context, req ExecutionRequest) (ExecutionResult, error)
	Status(ctx context.Context, executionID string) (StatusResult, error)
}
