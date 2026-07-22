package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ephera/ledger/internal/store"
)

type server struct {
	st *store.Store
}

func main() {
	dbURL := env("LEDGER_DATABASE_URL", "postgres://ephera:ephera_dev_only@localhost:5433/ephera_ledger?sslmode=disable")
	httpAddr := env("LEDGER_HTTP_ADDR", ":8092")

	ctx := context.Background()
	st, err := store.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("ledger db: %v", err)
	}
	defer st.Close()

	// Authorisation grants are verified against the identity service's public
	// key (ADR 0002). Without it the ledger cannot distinguish a real grant
	// from a forged one, so it refuses every transfer rather than falling back
	// to accepting an unverified string.
	pubHex := os.Getenv("LEDGER_AUTH_PUBLIC_KEY")
	if pubHex == "" {
		log.Printf("WARNING: LEDGER_AUTH_PUBLIC_KEY is not set. " +
			"Transfers will be refused until an authorisation public key is configured.")
	} else {
		pub, err := store.ParseAuthorisationKey(pubHex)
		if err != nil {
			log.Fatalf("authorisation key: %v", err)
		}
		st.SetAuthorisationKey(pub)
		log.Printf("authorisation grants verified against key %s...", pubHex[:16])
	}

	// Sandbox authenticator grants (minted with no real challenge) post money
	// only where this is explicitly enabled. Default is closed: an environment
	// that says nothing refuses them.
	if env("EPHERA_ENV", "production") == "sandbox" || os.Getenv("LEDGER_ALLOW_SANDBOX_AUTHENTICATOR") == "true" {
		st.AllowSandboxMethod(true)
		log.Printf("WARNING: sandbox authenticator grants are ACCEPTED by this ledger")
	}

	// Callers must authenticate (D-02). Without a service token the ledger
	// refuses every service call rather than accepting anyone who can reach it.
	if _, ok := loadServiceToken(); !ok {
		log.Printf("WARNING: LEDGER_SERVICE_TOKEN is not set. " +
			"Service calls will be refused until a caller credential is configured.")
	} else {
		log.Printf("service callers must present X-Ephera-Service-Token")
	}

	s := &server{st: st}
	mux := http.NewServeMux()
	// Health is the only unauthenticated route: it reveals nothing and a
	// liveness probe cannot hold a credential.
	mux.HandleFunc("GET /health", s.health)

	// Platform services.
	mux.HandleFunc("GET /v1/accounts/{ref}", s.serviceOnly(s.getAccount))
	mux.HandleFunc("POST /v1/accounts/{ref}/freeze", s.serviceOnly(s.freeze))
	mux.HandleFunc("POST /v1/accounts/{ref}/unfreeze", s.serviceOnly(s.unfreeze))
	mux.HandleFunc("POST /v1/holds", s.serviceOnly(s.hold))
	mux.HandleFunc("POST /v1/holds/{id}/release", s.serviceOnly(s.releaseHold))
	mux.HandleFunc("POST /v1/transfers", s.serviceOnly(s.transfer))

	// Operators, authenticated by their own session.
	mux.HandleFunc("GET /v1/receipts/{id}", s.serviceOnly(s.getReceipt))
	mux.HandleFunc("GET /v1/transfers/{id}/receipt", s.serviceOnly(s.getReceiptForTransfer))
	// Service-token gated: only the control plane, which enforces maker-checker,
	// may apply an operator freeze. The operator session it forwards is verified
	// inside the handler for the evidence trail and the role check.
	mux.HandleFunc("POST /v1/operator/accounts/{ref}/freeze", s.serviceOnly(s.operatorFreeze))
	mux.HandleFunc("POST /v1/operator/accounts/{ref}/unfreeze", s.serviceOnly(s.operatorUnfreeze))

	log.Printf("EPHERA ledger API on %s", httpAddr)
	// No CORS. The ledger is not a browser-facing service: customer surfaces go
	// through the payment orchestrator, and operators through the control plane.
	// The previous wildcard origin invited exactly the direct access this gate
	// is closing.
	if err := http.ListenAndServe(httpAddr, mux); err != nil {
		log.Fatal(err)
	}
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "ledger"})
}

