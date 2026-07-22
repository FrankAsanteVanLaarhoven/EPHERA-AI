package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/ephera/authgrant/session"
	"github.com/ephera/ledger/internal/store"
)

// Operator-initiated account restrictions.
//
// A customer payment is authorised by a passkey assertion bound to the exact
// transaction. An operator freeze is authorised differently: the authority is
// an approved change request, carried out by an authenticated operator. Both
// are verified here, because the ledger is the authority for account state and
// must not accept either on trust (ADR 0001, ADR 0002).
//
// The freeze path previously accepted any non-empty string, which is the same
// weakness capture had before G2-A.

type operatorFreezeRequest struct {
	Reason          string `json:"reason"`
	ChangeRequestID string `json:"changeRequestId"`
}

// operatorSession verifies the bearer session and returns the operator.
func (s *server) operatorSession(r *http.Request) (session.Payload, error) {
	raw := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(raw), "bearer ") {
		return session.Payload{}, errMissingSession
	}
	token := strings.TrimSpace(raw[len("bearer "):])
	pub := s.st.AuthorisationKey()
	if len(pub) == 0 {
		return session.Payload{}, errNoKey
	}
	return session.Verify(pub, token, time.Now())
}

func (s *server) operatorFreeze(w http.ResponseWriter, r *http.Request) {
	s.operatorSetFrozen(w, r, true)
}

func (s *server) operatorUnfreeze(w http.ResponseWriter, r *http.Request) {
	s.operatorSetFrozen(w, r, false)
}

func (s *server) operatorSetFrozen(w http.ResponseWriter, r *http.Request, freeze bool) {
	ref := r.PathValue("ref")
	op, err := s.operatorSession(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "operator_session_required",
			"message": err.Error(),
		})
		return
	}

	var body operatorFreezeRequest
	_ = json.NewDecoder(r.Body).Decode(&body)
	// An approved change is the authority for this. Without a reference there is
	// nothing to check the action back against, so it is refused.
	if strings.TrimSpace(body.ChangeRequestID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "change_request_required",
			"message": "An operator freeze must cite the approved change that authorised it.",
		})
		return
	}
	if body.Reason == "" {
		body.Reason = "operator_action"
	}

	authority := store.FreezeAuthority{
		OperatorSubject: op.Subject,
		ChangeRequestID: body.ChangeRequestID,
		Method:          "operator_session",
	}

	var a store.Account
	if freeze {
		a, err = s.st.FreezeBy(r.Context(), ref, body.Reason, authority)
	} else {
		a, err = s.st.UnfreezeBy(r.Context(), ref, authority)
	}
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}
