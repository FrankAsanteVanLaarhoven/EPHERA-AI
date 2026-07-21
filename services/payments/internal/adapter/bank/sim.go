package bank

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ephera/payments/internal/adapter"
	"github.com/google/uuid"
)

type Sim struct {
	mu    sync.Mutex
	store map[string]adapter.ExecutionResult
}

func NewSim() *Sim {
	return &Sim{store: make(map[string]adapter.ExecutionResult)}
}

func (s *Sim) Name() string { return "bank-transfer-sim" }

func (s *Sim) Quote(_ context.Context, amountMinor int64, currency, receiveCurrency string) (adapter.Quote, error) {
	if receiveCurrency == "" {
		receiveCurrency = currency
	}
	fee := int64(100) // flat sandbox fee
	return adapter.Quote{
		SendAmountMinor:    amountMinor,
		ReceiveAmountMinor: amountMinor,
		FeeMinor:           fee,
		Currency:           currency,
		ReceiveCurrency:    receiveCurrency,
		ETA:                "Same day (sim)",
		RouteSummary:       "EPHERA sandbox → bank transfer sim",
		Adapter:            s.Name(),
	}, nil
}

func (s *Sim) Execute(ctx context.Context, req adapter.ExecutionRequest) (adapter.ExecutionResult, error) {
	if req.AuthorisationRef == "" {
		return adapter.ExecutionResult{}, fmt.Errorf("missing authorisation evidence")
	}
	select {
	case <-ctx.Done():
		return adapter.ExecutionResult{}, ctx.Err()
	case <-time.After(40 * time.Millisecond):
	}
	res := adapter.ExecutionResult{
		ExecutionID: "bk_" + uuid.NewString(),
		Status:      "settled",
		ProviderRef: "BANK-SIM-" + req.IdempotencyKey,
		SettledAt:   time.Now().UTC(),
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
		return adapter.StatusResult{ExecutionID: executionID, Status: r.Status}, nil
	}
	return adapter.StatusResult{ExecutionID: executionID, Status: "unknown"}, nil
}
