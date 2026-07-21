// EPHERA identity-access.
//
// The only party permitted to mint authorisation grants. A grant is a signed,
// single-use assertion bound to one exact transaction, verified offline by the
// ledger (ADR 0002).
//
// # Two ways to obtain a grant
//
// The real path is a WebAuthn passkey. The challenge the authenticator signs is
// the transaction's binding digest, so the device signature covers the exact
// transfer the user approved -- not an opaque random value that could be
// presented for anything else. A grant minted this way carries method
// `passkey`.
//
// The other path is a sandbox authenticator that performs no challenge at all.
// It is off unless IDENTITY_ALLOW_SANDBOX_AUTHENTICATOR=true, refuses to run
// outside a sandbox environment, and is refused outright for any subject that
// has registered a passkey. Every grant it issues is labelled
// `sandbox_authenticator` in the grant, in the ledger's grant table and in
// authorisation evidence, so it can never be mistaken downstream for evidence
// that a human approved anything (ADR 0009).
package main

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ephera/authgrant"
	"github.com/ephera/identity-access/internal/passkey"
	"github.com/ephera/identity-access/internal/store"
	"github.com/google/uuid"
)

type server struct {
	priv        ed25519.PrivateKey
	pub         ed25519.PublicKey
	sandboxMint bool
	store       *store.Store
	passkeys    *passkey.Service
}

func main() {
	httpAddr := env("IDENTITY_HTTP_ADDR", ":8093")
	environment := env("EPHERA_ENV", "local")

	priv, pub, err := loadOrCreateKey(os.Getenv("IDENTITY_SIGNING_SEED"))
	if err != nil {
		log.Fatalf("signing key: %v", err)
	}

	// The sandbox authenticator mints grants without any authenticator
	// challenge. It is opt-in and off by default: passkey verification is the
	// real path, and a deployment must say explicitly that it wants the weaker
	// one. It additionally refuses to run outside a sandbox environment.
	sandboxMint := os.Getenv("IDENTITY_ALLOW_SANDBOX_AUTHENTICATOR") == "true" &&
		(environment == "local" || environment == "sandbox")
	if sandboxMint {
		log.Printf("WARNING: sandbox authenticator enabled. Grants can be minted with no " +
			"authenticator challenge. Every such grant is labelled sandbox_authenticator.")
	} else {
		log.Printf("sandbox authenticator disabled; a registered passkey is required to mint a grant")
	}

	ctx := context.Background()
	st, err := store.New(ctx, env("IDENTITY_DATABASE_URL",
		"postgres://ephera:ephera_dev_only@localhost:5433/ephera_identity?sslmode=disable"))
	if err != nil {
		log.Fatalf("identity db: %v", err)
	}
	defer st.Close()

	rpID := env("IDENTITY_RP_ID", "localhost")
	origins := strings.Split(env("IDENTITY_RP_ORIGINS", "http://localhost:3006,http://localhost:8081"), ",")
	pk, err := passkey.New(rpID, "EPHERA", origins)
	if err != nil {
		log.Fatalf("passkey service: %v", err)
	}

	s := &server{priv: priv, pub: pub, sandboxMint: sandboxMint, store: st, passkeys: pk}

	log.Printf("EPHERA identity-access on %s (env %s)", httpAddr, environment)
	log.Printf("authorisation public key: %s", hex.EncodeToString(pub))
	if err := http.ListenAndServe(httpAddr, s.routes()); err != nil {
		log.Fatal(err)
	}
}

// routes is separate from main so tests can drive the real HTTP surface rather
// than calling handlers directly.
func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/keys", s.keys)
	mux.HandleFunc("POST /v1/passkeys/register/begin", s.passkeyRegisterBegin)
	mux.HandleFunc("POST /v1/passkeys/register/finish", s.passkeyRegisterFinish)
	mux.HandleFunc("POST /v1/grants/challenge", s.grantChallenge)
	mux.HandleFunc("POST /v1/grants/passkey", s.mintWithPasskey)
	mux.HandleFunc("POST /v1/grants", s.mintGrant)
	return withCORS(mux)
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
		"passkeyVerification":  true,
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

func validateGrantRequest(req *grantRequest) error {
	if req.Subject == "" {
		req.Subject = req.FromExternalRef
	}
	if req.Subject == "" || req.FromExternalRef == "" || req.ToExternalRef == "" ||
		req.TransferID == "" || req.Currency == "" {
		return fmt.Errorf("subject, fromExternalRef, toExternalRef, transferId and currency are required")
	}
	if req.AmountMinor <= 0 {
		return fmt.Errorf("amountMinor must be positive")
	}
	return nil
}

// mintGrant is the sandbox path: no authenticator challenge, opt-in, and
// refused for any subject that has registered a passkey. A weaker method must
// never be reachable for a user who has a stronger one.
func (s *server) mintGrant(w http.ResponseWriter, r *http.Request) {
	if !s.sandboxMint {
		writeJSON(w, http.StatusNotImplemented, map[string]string{
			"error": "no_authenticator",
			"message": "The sandbox authenticator is disabled. Register a passkey and use " +
				"/v1/grants/challenge then /v1/grants/passkey.",
		})
		return
	}

	var req grantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateGrantRequest(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	hasPasskey, err := s.store.HasCredential(r.Context(), req.Subject)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if hasPasskey {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "passkey_required",
			"message": "This subject has a registered passkey; the sandbox authenticator cannot be used.",
		})
		return
	}

	now := time.Now()
	binding := bindingOf(req)

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
