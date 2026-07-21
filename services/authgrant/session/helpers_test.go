package session

import (
	"crypto/ed25519"
	"encoding/base64"
	"strconv"
	"testing"
)

func itoa(v int64) string { return strconv.FormatInt(v, 10) }

// signRaw signs an arbitrary payload body, so tests can construct payloads Mint
// would refuse to build.
func signRaw(t *testing.T, priv ed25519.PrivateKey, body string) string {
	t.Helper()
	encoded := base64.RawURLEncoding.EncodeToString([]byte(body))
	sig := ed25519.Sign(priv, []byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(sig)
}
