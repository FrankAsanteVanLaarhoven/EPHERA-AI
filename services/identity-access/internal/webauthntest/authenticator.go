// Package webauthntest provides a software WebAuthn authenticator.
//
// It exists so the ceremonies can be exercised end to end without a browser:
// it holds a P-256 key and produces genuine attestation and assertion
// responses, signing exactly what a hardware authenticator signs --
// authenticatorData || SHA-256(clientDataJSON).
//
// Test support only. Nothing in the service imports it.
package webauthntest

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
)

// A software authenticator, used to exercise the real WebAuthn verification
// path in tests. It holds a P-256 key, produces genuine attestation and
// assertion responses, and signs exactly what a hardware authenticator signs:
// authenticatorData || SHA-256(clientDataJSON).
//
// Nothing here is used outside tests. It exists so the ceremonies can be
// verified end to end without a browser.

type Authenticator struct {
	key       *ecdsa.PrivateKey
	credID    []byte
	rpID      string
	origin    string
	signCount uint32
}

func New(rpID, origin string) (*Authenticator, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	credID := make([]byte, 32)
	if _, err := rand.Read(credID); err != nil {
		return nil, err
	}
	return &Authenticator{key: key, credID: credID, rpID: rpID, origin: origin}, nil
}

// coseKey encodes the public key as a COSE_Key EC2 map, which is what the
// authenticator hands the relying party and what verification later uses.
//
//	{1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}
func (a *Authenticator) coseKey() []byte {
	x := make([]byte, 32)
	y := make([]byte, 32)
	a.key.PublicKey.X.FillBytes(x)
	a.key.PublicKey.Y.FillBytes(y)

	out := []byte{0xa5} // map, 5 pairs
	out = append(out, 0x01, 0x02)
	out = append(out, 0x03, 0x26) // -7
	out = append(out, 0x20, 0x01) // -1 : 1
	out = append(out, 0x21, 0x58, 0x20)
	out = append(out, x...)
	out = append(out, 0x22, 0x58, 0x20)
	out = append(out, y...)
	return out
}

const (
	flagUserPresent  = 0x01
	flagUserVerified = 0x04
	flagAttested     = 0x40
)

func (a *Authenticator) authData(includeAttested bool) []byte {
	h := sha256.Sum256([]byte(a.rpID))
	flags := byte(flagUserPresent | flagUserVerified)
	if includeAttested {
		flags |= flagAttested
	}
	data := append([]byte{}, h[:]...)
	data = append(data, flags)

	var counter [4]byte
	binary.BigEndian.PutUint32(counter[:], a.signCount)
	data = append(data, counter[:]...)

	if includeAttested {
		data = append(data, make([]byte, 16)...) // aaguid, all zero
		var l [2]byte
		binary.BigEndian.PutUint16(l[:], uint16(len(a.credID)))
		data = append(data, l[:]...)
		data = append(data, a.credID...)
		data = append(data, a.coseKey()...)
	}
	return data
}

func (a *Authenticator) clientData(ceremonyType, challengeB64 string) []byte {
	cd := map[string]any{
		"type":        ceremonyType,
		"challenge":   challengeB64,
		"origin":      a.origin,
		"crossOrigin": false,
	}
	b, _ := json.Marshal(cd)
	return b
}

// cborBytes emits a CBOR byte string header plus payload.
func cborBytes(b []byte) []byte {
	switch {
	case len(b) < 24:
		return append([]byte{byte(0x40 + len(b))}, b...)
	case len(b) < 256:
		return append([]byte{0x58, byte(len(b))}, b...)
	default:
		var l [2]byte
		binary.BigEndian.PutUint16(l[:], uint16(len(b)))
		return append(append([]byte{0x59}, l[:]...), b...)
	}
}

func cborText(s string) []byte {
	return append([]byte{byte(0x60 + len(s))}, []byte(s)...)
}

// registrationResponse builds a credential creation response with "none"
// attestation, exactly as a platform authenticator would.
func (a *Authenticator) RegistrationResponse(challengeB64 string) []byte {
	clientData := a.clientData("webauthn.create", challengeB64)

	att := []byte{0xa3} // map, 3 pairs
	att = append(att, cborText("fmt")...)
	att = append(att, cborText("none")...)
	att = append(att, cborText("attStmt")...)
	att = append(att, 0xa0) // empty map
	att = append(att, cborText("authData")...)
	att = append(att, cborBytes(a.authData(true))...)

	body := map[string]any{
		"id":    base64.RawURLEncoding.EncodeToString(a.credID),
		"rawId": base64.RawURLEncoding.EncodeToString(a.credID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    base64.RawURLEncoding.EncodeToString(clientData),
			"attestationObject": base64.RawURLEncoding.EncodeToString(att),
		},
	}
	b, _ := json.Marshal(body)
	return b
}

// assertionResponse signs authenticatorData || SHA-256(clientDataJSON), which
// is the WebAuthn signature base.
func (a *Authenticator) AssertionResponse(challengeB64 string, userHandle []byte) ([]byte, error) {
	a.signCount++
	clientData := a.clientData("webauthn.get", challengeB64)
	authData := a.authData(false)

	digest := sha256.Sum256(append(append([]byte{}, authData...), hash(clientData)...))
	sig, err := ecdsa.SignASN1(rand.Reader, a.key, digest[:])
	if err != nil {
		return nil, err
	}

	body := map[string]any{
		"id":    base64.RawURLEncoding.EncodeToString(a.credID),
		"rawId": base64.RawURLEncoding.EncodeToString(a.credID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    base64.RawURLEncoding.EncodeToString(clientData),
			"authenticatorData": base64.RawURLEncoding.EncodeToString(authData),
			"signature":         base64.RawURLEncoding.EncodeToString(sig),
			"userHandle":        base64.RawURLEncoding.EncodeToString(userHandle),
		},
	}
	b, _ := json.Marshal(body)
	return b, nil
}

// ForgedAssertionResponse produces a well-formed assertion whose signature was
// made by a different key while claiming the victim's credential id.
func (a *Authenticator) ForgedAssertionResponse(challengeB64 string, userHandle []byte) ([]byte, error) {
	rogue, err := New(a.rpID, a.origin)
	if err != nil {
		return nil, err
	}
	rogue.credID = a.credID
	return rogue.AssertionResponse(challengeB64, userHandle)
}

// Key exposes the signing key so a test can build a second authenticator that
// shares it (for example, to simulate a different origin).
func (a *Authenticator) Key() *ecdsa.PrivateKey { return a.key }

// SetKeyAndCredential makes this authenticator impersonate another one.
func (a *Authenticator) SetKeyAndCredential(k *ecdsa.PrivateKey, credID []byte) {
	a.key = k
	a.credID = credID
}

func hash(b []byte) []byte {
	h := sha256.Sum256(b)
	return h[:]
}


// CredentialID returns the credential id this authenticator presents.
func (a *Authenticator) CredentialID() []byte { return a.credID }
