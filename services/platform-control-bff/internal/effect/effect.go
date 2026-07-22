// Package effect carries out an approved change against the service that owns
// the thing being changed.
//
// The control plane decides; it does not own customer accounts, feature flags
// or providers. Approving a change and recording that approval is not the same
// as the change happening, and until now it was only the former: an approved
// wallet freeze froze nothing (D-17).
//
// Actions with no owning service are refused rather than reported as applied.
// A control plane that says "applied" when nothing happened is worse than one
// that admits it cannot act.
package effect

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// ErrNoOwningService is returned for actions nothing implements yet.
var ErrNoOwningService = errors.New("no service owns this action yet")

// Request is an approved change to carry out.
type Request struct {
	Action string
	Target string
	// ChangeRequestID is the approval this is carried out under. The owning
	// service records it, so the effect traces back to the approval.
	ChangeRequestID string
	Reason          string
	// Payload carries action-specific values, such as which flag to change.
	Payload map[string]any
	// OperatorSession is the applying operator's session, forwarded so the
	// owning service verifies an authenticated operator itself rather than
	// trusting this service's say-so.
	OperatorSession string
}

type Applier interface {
	Apply(ctx context.Context, req Request) error
}

// FlagSetter is how the applier reaches the control plane's own flag store.
// The kill switch is the one action whose owning service is this service.
type FlagSetter interface {
	SetFlag(ctx context.Context, key string, enabled bool, changedBy, changeRequestID string) error
}

// HTTPApplier routes actions to the services that own them.
type HTTPApplier struct {
	LedgerURL string
	Client    *http.Client
	Flags     FlagSetter
}

func NewHTTPApplier(ledgerURL string, flags FlagSetter) *HTTPApplier {
	return &HTTPApplier{
		LedgerURL: ledgerURL,
		Client:    &http.Client{Timeout: 10 * time.Second},
		Flags:     flags,
	}
}

func (a *HTTPApplier) Apply(ctx context.Context, req Request) error {
	switch req.Action {
	case "wallet.freeze":
		return a.wallet(ctx, req, "freeze")
	case "wallet.unfreeze":
		return a.wallet(ctx, req, "unfreeze")
	case "kill_switch":
		// Stopping sends is the whole point of a kill switch, so it disables
		// rather than toggles: an operator reaching for it wants payments
		// stopped, not flipped to whatever the opposite of the current state
		// happens to be.
		return a.setFlag(ctx, req, "payments.sends_enabled", false)
	case "resume_payments":
		return a.setFlag(ctx, req, "payments.sends_enabled", true)
	case "features.edit":
		enabled, ok := req.Payload["enabled"].(bool)
		key, hasKey := req.Payload["key"].(string)
		if !ok || !hasKey {
			return fmt.Errorf("features.edit requires a key and an enabled value")
		}
		return a.setFlag(ctx, req, key, enabled)
	default:
		// provider.approve and mandate.change still have no owning service.
		// Refused, so that nothing is recorded as applied when it was not.
		return fmt.Errorf("%w: %s", ErrNoOwningService, req.Action)
	}
}

func (a *HTTPApplier) setFlag(ctx context.Context, req Request, key string, enabled bool) error {
	if a.Flags == nil {
		return fmt.Errorf("%w: no flag store configured", ErrNoOwningService)
	}
	return a.Flags.SetFlag(ctx, key, enabled, "change:"+req.ChangeRequestID, req.ChangeRequestID)
}

func (a *HTTPApplier) wallet(ctx context.Context, req Request, verb string) error {
	body, err := json.Marshal(map[string]string{
		"reason":          req.Reason,
		"changeRequestId": req.ChangeRequestID,
	})
	if err != nil {
		return err
	}
	endpoint := fmt.Sprintf("%s/v1/operator/accounts/%s/%s",
		a.LedgerURL, url.PathEscape(req.Target), verb)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+req.OperatorSession)

	res, err := a.Client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("ledger unreachable: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		var detail map[string]any
		_ = json.NewDecoder(res.Body).Decode(&detail)
		return fmt.Errorf("ledger refused the change: %d %v", res.StatusCode, detail)
	}
	return nil
}
