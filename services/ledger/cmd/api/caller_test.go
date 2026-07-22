package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// Caller authentication (D-02).
//
// These need no database: they assert that an unauthenticated request never
// reaches a handler. That is the whole point of the boundary — the ledger used
// to run every handler for anyone who could reach the port.

func withServiceToken(t *testing.T, token string) {
	t.Helper()
	previous := serviceToken
	serviceToken = token
	t.Cleanup(func() { serviceToken = previous })
}

// A handler that records whether it ran, so a passing auth check is
// distinguishable from a handler that quietly did nothing.
func recordingHandler(ran *bool) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		*ran = true
		w.WriteHeader(http.StatusOK)
	}
}

func TestServiceRoutesRefuseAnUnauthenticatedCaller(t *testing.T) {
	withServiceToken(t, "correct-token")
	s := &server{}

	var ran bool
	h := s.serviceOnly(recordingHandler(&ran))

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/accounts/user:demo-self:GHS", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated caller got %d, expected 401", rec.Code)
	}
	if ran {
		t.Fatal("the handler ran for an unauthenticated caller")
	}
}

func TestServiceRoutesRefuseAWrongToken(t *testing.T) {
	withServiceToken(t, "correct-token")
	s := &server{}

	var ran bool
	h := s.serviceOnly(recordingHandler(&ran))

	req := httptest.NewRequest(http.MethodPost, "/v1/transfers", nil)
	req.Header.Set("X-Ephera-Service-Token", "wrong-token")
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong token got %d, expected 401", rec.Code)
	}
	if ran {
		t.Fatal("the handler ran for a caller with the wrong token")
	}
}

// A token that shares a prefix with the real one must not pass. This is what a
// non-constant-time comparison would leak, and what a prefix comparison would
// wrongly accept.
func TestServiceRoutesRefuseAPrefixOfTheToken(t *testing.T) {
	withServiceToken(t, "correct-token")
	s := &server{}

	for _, attempt := range []string{"correct", "correct-toke", "correct-token-extra", ""} {
		var ran bool
		h := s.serviceOnly(recordingHandler(&ran))
		req := httptest.NewRequest(http.MethodPost, "/v1/holds", nil)
		if attempt != "" {
			req.Header.Set("X-Ephera-Service-Token", attempt)
		}
		rec := httptest.NewRecorder()
		h(rec, req)
		if rec.Code != http.StatusUnauthorized || ran {
			t.Fatalf("token %q was accepted", attempt)
		}
	}
}

func TestServiceRoutesAcceptTheConfiguredToken(t *testing.T) {
	withServiceToken(t, "correct-token")
	s := &server{}

	var ran bool
	h := s.serviceOnly(recordingHandler(&ran))

	req := httptest.NewRequest(http.MethodPost, "/v1/transfers", nil)
	req.Header.Set("X-Ephera-Service-Token", "correct-token")
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK || !ran {
		t.Fatalf("the configured token was refused: %d", rec.Code)
	}
}

// With no token configured the ledger must refuse service calls, not accept
// everyone. Failing open here would reinstate exactly the defect being fixed.
func TestNoConfiguredTokenFailsClosed(t *testing.T) {
	withServiceToken(t, "")
	s := &server{}

	var ran bool
	h := s.serviceOnly(recordingHandler(&ran))

	req := httptest.NewRequest(http.MethodGet, "/v1/accounts/x", nil)
	req.Header.Set("X-Ephera-Service-Token", "anything")
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("with no token configured the caller got %d, expected 401", rec.Code)
	}
	if ran {
		t.Fatal("the handler ran with no service token configured")
	}
}
