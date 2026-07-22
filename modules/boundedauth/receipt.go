package boundedauth

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

// Receipt is the evidence half: proof of what actually happened, bound to the
// authority that permitted it.
//
// # Why it belongs in this package
//
// Authority and evidence are usually built by different teams at different
// times, and they disagree. The authorisation says one amount, the ledger posts
// another, the receipt shown to the customer is composed later from whichever
// values the presenting service happened to hold. Each is individually
// plausible and there is no way to tell which is true.
//
// A receipt here carries the binding digest of the credential that authorised
// it. If the two do not agree, the receipt describes something other than what
// was authorised, and [Receipt.MatchesAuthority] says so without reference to
// any external record. That is the property: authority in and evidence out are
// the same chain, checkable by anyone holding either end.
//
// The stronger half of the guarantee is not code and cannot be: the receipt
// must be written in the same transaction as the effect. A receipt written
// afterwards, by a different process, from values passed to it, is an account
// of a payment rather than proof of one. [Store] exists so that this is
// possible; the conformance suite checks that a host actually did it.
type Receipt struct {
	ID        string    `json:"id"`
	Reference string    `json:"reference"`
	IssuedAt  time.Time `json:"issuedAt"`

	// EffectID identifies what the host actually did — a journal entry, a
	// settlement record. It is opaque here and exists so a receipt can be
	// resolved back to the host's own books.
	EffectID string `json:"effectId"`

	Payer       string `json:"payer"`
	Payee       string `json:"payee"`
	AmountMinor int64  `json:"amountMinor"`
	FeeMinor    int64  `json:"feeMinor"`
	Currency    string `json:"currency"`
	Description string `json:"description"`

	// Authority is the credential this effect was permitted by.
	GrantID string `json:"grantId"`
	Method  Method `json:"method"`
	Binding string `json:"binding"`

	// ContentHash is computed at issue and stored alongside. A receipt
	// presented later can be checked against it.
	ContentHash string `json:"contentHash"`
}

// Issue computes the content hash and returns the receipt ready to store.
//
// IssuedAt is truncated to microseconds because most databases store timestamps
// at microsecond resolution, and a hash computed over a nanosecond value will
// not reproduce after a round trip. This is not hypothetical: it is a bug the
// implementation this was extracted from shipped and had to fix.
func (r Receipt) Issue() Receipt {
	r.IssuedAt = r.IssuedAt.UTC().Truncate(time.Microsecond)
	r.ContentHash = r.hash()
	return r
}

func (r Receipt) hash() string {
	h := sha256.New()
	writeField(h, []byte(Version))
	for _, f := range []string{
		r.ID, r.Reference, r.EffectID, r.Payer, r.Payee, r.Currency,
		r.Description, r.GrantID, string(r.Method), r.Binding,
		r.IssuedAt.UTC().Format(time.RFC3339Nano),
	} {
		writeField(h, []byte(f))
	}
	writeInt(h, r.AmountMinor)
	writeInt(h, r.FeeMinor)
	return hex.EncodeToString(h.Sum(nil))
}

// Intact reports whether the receipt still matches the hash it carries. A
// receipt that does not has been altered since it was issued.
func (r Receipt) Intact() bool {
	return r.ContentHash != "" && r.ContentHash == r.hash()
}

// MatchesAuthority reports whether this receipt describes the transaction the
// credential authorised.
//
// A receipt can be intact — unaltered since issue — and still describe a
// different payment from the one that was authorised, if the issuing code was
// wrong. Intactness proves nobody edited it. This proves it was right when
// written.
func (r Receipt) MatchesAuthority(b Binding) bool {
	return r.Binding != "" && r.Binding == b.Digest()
}
