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
	Rail             string `json:"rail"` // mobile-money-sim | bank-transfer-sim
	AuthorisationRef string `json:"authorisationRef"`
	FailMode         string `json:"failMode,omitempty"`
}

type DomesticTransferResult struct {
	TransferID    string `json:"transferId"`
	Status        string `json:"status"`
	ExecutionID   string `json:"executionId"`
	ProviderRef   string `json:"providerRef"`
	FeeMinor      int64  `json:"feeMinor"`
	RouteSummary  string `json:"routeSummary"`
	ReceiptID     string `json:"receiptId"`
	Message       string `json:"message,omitempty"`
}

type AirtimeInput struct {
	TransferID       string `json:"transferId"`
	IdempotencyKey   string `json:"idempotencyKey"`
	AmountMinor      int64  `json:"amountMinor"`
	Currency         string `json:"currency"`
	PhoneHint        string `json:"phoneHint"`
	AuthorisationRef string `json:"authorisationRef"`
}

type Receipt struct {
	ID            string `json:"id"`
	TransferID    string `json:"transferId"`
	Summary       string `json:"summary"`
	Status        string `json:"status"`
	ProviderRef   string `json:"providerRef"`
	Authorisation string `json:"authorisation"`
}

// Activity names
const (
	TaskQueue = "ephera-payments"
)