func (s *server) getAccount(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	a, err := s.st.GetByExternalRef(r.Context(), ref)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *server) freeze(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	var body struct {
		Reason           string `json:"reason"`
		AuthorisationRef string `json:"authorisationRef"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.AuthorisationRef == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "authorisation_required",
			"message": "Passkey required to freeze wallet",
		})
		return
	}
	if body.Reason == "" {
		body.Reason = "user_requested"
	}
	a, err := s.st.Freeze(r.Context(), ref, body.Reason)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *server) unfreeze(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	var body struct {
		AuthorisationRef string `json:"authorisationRef"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.AuthorisationRef == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authorisation_required"})
		return
	}
	a, err := s.st.Unfreeze(r.Context(), ref)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *server) hold(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FromExternalRef string `json:"fromExternalRef"`
		AmountMinor     int64  `json:"amountMinor"`
		Currency        string `json:"currency"`
		TransferID      string `json:"transferId"`
		IdempotencyKey  string `json:"idempotencyKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	id, err := s.st.PlaceHold(r.Context(), store.HoldRequest{
		FromExternalRef: body.FromExternalRef,
		AmountMinor:     body.AmountMinor,
		Currency:        body.Currency,
		TransferID:      body.TransferID,
		IdempotencyKey:  body.IdempotencyKey,
	})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"holdId": id})
}

func (s *server) releaseHold(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.st.ReleaseHold(r.Context(), id); err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "released"})
}

func (s *server) transfer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FromExternalRef  string `json:"fromExternalRef"`
		ToExternalRef    string `json:"toExternalRef"`
		AmountMinor      int64  `json:"amountMinor"`
		Currency         string `json:"currency"`
		TransferID       string `json:"transferId"`
		IdempotencyKey   string `json:"idempotencyKey"`
		AuthorisationRef string `json:"authorisationRef"`
		HoldID           string `json:"holdId"`
		Description      string `json:"description"`
		FeeMinor         int64  `json:"feeMinor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	je, err := s.st.CaptureTransfer(r.Context(), store.TransferRequest{
		FromExternalRef:  body.FromExternalRef,
		ToExternalRef:    body.ToExternalRef,
		AmountMinor:      body.AmountMinor,
		Currency:         body.Currency,
		TransferID:       body.TransferID,
		IdempotencyKey:   body.IdempotencyKey,
		AuthorisationRef: body.AuthorisationRef,
		HoldID:           body.HoldID,
		Description:      body.Description,
		FeeMinor:         body.FeeMinor,
	})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"journalEntryId": je, "status": "posted"})
}

var (
	errMissingSession = errors.New("missing bearer operator session")
	errNoKey          = errors.New("ledger has no authorisation public key configured")
)

// getReceipt returns a receipt and says whether it still matches its own hash.
// A caller displaying a receipt to a customer should not have to take its
// integrity on trust any more than the customer should.
func (s *server) getReceipt(w http.ResponseWriter, r *http.Request) {
	rec, intact, err := s.st.VerifyReceipt(r.Context(), r.PathValue("id"))
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"receipt": rec, "intact": intact})
}

func (s *server) getReceiptForTransfer(w http.ResponseWriter, r *http.Request) {
	rec, err := s.st.ReceiptForTransfer(r.Context(), r.PathValue("id"))
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"receipt": rec, "intact": rec.Hash() == rec.ContentHash})
}

func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrInvalidRequest):
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request",
			"message": err.Error(),
		})
	case errors.Is(err, store.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
	case errors.Is(err, store.ErrInsufficientFunds):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "insufficient_funds"})
	case errors.Is(err, store.ErrFrozen):
		writeJSON(w, http.StatusLocked, map[string]string{"error": "account_frozen"})
	case errors.Is(err, store.ErrGrantAlreadyUsed):
		writeJSON(w, http.StatusConflict, map[string]string{
			"error":   "authorisation_grant_already_used",
			"message": "This authorisation grant has already been used. Grants are single use.",
		})
	case errors.Is(err, store.ErrGrantNotVerifiable):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "authorisation_unverifiable",
			"message": "No authorisation public key is configured; the ledger cannot verify grants.",
		})
	case errors.Is(err, store.ErrUnauthorised):
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "authorisation_required",
			"message": err.Error(),
		})
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}


func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// silence unused import if any
var _ = time.Second
