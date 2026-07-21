package mobilemoney

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ephera/payments/internal/adapter"
	"github.com/google/uuid"
)

// Sim is a sandbox mobile-money rail. No real telco connectivity.
type Sim struct {
	mu    sync.Mutex
	store map[string]adapter.ExecutionResult
}

func NewSim() *Sim {
	return &Sim{store: make(map[string]adapter.ExecutionResult)}
}

func (s *Sim) Name() string { return "mobile-money-sim" }

func (s *Sim) Quote(_ context.Context, amountMinor int64, currency, receiveCurrency string) (adapter.Quote, error) {
	if receiveCurrency == "" {
		receiveCurrency = currency
	}
	fee := int64(0)
	if amountMinor >= 10000 {
		fee = 50 // 0.50 in minor units for larger sandbox sends
	}
	return adapter.Quote{
		SendAmountMinor:    amountMinor,
		ReceiveAmountMinor: amountMinor - fee,
		FeeMinor:           fee,
		Currency:           currency,
		ReceiveCurrency:    receiveCurrency,
		ETA:                "Under 2 minutes",
		RouteSummary:       "EPHERA sandbox → mobile money sim",
		Adapter:            s.Name(),
	}, nil
}

func (s *Sim) Execute(ctx context.Context, req adapter.ExecutionRequest) (adapter.ExecutionResult, error) {
	if req.AuthorisationRef == "" {
		return adapter.ExecutionResult{}, fmt.Errorf("missing authorisation evidence")
	}
	if req.FailMode == "reject" {
		return adapter.ExecutionResult{
			ExecutionID: "mm_" + uuid.NewString(),
			Status:      "failed",
			Message:     "simulated provider rejection",
		}, nil
	}
	if req.FailMode == "timeout" {
		select {
		case <-ctx.Done():
			return adapter.ExecutionResult{}, ctx.Err()
		case <-time.After(30 * time.Second):
		}
	}

	// Brief simulated settlement latency
	select {
	case <-ctx.Done():
		return adapter.ExecutionResult{}, ctx.Err()
	case <-time.After(50 * time.Millisecond):
	}

	res := adapter.ExecutionResult{
		ExecutionID: "mm_" + uuid.NewString(),
		Status:      "settled",
		ProviderRef: "MM-SIM-" + req.TransferID[:8],
		SettledAt:   time.Now().UTC(),
		Message:     fmt.Sprintf("paid %s", req.RecipientName),
	}
	s.mu.Lock()
	s.store[res.ExecutionID] = res
	s.mu.Unlock()
	return res, nil
}

func (s *Sim) Status(_ context.Context, executionID string) (adapter.StatusResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if r, ok := s.store[executionID]; ok {
		return adapter.StatusResult{ExecutionID: executionID, Status: r.Status, Message: r.Message}, nil
	}
	return adapter.StatusResult{ExecutionID: executionID, Status: "unknown", Message: "not found"}, nil
}
