package airtime

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

func (s *Sim) Name() string { return "airtime-sim" }

func (s *Sim) Quote(_ context.Context, amountMinor int64, currency, _ string) (adapter.Quote, error) {
	return adapter.Quote{
		SendAmountMinor:    amountMinor,
		ReceiveAmountMinor: amountMinor,
		FeeMinor:           0,
		Currency:           currency,
		ReceiveCurrency:    currency,
		ETA:                "Instant (sim)",
		RouteSummary:       "EPHERA sandbox → airtime sim",
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
	case <-time.After(20 * time.Millisecond):
	}
	res := adapter.ExecutionResult{
		ExecutionID: "at_" + uuid.NewString(),
		Status:      "settled",
		ProviderRef: "AIRTIME-SIM",
		SettledAt:   time.Now().UTC(),
		Message:     "airtime top-up simulated",
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
