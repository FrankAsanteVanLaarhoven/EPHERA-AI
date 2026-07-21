package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ephera/payments/internal/ledgerclient"
	"github.com/ephera/payments/internal/workflow"
	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
)

type server struct {
	tc     client.Client
	ledger *ledgerclient.Client
}

type quoteRequest struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
	Rail        string `json:"rail"`
}

type transferRequest struct {
	AmountMinor      int64  `json:"amountMinor"`
	Currency         string `json:"currency"`
	RecipientName    string `json:"recipientName"`
	RecipientHint    string `json:"recipientHint"`
	FromExternalRef  string `json:"fromExternalRef"`
	ToExternalRef    string `json:"toExternalRef"`
	Rail             string `json:"rail"`
	AuthorisationRef string `json:"authorisationRef"`
	IdempotencyKey   string `json:"idempotencyKey"`
	FailMode         string `json:"failMode,omitempty"`
}

func main() {
	addr := env("TEMPORAL_ADDRESS", "localhost:7233")
	httpAddr := env("PAYMENTS_HTTP_ADDR", ":8090")
	ledgerURL := env("LEDGER_URL", "http://localhost:8092")

	tc, err := client.Dial(client.Options{HostPort: addr})
	if err != nil {
		log.Fatalf("temporal dial: %v", err)
	}
	defer tc.Close()

	s := &server{tc: tc, ledger: ledgerclient.New(ledgerURL)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /v1/quotes", s.quote)
	mux.HandleFunc("POST /v1/transfers", s.transfer)
	mux.HandleFunc("GET /v1/transfers/{id}", s.getTransfer)
	mux.HandleFunc("GET /v1/balances/{ref}", s.balance)
	mux.HandleFunc("POST /v1/wallet/freeze", s.freeze)
	mux.HandleFunc("POST /v1/wallet/unfreeze", s.unfreeze)

	log.Printf("EPHERA payments API on %s (temporal %s, ledger %s)", httpAddr, addr, ledgerURL)
	if err := http.ListenAndServe(httpAddr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "payments"})
}

func (s *server) balance(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	if ref == "" {
		ref = "user:demo-self:GHS"
	}
	a, err := s.ledger.GetAccount(r.Context(), ref)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *server) freeze(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ExternalRef      string `json:"externalRef"`
		Reason           string `json:"reason"`
		AuthorisationRef string `json:"authorisationRef"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.AuthorisationRef == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "authorisation_required",
			"message": "Passkey required to freeze wallet",
		})
		return
	}
	if body.ExternalRef == "" {
		body.ExternalRef = "user:demo-self:GHS"
	}
	if body.Reason == "" {
		body.Reason = "user_requested"
	}
	a, err := s.ledger.Freeze(r.Context(), body.ExternalRef, body.Reason, body.AuthorisationRef)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  a.Status,
		"account": a,
		"message": "Wallet frozen. Outbound transfers blocked.",
	})
}

func (s *server) unfreeze(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ExternalRef      string `json:"externalRef"`
		AuthorisationRef string `json:"authorisationRef"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.AuthorisationRef == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "authorisation_required",
			"message": "Passkey required to unfreeze wallet",
		})
		return
	}
	if body.ExternalRef == "" {
		body.ExternalRef = "user:demo-self:GHS"
	}
	a, err := s.ledger.Unfreeze(r.Context(), body.ExternalRef, body.AuthorisationRef)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  a.Status,
		"account": a,
		"message": "Wallet unfrozen. Outbound transfers restored.",
	})
}

func (s *server) quote(w http.ResponseWriter, r *http.Request) {
	var req quoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "GHS"
	}
	if req.Rail == "" {
		req.Rail = "mobile-money-sim"
	}
	fee := int64(0)
	if req.AmountMinor >= 10000 {
		fee = 50
	}
	if req.Rail == "bank-transfer-sim" {
		fee = 100
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sendAmountMinor":    req.AmountMinor,
		"receiveAmountMinor": req.AmountMinor,
		"feeMinor":           fee,
		"currency":           req.Currency,
		"receiveCurrency":    req.Currency,
		"eta":                "Under 2 minutes",
		"routeSummary":       "EPHERA sandbox → " + req.Rail,
		"adapter":            req.Rail,
		"requiresPasskey":    true,
	})
}

func (s *server) transfer(w http.ResponseWriter, r *http.Request) {
	var req transferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.AuthorisationRef == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "authorisation_required",
			"message": "Voice alone is never sufficient. Provide passkey authorisation reference.",
		})
		return
	}
	if req.AmountMinor <= 0 || req.RecipientName == "" {
		http.Error(w, "amountMinor and recipientName required", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "GHS"
	}
	if req.Rail == "" {
		req.Rail = "mobile-money-sim"
	}
	if req.IdempotencyKey == "" {
		req.IdempotencyKey = "idem_" + uuid.NewString()
	}
	if req.FromExternalRef == "" {
		req.FromExternalRef = "user:demo-self:GHS"
	}
	if req.ToExternalRef == "" {
		req.ToExternalRef = mapRecipient(req.RecipientName)
	}
	transferID := "tx_" + uuid.NewString()

	input := workflow.DomesticTransferInput{
		TransferID:       transferID,
		IdempotencyKey:   req.IdempotencyKey,
		AmountMinor:      req.AmountMinor,
		Currency:         req.Currency,
		RecipientName:    req.RecipientName,
		RecipientHint:    req.RecipientHint,
		FromExternalRef:  req.FromExternalRef,
		ToExternalRef:    req.ToExternalRef,
		Rail:             req.Rail,
		AuthorisationRef: req.AuthorisationRef,
		FailMode:         req.FailMode,
	}

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	run, err := s.tc.ExecuteWorkflow(ctx, client.StartWorkflowOptions{
		ID:        "transfer-" + req.IdempotencyKey,
		TaskQueue: workflow.TaskQueue,
	}, workflow.DomesticTransferSim, input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var result workflow.DomesticTransferResult
	if err := run.Get(ctx, &result); err != nil {
		writeJSON(w, http.StatusPaymentRequired, map[string]any{
			"transferId": transferID,
			"workflowId": run.GetID(),
			"status":     "failed",
			"error":      err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"transferId":     result.TransferID,
		"workflowId":     run.GetID(),
		"status":         result.Status,
		"executionId":    result.ExecutionID,
		"providerRef":    result.ProviderRef,
		"feeMinor":       result.FeeMinor,
		"routeSummary":   result.RouteSummary,
		"receiptId":      result.ReceiptID,
		"journalEntryId": result.JournalEntryID,
		"message":        result.Message,
	})
}

func mapRecipient(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	switch {
	case strings.HasPrefix(n, "ama"):
		return "user:ama:GHS"
	default:
		return "user:ama:GHS"
	}
}

func (s *server) getTransfer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	writeJSON(w, http.StatusOK, map[string]string{
		"transferId": id,
		"note":       "Use Temporal UI for full history in sandbox",
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
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
