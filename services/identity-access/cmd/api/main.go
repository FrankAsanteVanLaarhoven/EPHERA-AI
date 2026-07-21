// EPHERA identity-access.
//
// The only party permitted to mint authorisation grants. A grant is a signed,
// single-use assertion bound to one exact transaction, verified offline by the
// ledger (ADR 0002).
//
// # What this service does and does not do yet
//
// It holds the signing key and binds every grant to the transaction the user
// confirmed. That is what makes forgery and replay impossible at the ledger.
//
// It does NOT yet verify a passkey. The gate in front of minting is a sandbox
// authenticator that performs no challenge, and every grant it issues is
// labelled `sandbox_authenticator` in the grant, in the ledger's grant table
// and in authorisation evidence -- so a sandbox authorisation can never be
// mistaken for a real one downstream (ADR 0009). Real WebAuthn registration and
// assertion verification is G2-B, and until it lands D-01 is reduced, not
// closed.
//
// The sandbox authenticator refuses to start outside a sandbox environment.
package main

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ephera/authgrant"
	"github.com/google/uuid"
)

type server struct {
	priv        ed25519.PrivateKey
	pub         ed25519.PublicKey
	sandboxMint bool
}

func main() {
	httpAddr := env("IDENTITY_HTTP_ADDR", ":8093")
	environment := env("EPHERA_ENV", "local")

	priv, pub, err := loadOrCreateKey(os.Getenv("IDENTITY_SIGNING_SEED"))
	if err != nil {
		log.Fatalf("signing key: %v", err)
	}

	// The sandbox authenticator mints grants without any authenticator
	// challenge. It is a demonstration affordance and must never be reachable
	// where real money or real identity data could be involved.
	sandboxMint := environment == "local" || environment == "sandbox"
	if !sandboxMint {
		log.Printf("EPHERA_ENV=%q: sandbox authenticator disabled; "+
			"no grant can be minted until passkey verification is implemented (G2-B)", environment)
	}

	s := &server{priv: priv, pub: pub, sandboxMint: sandboxMint}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/keys", s.keys)
	mux.HandleFunc("POST /v1/grants", s.mintGrant)

	log.Printf("EPHERA identity-access on %s (env %s)", httpAddr, environment)
	log.Printf("authorisation public key: %s", hex.EncodeToString(pub))
	if err := http.ListenAndServe(httpAddr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

// loadOrCreateKey derives the signing key from a seed when one is supplied, so
// a local stack can be restarted without invalidating the ledger's configured
// public key. With no seed it generates an ephemeral key and says so.
func loadOrCreateKey(seedHex string) (ed25519.PrivateKey, ed25519.PublicKey, error) {
	if seedHex == "" {
		pub, priv, err := ed25519.GenerateKey(nil)
		if err != nil {
			return nil, nil, err
		}
		log.Printf("WARNING: IDENTITY_SIGNING_SEED not set; generated an ephemeral signing key. " +
			"Grants will stop verifying when this process restarts.")
		return priv, pub, nil
	}
	seed, err := hex.DecodeString(seedHex)
	if err != nil {
		return nil, nil, fmt.Errorf("IDENTITY_SIGNING_SEED is not hex: %w", err)
	}
	if len(seed) != ed25519.SeedSize {
		return nil, nil, fmt.Errorf("IDENTITY_SIGNING_SEED must be %d bytes of hex, got %d",
			ed25519.SeedSize, len(seed))
	}
	priv := ed25519.NewKeyFromSeed(seed)
	return priv, priv.Public().(ed25519.PublicKey), nil
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":               "ok",
		"service":              "identity-access",
		"sandboxAuthenticator": s.sandboxMint,
		"passkeyVerification":  false,
	})
}

// keys publishes the public key the ledger verifies grants against.
func (s *server) keys(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"algorithm": "ed25519",
		"publicKey": hex.EncodeToString(s.pub),
		"issuer":    authgrant.Issuer,
		"version":   authgrant.Version,
	})
}

type grantRequest struct {
	Subject         string `json:"subject"`
	FromExternalRef string `json:"fromExternalRef"`
	ToExternalRef   string `json:"toExternalRef"`
	AmountMinor     int64  `json:"amountMinor"`
	FeeMinor        int64  `json:"feeMinor"`
	Currency        string `json:"currency"`
	TransferID      string `json:"transferId"`
}

func (s *server) mintGrant(w http.ResponseWriter, r *http.Request) {
	if !s.sandboxMint {
		writeJSON(w, http.StatusNotImplemented, map[string]string{
			"error": "no_authenticator",
			"message": "Passkey verification is not implemented (G2-B) and the sandbox " +
				"authenticator is disabled outside sandbox environments.",
		})
		return
	}

	var req grantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Subject == "" {
		req.Subject = req.FromExternalRef
	}
	if req.Subject == "" || req.FromExternalRef == "" || req.ToExternalRef == "" ||
		req.TransferID == "" || req.Currency == "" {
		http.Error(w, "subject, fromExternalRef, toExternalRef, transferId and currency are required",
			http.StatusBadRequest)
		return
	}
	if req.AmountMinor <= 0 {
		http.Error(w, "amountMinor must be positive", http.StatusBadRequest)
		return
	}

	// NOTE: this is the point at which a passkey assertion must be verified.
	// Until G2-B there is no challenge here, which is why the method below says
	// exactly that and travels with the grant all the way into evidence.

	now := time.Now()
	binding := authgrant.Binding{
		FromExternalRef: req.FromExternalRef,
		ToExternalRef:   req.ToExternalRef,
		AmountMinor:     req.AmountMinor,
		FeeMinor:        req.FeeMinor,
		Currency:        req.Currency,
		TransferID:      req.TransferID,
	}

	grant, err := authgrant.Mint(s.priv, authgrant.Payload{
		ID:        "grant_" + uuid.NewString(),
		Subject:   req.Subject,
		Method:    authgrant.MethodSandboxAuthenticator,
		Binding:   binding.Digest(),
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(2 * time.Minute).Unix(),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"grant":     grant,
		"method":    string(authgrant.MethodSandboxAuthenticator),
		"expiresIn": 120,
		"warning": "Minted without an authenticator challenge. Sandbox only; " +
			"not evidence that a human authorised this transaction.",
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
