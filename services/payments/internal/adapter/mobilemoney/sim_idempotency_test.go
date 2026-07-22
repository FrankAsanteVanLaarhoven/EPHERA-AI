package mobilemoney

import (
	"context"
	"testing"

	"github.com/ephera/payments/internal/adapter"
)

// H8: a rail must not deliver twice for the same idempotency key. Temporal
// retries an activity, so a payout whose result was lost to a timeout would be
// re-executed; keyed by the idempotency key, a repeat returns the first result.
func TestRailIsIdempotentOnTheKey(t *testing.T) {
	s := NewSim()
	req := adapter.ExecutionRequest{
		TransferID: "tx_abcdef12", IdempotencyKey: "idem_1",
		AmountMinor: 5000, Currency: "GHS", RecipientName: "Ama", AuthorisationRef: "grant",
	}
	first, err := s.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("first execute: %v", err)
	}
	second, err := s.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("second execute: %v", err)
	}
	if first.ExecutionID != second.ExecutionID {
		t.Fatalf("a retry produced a second execution (%s vs %s) — the rail delivered twice",
			first.ExecutionID, second.ExecutionID)
	}

	// A genuinely different payment (different key) is a separate execution.
	other := req
	other.IdempotencyKey = "idem_2"
	other.TransferID = "tx_99999999"
	third, _ := s.Execute(context.Background(), other)
	if third.ExecutionID == first.ExecutionID {
		t.Fatal("two different payments shared one execution")
	}
}
