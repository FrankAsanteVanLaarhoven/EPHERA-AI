package ledgerclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type Client struct {
	base   string
	token  string
	client *http.Client
}

// New builds a ledger client. The service token identifies this service to the
// ledger, which authenticates every caller (D-02). It is read from the
// environment rather than passed around, so it cannot end up in a log line or a
// workflow input.
func New(base string) *Client {
	return &Client{
		base:  base,
		token: os.Getenv("LEDGER_SERVICE_TOKEN"),
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

type Account struct {
	ExternalRef string `json:"externalRef"`
	Status      string `json:"status"`
	Balance     int64  `json:"balanceMinor"`
	Hold        int64  `json:"holdMinor"`
	Available   int64  `json:"availableMinor"`
	Currency    string `json:"currency"`
}

func (c *Client) GetAccount(ctx context.Context, ref string) (Account, error) {
	var a Account
	err := c.do(ctx, http.MethodGet, "/v1/accounts/"+url.PathEscape(ref), nil, &a)
	return a, err
}

func (c *Client) PlaceHold(ctx context.Context, from string, amount int64, currency, transferID, idem string) (string, error) {
	var out struct {
		HoldID string `json:"holdId"`
	}
	err := c.do(ctx, http.MethodPost, "/v1/holds", map[string]any{
		"fromExternalRef": from,
		"amountMinor":     amount,
		"currency":        currency,
		"transferId":      transferID,
		"idempotencyKey":  idem,
	}, &out)
	return out.HoldID, err
}

func (c *Client) ReleaseHold(ctx context.Context, holdID string) error {
	return c.do(ctx, http.MethodPost, "/v1/holds/"+url.PathEscape(holdID)+"/release", map[string]any{}, nil)
}

func (c *Client) CaptureTransfer(ctx context.Context, body map[string]any) (string, error) {
	var out struct {
		JournalEntryID string `json:"journalEntryId"`
	}
	err := c.do(ctx, http.MethodPost, "/v1/transfers", body, &out)
	return out.JournalEntryID, err
}

func (c *Client) Freeze(ctx context.Context, ref, reason, authRef string) (Account, error) {
	var a Account
	err := c.do(ctx, http.MethodPost, "/v1/accounts/"+url.PathEscape(ref)+"/freeze", map[string]any{
		"reason":           reason,
		"authorisationRef": authRef,
	}, &a)
	return a, err
}

func (c *Client) Unfreeze(ctx context.Context, ref, authRef string) (Account, error) {
	var a Account
	err := c.do(ctx, http.MethodPost, "/v1/accounts/"+url.PathEscape(ref)+"/unfreeze", map[string]any{
		"authorisationRef": authRef,
	}, &a)
	return a, err
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rdr)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("X-Ephera-Service-Token", c.token)
	}
	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("ledger %s %s: %s — %s", method, path, res.Status, string(data))
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

// LedgerReceipt is the receipt the ledger issued in the same transaction as the
// postings. Intact is the ledger's own re-computation of the content hash.
type LedgerReceipt struct {
	ID                  string `json:"id"`
	TransferID          string `json:"transferId"`
	JournalEntryID      string `json:"journalEntryId"`
	AmountMinor         int64  `json:"amountMinor"`
	FeeMinor            int64  `json:"feeMinor"`
	Currency            string `json:"currency"`
	Description         string `json:"description"`
	AuthorisationMethod string `json:"authorisationMethod"`
	GrantID             string `json:"grantId"`
	IssuedAt            string `json:"issuedAt"`
	ContentHash         string `json:"contentHash"`
}

func (c *Client) ReceiptForTransfer(ctx context.Context, transferID string) (LedgerReceipt, bool, error) {
	var out struct {
		Receipt LedgerReceipt `json:"receipt"`
		Intact  bool          `json:"intact"`
	}
	err := c.do(ctx, http.MethodGet, "/v1/transfers/"+transferID+"/receipt", nil, &out)
	return out.Receipt, out.Intact, err
}
