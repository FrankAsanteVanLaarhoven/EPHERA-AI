package main

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"os"
	"strings"
)

// Caller authentication for the ledger.
//
// Until now the ledger authenticated nobody (D-02). Anyone who could reach the
// port could read any balance, place and release holds, and -- through the
// legacy freeze endpoints, which accepted any non-empty string -- freeze a
// customer's account. Verifying authorisation grants (G2-A) stopped forged
// money movement; it did nothing about who was allowed to ask.
//
// Two kinds of caller are recognised:
//
//   - a platform service, presenting a shared service token. This is a sandbox
//     mechanism. Real service identity is mutual TLS or workload identity, which
//     this codebase cannot provide, so the token is explicitly a placeholder and
//     is documented as one rather than dressed up as more.
//   - an operator, presenting a session signed by identity-access. Only the
//     operator endpoints accept this.
//
// Everything fails closed. With no service token configured the ledger refuses
// service calls rather than falling back to accepting anyone.

type callerKind int

const (
	callerNone callerKind = iota
	callerService
	callerOperator
)

var (
	errNoCaller         = errors.New("caller is not authenticated")
	errNoServiceToken   = errors.New("ledger has no service token configured")
	errBadServiceToken  = errors.New("service token not recognised")
)

// serviceToken is read once at startup so a change requires a restart, and so
// the value is not re-read from the environment on every request.
var serviceToken string

func loadServiceToken() (string, bool) {
	serviceToken = os.Getenv("LEDGER_SERVICE_TOKEN")
	return serviceToken, serviceToken != ""
}

// authenticateService checks the shared service token in constant time.
func authenticateService(r *http.Request) error {
	if serviceToken == "" {
		return errNoServiceToken
	}
	presented := strings.TrimSpace(r.Header.Get("X-Ephera-Service-Token"))
	if presented == "" {
		return errNoCaller
	}
	if subtle.ConstantTimeCompare([]byte(presented), []byte(serviceToken)) != 1 {
		return errBadServiceToken
	}
	return nil
}

// requireService gates the endpoints only platform services should call.
func (s *server) requireService(w http.ResponseWriter, r *http.Request) bool {
	if err := authenticateService(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "caller_not_authenticated",
			"message": err.Error(),
		})
		return false
	}
	return true
}

// serviceOnly wraps a handler so an unauthenticated caller never reaches it.
func (s *server) serviceOnly(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.requireService(w, r) {
			return
		}
		h(w, r)
	}
}
