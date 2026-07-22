// Package compliance is the control plane's client for compliance-risk.
//
// The console never holds the compliance service token. A service credential
// in a browser is how the provider portal ended up handing out a payments-write
// secret in an HTTP response (D-09). The console authenticates its operator to
// the control plane, the control plane checks the operator's role, and only
// then does it call compliance-risk with a credential the browser never sees.
package compliance

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

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

// do performs a call and returns the decoded body. Errors carry the upstream
// status so an operator sees why rather than a generic failure.
func (c *Client) do(ctx context.Context, method, path string, body any) (map[string]any, int, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rdr)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("X-Ephera-Service-Token", c.token)
	}
	res, err := c.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("compliance unreachable: %w", err)
	}
	defer res.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return out, res.StatusCode, nil
}

func (c *Client) ListCases(ctx context.Context) (map[string]any, int, error) {
	return c.do(ctx, http.MethodGet, "/v1/cases", nil)
}

func (c *Client) CloseCase(ctx context.Context, id, status, closedBy, note string) (map[string]any, int, error) {
	return c.do(ctx, http.MethodPost, "/v1/cases/"+id+"/close", map[string]string{
		"status": status, "closedBy": closedBy, "note": note,
	})
}

func (c *Client) Subject(ctx context.Context, subject string) (map[string]any, int, error) {
	return c.do(ctx, http.MethodGet, "/v1/customers/"+subject, nil)
}

func (c *Client) Requirements(ctx context.Context, subject, tier string) (map[string]any, int, error) {
	return c.do(ctx, http.MethodGet, "/v1/subjects/"+subject+"/requirements?tier="+tier, nil)
}

func (c *Client) ReviewDocument(ctx context.Context, id, status, reviewedBy, note string) (map[string]any, int, error) {
	return c.do(ctx, http.MethodPost, "/v1/documents/"+id+"/review", map[string]string{
		"status": status, "reviewedBy": reviewedBy, "note": note,
	})
}

func (c *Client) SetTier(ctx context.Context, subject, tier, decidedBy, reason string) (map[string]any, int, error) {
	return c.do(ctx, http.MethodPost, "/v1/customers/"+subject+"/tier", map[string]string{
		"tier": tier, "decidedBy": decidedBy, "reason": reason,
	})
}
