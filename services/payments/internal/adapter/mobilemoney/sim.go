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
	// byKey deduplicates executions by idempotency key so a retry does not
	// deliver twice.
	byKey map[string]adapter.ExecutionResult
}

func NewSim() *Sim {
	return &Sim{store: make(map[string]adapter.ExecutionResult), byKey: make(map[string]adapter.ExecutionResult)}
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

	// Idempotency (H8). A rail is the one operation that most needs it: Temporal
	// retries an activity up to its maximum attempts, and a payout that succeeded
	// but whose result was lost to a timeout would otherwise be executed again.
	// A real provider double-pays; this sim used to as well, minting a fresh
	// execution each call. Keyed by the idempotency key, a repeat returns the
	// first result rather than delivering twice.
	if req.IdempotencyKey != "" {
		s.mu.Lock()
		prev, ok := s.byKey[req.IdempotencyKey]
		s.mu.Unlock()
		if ok {
			return prev, nil
		}
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
	if req.IdempotencyKey != "" {
		s.byKey[req.IdempotencyKey] = res
	}
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
