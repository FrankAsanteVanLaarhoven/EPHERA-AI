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

	s := &server{st: st}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/accounts/{ref}", s.getAccount)
	mux.HandleFunc("POST /v1/accounts/{ref}/freeze", s.freeze)
	mux.HandleFunc("POST /v1/accounts/{ref}/unfreeze", s.unfreeze)
	mux.HandleFunc("POST /v1/holds", s.hold)
	mux.HandleFunc("POST /v1/holds/{id}/release", s.releaseHold)
	mux.HandleFunc("POST /v1/transfers", s.transfer)

	log.Printf("EPHERA ledger API on %s", httpAddr)
	if err := http.ListenAndServe(httpAddr, withCORS(mux)); err != nil {
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
	case errors.Is(err, store.ErrUnauthorised):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authorisation_required"})
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// silence unused import if any
var _ = time.Second
