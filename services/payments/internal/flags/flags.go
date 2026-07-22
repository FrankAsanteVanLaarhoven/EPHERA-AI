// Package flags tells the payment orchestrator whether sends are permitted.
//
// # Why this exists
//
// The kill switch used to flip an array in one console process that no service
// read (D-17). An operator could press "stop sends", see it succeed, and watch
// payments continue. A control that reports success while doing nothing is
// worse than no control, because nobody goes looking for the real problem.
//
// # What happens when the control plane is unreachable
//
// This is the decision that matters, and it is deliberately asymmetric.
//
//   - If the last known state was STOPPED, stay stopped. A kill switch that
//     forgets it was pressed because a control plane restarted is not a kill
//     switch. An outage must not resume payments.
//   - If the last known state was RUNNING, keep running, but say so loudly.
//     Halting every payment because a flag service hiccupped is its own harm,
//     borne entirely by customers who did nothing wrong.
//   - If nothing is known yet — cold start, control plane down — refuse.
//     Starting up unable to discover whether payments were stopped is exactly
//     when assuming "everything is fine" is least defensible.
//
// The asymmetry is the point: failures move toward the restrictive state, never
// away from it, and a resumption always requires the control plane to say so.
package flags

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

const SendsEnabled = "payments.sends_enabled"

// MaxStaleness bounds how long a cached value is trusted before it is treated
// as unknown. Short enough that a kill switch takes effect promptly; long
// enough that a brief outage does not stop a healthy platform.
const MaxStaleness = 30 * time.Second

type Client struct {
	base   string
	token  string
	client *http.Client

	mu        sync.RWMutex
	known     bool
	values    map[string]bool
	fetchedAt time.Time
}

func New(base string) *Client {
	return &Client{
		base:   base,
		token:  os.Getenv("CONTROL_SERVICE_TOKEN"),
		client: &http.Client{Timeout: 5 * time.Second},
		values: map[string]bool{},
	}
}

// Refresh pulls the current flags. Callers run it on a ticker; a failure leaves
// the previous values in place rather than clearing them.
func (c *Client) Refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/v1/flags", nil)
	if err != nil {
		return err
	}
	if c.token != "" {
		req.Header.Set("X-Ephera-Service-Token", c.token)
	}
	res, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("control plane unreachable: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("control plane refused the flag read: %d", res.StatusCode)
	}
	var body struct {
		Flags map[string]bool `json:"flags"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return err
	}

	c.mu.Lock()
	c.values = body.Flags
	c.known = true
	c.fetchedAt = time.Now()
	c.mu.Unlock()
	return nil
}

// Decision is the answer to "may sends proceed", with the reasoning attached so
// a refusal can be explained rather than just returned.
type Decision struct {
	Allowed bool
	Reason  string
	// Stale is true when the answer came from a cached value past its freshness
	// bound. The payment still proceeds or not on the value; this says the
	// platform is running on old information.
	Stale bool
}

// SendsAllowed applies the asymmetric rule described at the top of this file.
func (c *Client) SendsAllowed(now time.Time) Decision {
	c.mu.RLock()
	known, enabled, at := c.known, c.values[SendsEnabled], c.fetchedAt
	c.mu.RUnlock()

	if !known {
		// Nothing has ever been read. Refuse: this is exactly when assuming
		// payments are permitted is least defensible.
		return Decision{
			Allowed: false,
			Reason:  "payment controls are unknown; the control plane has not been reached since startup",
		}
	}
	stale := now.Sub(at) > MaxStaleness
	if !enabled {
		// Stopped stays stopped, fresh or stale.
		return Decision{Allowed: false, Reason: "sends are stopped by the platform kill switch", Stale: stale}
	}
	if stale {
		// Last known good was running. Continue, but the caller should surface
		// that the platform is operating on old information.
		return Decision{Allowed: true, Reason: "running on a stale control-plane value", Stale: true}
	}
	return Decision{Allowed: true}
}

// StartRefreshing polls in the background. It refreshes immediately so a cold
// start has a value as soon as the control plane is reachable.
func (c *Client) StartRefreshing(ctx context.Context, every time.Duration) {
	go func() {
		t := time.NewTicker(every)
		defer t.Stop()
		for {
			if err := c.Refresh(ctx); err != nil {
				// Logged every time: a platform that cannot read its own kill
				// switch should be noisy about it.
				log.Printf("WARNING: could not read platform flags: %v", err)
			}
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()
}
