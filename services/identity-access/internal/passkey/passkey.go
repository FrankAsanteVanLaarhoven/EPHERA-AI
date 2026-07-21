// Package passkey wraps the WebAuthn ceremonies identity-access performs.
//
// The important design choice is in BeginAuthorisation: the WebAuthn challenge
// IS the transaction binding digest. The authenticator therefore signs over the
// exact transfer the user is approving, and that signature is what permits a
// grant to be minted. A captured assertion cannot be presented for a different
// transaction, because the digest inside it would not match.
package passkey

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/ephera/authgrant"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

var (
	ErrNoCredential   = errors.New("no passkey registered for this subject")
	ErrBindingMismatch = errors.New("assertion is not bound to this transaction")
)

// ChallengeTTL bounds how long a user has to approve on their device. It is
// short because it covers a single confirmation, and it is the outer bound on
// how long a captured challenge is worth anything.
const ChallengeTTL = 2 * time.Minute

type Service struct {
	wa *webauthn.WebAuthn
}

// New configures the relying party. RPID must be the registrable domain the
// credential is scoped to; origins must be exact.
func New(rpID, displayName string, origins []string) (*Service, error) {
	wa, err := webauthn.New(&webauthn.Config{
		RPID:          rpID,
		RPDisplayName: displayName,
		RPOrigins:     origins,
	})
	if err != nil {
		return nil, err
	}
	return &Service{wa: wa}, nil
}

func (s *Service) BeginRegistration(user webauthn.User) (*protocol.CredentialCreation, *webauthn.SessionData, error) {
	return s.wa.BeginRegistration(user,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementPreferred),
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{
			ResidentKey:      protocol.ResidentKeyRequirementPreferred,
			UserVerification: protocol.VerificationRequired,
		}),
	)
}

func (s *Service) FinishRegistration(user webauthn.User, sess webauthn.SessionData, body io.Reader) (*webauthn.Credential, error) {
	parsed, err := protocol.ParseCredentialCreationResponseBody(body)
	if err != nil {
		return nil, fmt.Errorf("parse registration: %w", err)
	}
	return s.wa.CreateCredential(user, sess, parsed)
}

// BeginAuthorisation issues an assertion challenge that is the binding digest
// of the transfer being authorised.
func (s *Service) BeginAuthorisation(user webauthn.User, binding authgrant.Binding) (*protocol.CredentialAssertion, *webauthn.SessionData, error) {
	if len(user.WebAuthnCredentials()) == 0 {
		return nil, nil, ErrNoCredential
	}
	digest, err := hex.DecodeString(binding.Digest())
	if err != nil {
		return nil, nil, fmt.Errorf("binding digest: %w", err)
	}
	return s.wa.BeginLogin(user,
		webauthn.WithChallenge(digest),
		webauthn.WithUserVerification(protocol.VerificationRequired),
	)
}

// FinishAuthorisation verifies the assertion and confirms it is bound to the
// transfer the caller is trying to authorise. Both checks matter: the signature
// proves the user's device produced it, the binding check proves it was
// produced for this transaction.
func (s *Service) FinishAuthorisation(
	user webauthn.User,
	sess webauthn.SessionData,
	binding authgrant.Binding,
	body io.Reader,
) (*webauthn.Credential, error) {
	digest, err := hex.DecodeString(binding.Digest())
	if err != nil {
		return nil, fmt.Errorf("binding digest: %w", err)
	}
	// The stored session challenge is what the authenticator signed. If it does
	// not equal the digest of the transfer now being submitted, the assertion
	// belongs to a different transaction.
	if sess.Challenge != base64.RawURLEncoding.EncodeToString(digest) {
		return nil, ErrBindingMismatch
	}

	parsed, err := protocol.ParseCredentialRequestResponseBody(body)
	if err != nil {
		return nil, fmt.Errorf("parse assertion: %w", err)
	}
	return s.wa.ValidateLogin(user, sess, parsed)
}

// BeginOperatorLogin starts a login ceremony. Unlike an authorisation ceremony
// there is no transaction to bind to: this proves who someone is, and proves
// nothing about what they may do. Authorisation is the control plane's job, and
// it re-reads roles from its own database rather than trusting this session.
func (s *Service) BeginOperatorLogin(user webauthn.User) (*protocol.CredentialAssertion, *webauthn.SessionData, error) {
	if len(user.WebAuthnCredentials()) == 0 {
		return nil, nil, ErrNoCredential
	}
	return s.wa.BeginLogin(user, webauthn.WithUserVerification(protocol.VerificationRequired))
}

// FinishOperatorLogin verifies a login assertion.
func (s *Service) FinishOperatorLogin(user webauthn.User, sess webauthn.SessionData, body io.Reader) (*webauthn.Credential, error) {
	parsed, err := protocol.ParseCredentialRequestResponseBody(body)
	if err != nil {
		return nil, fmt.Errorf("parse assertion: %w", err)
	}
	return s.wa.ValidateLogin(user, sess, parsed)
}
