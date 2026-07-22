package store

import (
	"errors"
	"math"
	"testing"
)

func validTransfer() TransferRequest {
	return TransferRequest{
		FromExternalRef:  "user:demo-self:GHS",
		ToExternalRef:    "user:ama:GHS",
		AmountMinor:      5000,
		Currency:         "GHS",
		TransferID:       "tx_1",
		IdempotencyKey:   "idem_1",
		AuthorisationRef: "ref_placeholder",
	}
}

func validHold() HoldRequest {
	return HoldRequest{
		FromExternalRef: "user:demo-self:GHS",
		AmountMinor:     5000,
		Currency:        "GHS",
		TransferID:      "tx_1",
		IdempotencyKey:  "idem_1",
	}
}

func TestTransferValidation(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*TransferRequest)
		wantErr bool
	}{
		{"valid", func(*TransferRequest) {}, false},

		// D-03. A negative amount inverted the direction of the transfer and
		// moved funds from the recipient to the sender. Reproduced against a
		// live ledger on 2026-07-21 before this check existed.
		{"negative amount", func(r *TransferRequest) { r.AmountMinor = -80000 }, true},
		{"zero amount", func(r *TransferRequest) { r.AmountMinor = 0 }, true},

		{"negative fee", func(r *TransferRequest) { r.FeeMinor = -1 }, true},
		{"fee overflows debit", func(r *TransferRequest) {
			r.AmountMinor = math.MaxInt64
			r.FeeMinor = 1
		}, true},

		{"same account both sides", func(r *TransferRequest) { r.ToExternalRef = r.FromExternalRef }, true},
		{"missing from", func(r *TransferRequest) { r.FromExternalRef = "" }, true},
		{"missing to", func(r *TransferRequest) { r.ToExternalRef = "" }, true},
		{"missing transfer id", func(r *TransferRequest) { r.TransferID = "" }, true},
		{"missing idempotency key", func(r *TransferRequest) { r.IdempotencyKey = "" }, true},

		{"lowercase currency", func(r *TransferRequest) { r.Currency = "ghs" }, true},
		{"empty currency", func(r *TransferRequest) { r.Currency = "" }, true},
		{"four letter currency", func(r *TransferRequest) { r.Currency = "GHSX" }, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := validTransfer()
			tc.mutate(&req)
			err := req.validate()
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected rejection, got nil")
				}
				if !errors.Is(err, ErrInvalidRequest) {
					t.Fatalf("expected ErrInvalidRequest, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("expected acceptance, got %v", err)
			}
		})
	}
}

func TestHoldValidation(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*HoldRequest)
		wantErr bool
	}{
		{"valid", func(*HoldRequest) {}, false},
		{"negative amount", func(r *HoldRequest) { r.AmountMinor = -1 }, true},
		{"zero amount", func(r *HoldRequest) { r.AmountMinor = 0 }, true},
		{"missing from", func(r *HoldRequest) { r.FromExternalRef = "" }, true},
		{"missing idempotency key", func(r *HoldRequest) { r.IdempotencyKey = "" }, true},
		{"bad currency", func(r *HoldRequest) { r.Currency = "gh" }, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := validHold()
			tc.mutate(&req)
			err := req.validate()
			if tc.wantErr && err == nil {
				t.Fatalf("expected rejection, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("expected acceptance, got %v", err)
			}
		})
	}
}
