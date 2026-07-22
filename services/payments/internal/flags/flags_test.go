package flags

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func clientWith(t *testing.T, enabled bool, token string) (*Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" && r.Header.Get("X-Ephera-Service-Token") != token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"flags":{"payments.sends_enabled":` + boolStr(enabled) + `}}`))
	}))
	t.Cleanup(srv.Close)
	c := New(srv.URL)
	c.token = token
	return c, srv
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// A cold start that has never reached the control plane must refuse. Assuming
// payments are permitted is least defensible exactly here.
func TestUnknownStateRefuses(t *testing.T) {
	c := New("http://127.0.0.1:1")
	d := c.SendsAllowed(time.Now())
	if d.Allowed {
		t.Fatal("payments were allowed before any control-plane value was read")
	}
	if d.Reason == "" {
		t.Fatal("a refusal with no reason cannot be explained to anyone")
	}
}

func TestEnabledFlagAllowsSends(t *testing.T) {
	c, _ := clientWith(t, true, "")
	if err := c.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if d := c.SendsAllowed(time.Now()); !d.Allowed {
		t.Fatalf("sends refused: %s", d.Reason)
	}
}

func TestKillSwitchStopsSends(t *testing.T) {
	c, _ := clientWith(t, false, "")
	if err := c.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	d := c.SendsAllowed(time.Now())
	if d.Allowed {
		t.Fatal("the kill switch did not stop sends")
	}
	if d.Reason == "" {
		t.Fatal("no reason given for the stop")
	}
}

// The asymmetry. Once stopped, an unreachable control plane must not resume
// payments — a kill switch that forgets it was pressed is not a kill switch.
func TestStoppedStaysStoppedWhenTheControlPlaneGoesAway(t *testing.T) {
	c, srv := clientWith(t, false, "")
	if err := c.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	srv.Close() // control plane gone

	// Even far beyond the freshness bound.
	d := c.SendsAllowed(time.Now().Add(24 * time.Hour))
	if d.Allowed {
		t.Fatal("a stale kill switch resumed payments")
	}
	if !d.Stale {
		t.Fatal("the decision did not report that it was stale")
	}
}

// The other half of the asymmetry. A healthy platform must not halt every
// payment because a flag service hiccupped; that harm falls on customers who
// did nothing wrong. It continues, but says it is running on old information.
func TestRunningContinuesWhenStaleButSaysSo(t *testing.T) {
	c, srv := clientWith(t, true, "")
	if err := c.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	srv.Close()

	d := c.SendsAllowed(time.Now().Add(MaxStaleness + time.Minute))
	if !d.Allowed {
		t.Fatal("a brief control-plane outage stopped a healthy platform")
	}
	if !d.Stale {
		t.Fatal("running on a stale value was not reported")
	}
}

// A failed refresh must not clear what is already known, or every outage would
// reset the platform to "unknown" and stop payments.
func TestFailedRefreshKeepsTheLastKnownValue(t *testing.T) {
	c, srv := clientWith(t, true, "")
	if err := c.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	srv.Close()
	if err := c.Refresh(context.Background()); err == nil {
		t.Fatal("expected the refresh against a closed server to fail")
	}
	if d := c.SendsAllowed(time.Now()); !d.Allowed {
		t.Fatalf("a failed refresh discarded a known-good value: %s", d.Reason)
	}
}

// Resuming requires the control plane to say so, not merely the passage of time.
func TestResumeRequiresTheControlPlane(t *testing.T) {
	stopped, srv := clientWith(t, false, "")
	if err := stopped.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if stopped.SendsAllowed(time.Now()).Allowed {
		t.Fatal("stopped platform allowed sends")
	}
	srv.Close()

	// A new control plane that says sends are enabled is what resumes them.
	resumed := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"flags":{"payments.sends_enabled":true}}`))
	}))
	defer resumed.Close()
	stopped.base = resumed.URL
	if err := stopped.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if !stopped.SendsAllowed(time.Now()).Allowed {
		t.Fatal("the control plane said resume and sends stayed stopped")
	}
}

func TestServiceTokenIsRequired(t *testing.T) {
	c, _ := clientWith(t, true, "expected-token")
	c.token = "wrong-token"
	if err := c.Refresh(context.Background()); err == nil {
		t.Fatal("the flag read succeeded with the wrong service token")
	}
	// And the platform is then in the unknown state, which refuses.
	if c.SendsAllowed(time.Now()).Allowed {
		t.Fatal("payments allowed with no readable control plane")
	}
}
