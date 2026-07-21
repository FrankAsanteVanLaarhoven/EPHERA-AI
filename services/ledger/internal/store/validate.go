package store

import (
	"fmt"
	"math"
	"regexp"
)

// Request validation for the ledger.
//
// The ledger is the authority for balances (ADR 0001), so it validates its own
// inputs rather than relying on the payment orchestrator to have done it. The
// orchestrator does check amount positivity; the ledger did not, and a direct
// call with a negative amount inverted the direction of a transfer (D-03).

var currencyRe = regexp.MustCompile(`^[A-Z]{3}$`)

func requireCurrency(code string) error {
	if !currencyRe.MatchString(code) {
		return fmt.Errorf("%w: currency must be three uppercase letters, got %q", ErrInvalidRequest, code)
	}
	return nil
}

func requirePositive(field string, amountMinor int64) error {
	if amountMinor <= 0 {
		return fmt.Errorf("%w: %s must be positive, got %d", ErrInvalidRequest, field, amountMinor)
	}
	return nil
}

func requireNonEmpty(field, value string) error {
	if value == "" {
		return fmt.Errorf("%w: %s is required", ErrInvalidRequest, field)
	}
	return nil
}

func (r HoldRequest) validate() error {
	if err := requireNonEmpty("fromExternalRef", r.FromExternalRef); err != nil {
		return err
	}
	if err := requireNonEmpty("transferId", r.TransferID); err != nil {
		return err
	}
	if err := requireNonEmpty("idempotencyKey", r.IdempotencyKey); err != nil {
		return err
	}
	if err := requirePositive("amountMinor", r.AmountMinor); err != nil {
		return err
	}
	return requireCurrency(r.Currency)
}

func (r TransferRequest) validate() error {
	if err := requireNonEmpty("fromExternalRef", r.FromExternalRef); err != nil {
		return err
	}
	if err := requireNonEmpty("toExternalRef", r.ToExternalRef); err != nil {
		return err
	}
	if r.FromExternalRef == r.ToExternalRef {
		return fmt.Errorf("%w: fromExternalRef and toExternalRef must differ", ErrInvalidRequest)
	}
	if err := requireNonEmpty("transferId", r.TransferID); err != nil {
		return err
	}
	if err := requireNonEmpty("idempotencyKey", r.IdempotencyKey); err != nil {
		return err
	}
	if err := requirePositive("amountMinor", r.AmountMinor); err != nil {
		return err
	}
	if r.FeeMinor < 0 {
		return fmt.Errorf("%w: feeMinor must not be negative, got %d", ErrInvalidRequest, r.FeeMinor)
	}
	// The sender is debited amount + fee in one transaction; refuse inputs that
	// would overflow the sum rather than wrapping into a credit.
	if r.FeeMinor > math.MaxInt64-r.AmountMinor {
		return fmt.Errorf("%w: amountMinor + feeMinor overflows", ErrInvalidRequest)
	}
	return requireCurrency(r.Currency)
}
