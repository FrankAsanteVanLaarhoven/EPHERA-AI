package main

import (
	"context"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/ephera/platform-control-bff/internal/compliance"
	"github.com/ephera/platform-control-bff/internal/effect"
	"github.com/ephera/platform-control-bff/internal/store"
)

func main() {
	addr := env("CONTROL_HTTP_ADDR", ":8094")

	ctx := context.Background()
	st, err := store.New(ctx, env("CONTROL_DATABASE_URL",
		"postgres://ephera:ephera_dev_only@localhost:5433/ephera_operations?sslmode=disable"))
	if err != nil {
		log.Fatalf("control db: %v", err)
	}
	defer st.Close()

	// Without the identity service's public key this service cannot tell a real
	// operator session from a forged one, so it refuses every request rather
	// than falling back to trusting the caller.
	var pk []byte
	if hexKey := os.Getenv("CONTROL_SESSION_PUBLIC_KEY"); hexKey != "" {
		pk, err = hex.DecodeString(hexKey)
		if err != nil {
			log.Fatalf("session public key: %v", err)
		}
	} else {
		log.Printf("WARNING: CONTROL_SESSION_PUBLIC_KEY is not set. " +
			"Every request will be refused until an operator session key is configured.")
	}

	origins := strings.Split(env("CONTROL_ALLOWED_ORIGINS", "http://localhost:3007"), ",")
	s := &server{
		store:          st,
		sessionPK:      pk,
		allowedOrigins: origins,
		applier:        effect.NewHTTPApplier(env("LEDGER_URL", "http://localhost:8092")),
		compliance:     compliance.New(env("COMPLIANCE_URL", "http://localhost:8095")),
	}
	log.Printf("EPHERA platform-control-bff on %s", addr)
	if err := http.ListenAndServe(addr, s.routes()); err != nil {
		log.Fatal(err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
