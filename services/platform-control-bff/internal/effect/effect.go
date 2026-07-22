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
	// OperatorSession is the applying operator's session, forwarded so the
	// owning service verifies an authenticated operator itself rather than
	// trusting this service's say-so.
	OperatorSession string
}

type Applier interface {
	Apply(ctx context.Context, req Request) error
}

// HTTPApplier routes actions to the services that own them.
type HTTPApplier struct {
	LedgerURL string
	Client    *http.Client
}

func NewHTTPApplier(ledgerURL string) *HTTPApplier {
	return &HTTPApplier{LedgerURL: ledgerURL, Client: &http.Client{Timeout: 10 * time.Second}}
}

func (a *HTTPApplier) Apply(ctx context.Context, req Request) error {
	switch req.Action {
	case "wallet.freeze":
		return a.wallet(ctx, req, "freeze")
	case "wallet.unfreeze":
		return a.wallet(ctx, req, "unfreeze")
	default:
		// kill_switch, features.edit, provider.approve and mandate.change have
		// no owning service in this codebase yet. Refused, so that nothing is
		// recorded as applied when it was not.
		return fmt.Errorf("%w: %s", ErrNoOwningService, req.Action)
	}
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
