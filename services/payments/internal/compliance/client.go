// Package compliance asks compliance-risk whether a payment may proceed.
//
// The check happens at prepare, before the customer is asked to authorise
// anything: refusing after a passkey prompt would be both a worse experience
// and a worse control, because the customer would have approved something the
// platform was never going to do.
package compliance

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Decision struct {
	Outcome             string   `json:"outcome"` // allow | review | deny
	Reasons             []string `json:"reasons"`
	Tier                string   `json:"tier"`
	RemainingDailyMinor int64    `json:"remainingDailyMinor"`
}

type Client struct {
	base   string
	token  string
	client *http.Client
}

func New(base string) *Client {
	return &Client{
		base:   base,
		token:  os.Getenv("COMPLIANCE_SERVICE_TOKEN"),
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

type Request struct {
	Subject       string `json:"subject"`
	AmountMinor   int64  `json:"amountMinor"`
	Currency      string `json:"currency"`
	RecipientName string `json:"recipientName"`
}

// Decide returns the compliance decision. An error means no decision was
// obtained, and the caller must treat that as a refusal: a compliance service
// that cannot be reached is not permission to proceed.
func (c *Client) Decide(ctx context.Context, req Request) (Decision, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return Decision{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/decisions", bytes.NewReader(body))
	if err != nil {
		return Decision{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		httpReq.Header.Set("X-Ephera-Service-Token", c.token)
	}
	res, err := c.client.Do(httpReq)
	if err != nil {
		return Decision{}, fmt.Errorf("compliance unreachable: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return Decision{}, fmt.Errorf("compliance refused to decide: %d", res.StatusCode)
	}
	var d Decision
	if err := json.NewDecoder(res.Body).Decode(&d); err != nil {
		return Decision{}, err
	}
	return d, nil
}
