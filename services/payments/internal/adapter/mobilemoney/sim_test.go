package mobilemoney

import (
	"context"
	"testing"

	"github.com/ephera/payments/internal/adapter"
)

func TestQuote(t *testing.T) {
	s := NewSim()
	q, err := s.Quote(context.Background(), 5000, "GHS", "GHS")
	if err != nil {
		t.Fatal(err)
	}
	if q.SendAmountMinor != 5000 {
		t.Fatalf("amount %d", q.SendAmountMinor)
	}
}

func TestExecuteWithoutAuthFails(t *testing.T) {
	s := NewSim()
	_, err := s.Execute(context.Background(), adapter.ExecutionRequest{
		TransferID:     "tx1",
		IdempotencyKey: "idem1",
		AmountMinor:    5000,
		Currency:       "GHS",
		RecipientName:  "Ama",
	})
	if err == nil {
		t.Fatal("expected missing auth error")
	}
}

func TestExecuteWithAuthSettles(t *testing.T) {
	s := NewSim()
	res, err := s.Execute(context.Background(), adapter.ExecutionRequest{
		TransferID:       "tx1tx1tx1",
		IdempotencyKey:   "idem1",
		AmountMinor:      5000,
		Currency:         "GHS",
		RecipientName:    "Ama",
		AuthorisationRef: "passkey_demo_abc123",
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != "settled" {
		t.Fatalf("status %s", res.Status)
	}
}
