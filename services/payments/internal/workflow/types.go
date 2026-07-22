package workflow

// DomesticTransferInput is the Temporal workflow input.
// AuthorisationRef must be set before Execute activity runs.
type DomesticTransferInput struct {
	TransferID       string `json:"transferId"`
	IdempotencyKey   string `json:"idempotencyKey"`
	AmountMinor      int64  `json:"amountMinor"`
	Currency         string `json:"currency"`
	RecipientName    string `json:"recipientName"`
	RecipientHint    string `json:"recipientHint"`
	FromExternalRef  string `json:"fromExternalRef"`
	ToExternalRef    string `json:"toExternalRef"`
	Rail             string `json:"rail"` // mobile-money-sim | bank-transfer-sim
	// FeeMinor is fixed when the transfer is prepared and is covered by the
	// authorisation grant's binding. It is not recomputed later, so the fee the
	// user authorised is the fee the ledger posts (ADR 0005).
	FeeMinor         int64  `json:"feeMinor"`
	AuthorisationRef string `json:"authorisationRef"`
	FailMode         string `json:"failMode,omitempty"`
}

type DomesticTransferResult struct {
	TransferID     string `json:"transferId"`
	Status         string `json:"status"`
	ExecutionID    string `json:"executionId"`
	ProviderRef    string `json:"providerRef"`
	FeeMinor       int64  `json:"feeMinor"`
	RouteSummary   string `json:"routeSummary"`
	ReceiptID      string `json:"receiptId"`
	JournalEntryID string `json:"journalEntryId,omitempty"`
	Message        string `json:"message,omitempty"`
}

type AirtimeInput struct {
	TransferID       string `json:"transferId"`
	IdempotencyKey   string `json:"idempotencyKey"`
	AmountMinor      int64  `json:"amountMinor"`
	Currency         string `json:"currency"`
	PhoneHint        string `json:"phoneHint"`
	FromExternalRef  string `json:"fromExternalRef"`
	AuthorisationRef string `json:"authorisationRef"`
}

type Receipt struct {
	ID            string `json:"id"`
	TransferID    string `json:"transferId"`
	Summary       string `json:"summary"`
	Status        string `json:"status"`
	ProviderRef   string `json:"providerRef"`
	Authorisation string `json:"authorisation"`
	// Carried from the ledger's own receipt when the payment posted. Empty on a
	// failure, which is the honest answer: nothing was posted to cite.
	LedgerEntryID       string `json:"ledgerEntryId,omitempty"`
	AmountMinor         int64  `json:"amountMinor,omitempty"`
	FeeMinor            int64  `json:"feeMinor,omitempty"`
	Currency            string `json:"currency,omitempty"`
	AuthorisationMethod string `json:"authorisationMethod,omitempty"`
	ContentHash         string `json:"contentHash,omitempty"`
	Verified            bool   `json:"verified,omitempty"`
}

const TaskQueue = "ephera-payments"
