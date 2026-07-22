// Package store persists customer verification state, screening data and
// decisions.
package store

import (
	"context"
	"encoding/json"
	"fmt"
	"errors"
	"time"

	"github.com/ephera/compliance-risk/internal/monitoring"
	"github.com/ephera/compliance-risk/internal/risk"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound         = errors.New("not found")
	ErrSelfVerification = errors.New("a customer cannot decide their own tier")
	ErrUnknownTier      = errors.New("unknown tier")
)

type Store struct{ pool *pgxpool.Pool }

func New(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close()                 { s.pool.Close() }
func (s *Store) Pool() *pgxpool.Pool    { return s.pool }

type Customer struct {
	Subject     string    `json:"subject"`
	SubjectType string    `json:"subjectType"`
	Tier        string    `json:"tier"`
	Status      string    `json:"status"`
	Limits      risk.Tier `json:"limits"`
}

// EnsureCustomer returns the customer, creating them unverified on first sight.
// Unverified is the correct default: it is what the platform actually knows.
func (s *Store) EnsureCustomer(ctx context.Context, subject string) (Customer, error) {
	var c Customer
	err := s.pool.QueryRow(ctx, `
		INSERT INTO customers (subject) VALUES ($1)
		ON CONFLICT (subject) DO UPDATE SET subject = EXCLUDED.subject
		RETURNING subject, tier, status, subject_type
	`, subject).Scan(&c.Subject, &c.Tier, &c.Status, &c.SubjectType)
	if err != nil {
		return Customer{}, err
	}
	c.Limits, err = s.TierFor(ctx, c.SubjectType, c.Tier)
	return c, err
}

func (s *Store) Tier(ctx context.Context, name string) (risk.Tier, error) {
	var t risk.Tier
	err := s.pool.QueryRow(ctx, `
		SELECT tier, rank, daily_limit_minor, single_limit_minor, new_recipient_limit_minor
		FROM kyc_tiers WHERE tier = $1
	`, name).Scan(&t.Name, &t.Rank, &t.DailyLimitMinor, &t.SingleLimitMinor, &t.NewRecipientLimitMinor)
	if errors.Is(err, pgx.ErrNoRows) {
		return risk.Tier{}, ErrUnknownTier
	}
	return t, err
}

// SetTier records a verification decision.
//
// The subject can never be the decider — enforced here and, independently, by a
// database constraint. A customer used to be able to promote themselves simply
// by writing to their own device (D-33).
func (s *Store) SetTier(ctx context.Context, subject, toTier, decidedBy, evidenceRef, reason string) (Customer, error) {
	if subject == decidedBy {
		return Customer{}, ErrSelfVerification
	}
	if evidenceRef == "" || reason == "" {
		return Customer{}, errors.New("a tier decision requires an evidence reference and a reason")
	}
	if _, err := s.Tier(ctx, toTier); err != nil {
		return Customer{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Customer{}, err
	}
	defer tx.Rollback(ctx)

	var from string
	err = tx.QueryRow(ctx, `SELECT tier FROM customers WHERE subject = $1 FOR UPDATE`, subject).Scan(&from)
	if errors.Is(err, pgx.ErrNoRows) {
		return Customer{}, ErrNotFound
	}
	if err != nil {
		return Customer{}, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE customers SET tier = $2, updated_at = now() WHERE subject = $1`, subject, toTier); err != nil {
		return Customer{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO tier_decisions (subject, from_tier, to_tier, decided_by, evidence_ref, reason)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, subject, from, toTier, decidedBy, evidenceRef, reason); err != nil {
		return Customer{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Customer{}, err
	}
	return s.EnsureCustomer(ctx, subject)
}

// Screen matches a name against the screening list.
func (s *Store) Screen(ctx context.Context, name string) ([]risk.ScreeningHit, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT normalised_name, category, source FROM screening_list WHERE normalised_name = $1
	`, risk.NormaliseName(name))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := []risk.ScreeningHit{}
	for rows.Next() {
		var h risk.ScreeningHit
		if err := rows.Scan(&h.Name, &h.Category, &h.Source); err != nil {
			return nil, err
		}
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

// SpentToday totals what a subject has already had allowed today. Only allowed
// decisions count: a refused attempt does not consume someone's limit.
func (s *Store) SpentToday(ctx context.Context, subject string) (int64, error) {
	var total *int64
	err := s.pool.QueryRow(ctx, `
		SELECT sum(amount_minor) FROM risk_decisions
		WHERE subject = $1 AND outcome = 'allow' AND decided_at >= date_trunc('day', now())
	`, subject).Scan(&total)
	if err != nil {
		return 0, err
	}
	if total == nil {
		return 0, nil
	}
	return *total, nil
}

// KnownRecipient reports whether this subject has been allowed to pay this
// recipient before.
func (s *Store) KnownRecipient(ctx context.Context, subject, recipient string) (bool, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
		SELECT count(*) FROM risk_decisions
		WHERE subject = $1 AND recipient = $2 AND outcome = 'allow'
	`, subject, risk.NormaliseName(recipient)).Scan(&n)
	return n > 0, err
}

func (s *Store) RecordDecision(ctx context.Context, in risk.Input, d risk.Decision) error {
	reasons, err := json.Marshal(d.Reasons)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO risk_decisions (subject, amount_minor, currency, recipient, outcome, reasons, tier)
		VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
	`, in.Subject, in.AmountMinor, in.Currency, risk.NormaliseName(in.RecipientName),
		string(d.Outcome), reasons, in.Tier.Name)
	return err
}

type Case struct {
	ID       string    `json:"id"`
	Subject  string    `json:"subject"`
	Reason   string    `json:"reason"`
	Status   string    `json:"status"`
	OpenedAt time.Time `json:"openedAt"`
}

// OpenCase raises a case for manual review.
func (s *Store) OpenCase(ctx context.Context, subject, reason string) (Case, error) {
	var c Case
	err := s.pool.QueryRow(ctx, `
		INSERT INTO review_cases (subject, reason) VALUES ($1,$2)
		RETURNING id, subject, reason, status, opened_at
	`, subject, reason).Scan(&c.ID, &c.Subject, &c.Reason, &c.Status, &c.OpenedAt)
	return c, err
}

// CloseCase records an analyst's decision. An analyst cannot clear a case about
// themselves; the database refuses it independently.
func (s *Store) CloseCase(ctx context.Context, id, status, closedBy, note string) error {
	if status != "cleared" && status != "blocked" {
		return errors.New("a case closes as cleared or blocked")
	}
	ct, err := s.pool.Exec(ctx, `
		UPDATE review_cases
		SET status = $2, closed_by = $3, closed_at = now(), decision_note = $4
		WHERE id = $1 AND status = 'open'
	`, id, status, closedBy, note)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListOpenCases(ctx context.Context, limit int) ([]Case, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, subject, reason, status, opened_at FROM review_cases
		WHERE status = 'open' ORDER BY opened_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Case{}
	for rows.Next() {
		var c Case
		if err := rows.Scan(&c.ID, &c.Subject, &c.Reason, &c.Status, &c.OpenedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// --- KYB, KYA and evidence ---

var (
	ErrEvidenceMissing    = errors.New("the evidence this tier requires has not been verified")
	ErrSelfReview         = errors.New("a document cannot be verified by its subject")
	ErrDocumentNotFound   = errors.New("document not found")
)

type Document struct {
	ID          string     `json:"id"`
	Subject     string     `json:"subject"`
	Kind        string     `json:"kind"`
	ContentHash string     `json:"contentHash"`
	Status      string     `json:"status"`
	ReviewedBy  *string    `json:"reviewedBy,omitempty"`
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`
}

// EnsureSubject creates a subject of a given kind on first sight.
func (s *Store) EnsureSubject(ctx context.Context, subject, subjectType, legalName string) (Customer, error) {
	if subjectType == "" {
		subjectType = "person"
	}
	var c Customer
	err := s.pool.QueryRow(ctx, `
		INSERT INTO customers (subject, subject_type, legal_name) VALUES ($1,$2,$3)
		ON CONFLICT (subject) DO UPDATE SET legal_name = COALESCE(EXCLUDED.legal_name, customers.legal_name)
		RETURNING subject, tier, status, subject_type
	`, subject, subjectType, nullIfEmpty(legalName)).Scan(&c.Subject, &c.Tier, &c.Status, &c.SubjectType)
	if err != nil {
		return Customer{}, err
	}
	c.Limits, err = s.TierFor(ctx, c.SubjectType, c.Tier)
	return c, err
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// TierFor reads the limits for a tier of a given subject type. A verified
// business is not a verified person, so the type is part of the key.
func (s *Store) TierFor(ctx context.Context, subjectType, name string) (risk.Tier, error) {
	var t risk.Tier
	err := s.pool.QueryRow(ctx, `
		SELECT tier, rank, daily_limit_minor, single_limit_minor, new_recipient_limit_minor
		FROM kyc_tiers WHERE subject_type = $1 AND tier = $2
	`, subjectType, name).Scan(&t.Name, &t.Rank, &t.DailyLimitMinor, &t.SingleLimitMinor, &t.NewRecipientLimitMinor)
	if errors.Is(err, pgx.ErrNoRows) {
		return risk.Tier{}, ErrUnknownTier
	}
	return t, err
}

// SubmitDocument records evidence. The content hash is mandatory: a record
// with no hash cannot later be shown to correspond to any document.
func (s *Store) SubmitDocument(ctx context.Context, subject, kind, contentHash string) (Document, error) {
	if contentHash == "" {
		return Document{}, errors.New("a document requires a content hash")
	}
	var d Document
	err := s.pool.QueryRow(ctx, `
		INSERT INTO verification_documents (subject, kind, content_hash)
		VALUES ($1,$2,$3)
		RETURNING id, subject, kind, content_hash, status
	`, subject, kind, contentHash).Scan(&d.ID, &d.Subject, &d.Kind, &d.ContentHash, &d.Status)
	return d, err
}

// ReviewDocument records a reviewer's decision on evidence.
func (s *Store) ReviewDocument(ctx context.Context, id, status, reviewedBy, note string) (Document, error) {
	if status != "verified" && status != "rejected" {
		return Document{}, errors.New("a document is verified or rejected")
	}
	var subject string
	if err := s.pool.QueryRow(ctx,
		`SELECT subject FROM verification_documents WHERE id = $1`, id).Scan(&subject); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Document{}, ErrDocumentNotFound
		}
		return Document{}, err
	}
	if subject == reviewedBy {
		return Document{}, ErrSelfReview
	}

	var d Document
	err := s.pool.QueryRow(ctx, `
		UPDATE verification_documents
		SET status = $2, reviewed_by = $3, reviewed_at = now(), reviewer_note = $4
		WHERE id = $1 AND status = 'submitted'
		RETURNING id, subject, kind, content_hash, status, reviewed_by
	`, id, status, reviewedBy, note).Scan(&d.ID, &d.Subject, &d.Kind, &d.ContentHash, &d.Status, &d.ReviewedBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return Document{}, ErrDocumentNotFound
	}
	return d, err
}

// MissingEvidence returns the document kinds a tier requires that the subject
// does not hold as verified, unexpired evidence.
func (s *Store) MissingEvidence(ctx context.Context, subject, subjectType, tier string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.document_kind
		FROM tier_requirements r
		WHERE r.subject_type = $2 AND r.tier = $3
		  AND NOT EXISTS (
		      SELECT 1 FROM verification_documents d
		      WHERE d.subject = $1
		        AND d.kind = r.document_kind
		        AND d.status = 'verified'
		        AND (d.expires_at IS NULL OR d.expires_at > now())
		  )
		ORDER BY r.document_kind
	`, subject, subjectType, tier)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	missing := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		missing = append(missing, k)
	}
	return missing, rows.Err()
}

// SetTierWithEvidence raises a tier only when the evidence it requires has been
// verified. This is what makes a tier a statement about evidence rather than an
// assertion: the previous version accepted any string as an evidence reference.
func (s *Store) SetTierWithEvidence(ctx context.Context, subject, toTier, decidedBy, reason string) (Customer, error) {
	if subject == decidedBy {
		return Customer{}, ErrSelfVerification
	}
	if reason == "" {
		return Customer{}, errors.New("a tier decision requires a reason")
	}
	c, err := s.EnsureSubject(ctx, subject, "", "")
	if err != nil {
		return Customer{}, err
	}
	if _, err := s.TierFor(ctx, c.SubjectType, toTier); err != nil {
		return Customer{}, err
	}
	missing, err := s.MissingEvidence(ctx, subject, c.SubjectType, toTier)
	if err != nil {
		return Customer{}, err
	}
	if len(missing) > 0 {
		return Customer{}, fmt.Errorf("%w: %v", ErrEvidenceMissing, missing)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Customer{}, err
	}
	defer tx.Rollback(ctx)

	var from string
	if err := tx.QueryRow(ctx,
		`SELECT tier FROM customers WHERE subject = $1 FOR UPDATE`, subject).Scan(&from); err != nil {
		return Customer{}, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE customers SET tier = $2, updated_at = now() WHERE subject = $1`, subject, toTier); err != nil {
		return Customer{}, err
	}
	// Cite one of the verified documents, so the decision points at evidence
	// that exists rather than at a string somebody typed.
	var docID *string
	_ = tx.QueryRow(ctx, `
		SELECT d.id::text FROM verification_documents d
		JOIN tier_requirements r ON r.document_kind = d.kind
		WHERE d.subject = $1 AND d.status = 'verified'
		  AND r.subject_type = $2 AND r.tier = $3
		LIMIT 1
	`, subject, c.SubjectType, toTier).Scan(&docID)

	if _, err := tx.Exec(ctx, `
		INSERT INTO tier_decisions
			(subject, from_tier, to_tier, decided_by, evidence_ref, reason, evidence_document_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, subject, from, toTier, decidedBy, coalesce(docID, "verified-evidence"), reason, docID); err != nil {
		return Customer{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Customer{}, err
	}
	return s.EnsureSubject(ctx, subject, "", "")
}

func coalesce(p *string, fallback string) string {
	if p != nil {
		return *p
	}
	return fallback
}

// RecentPayments returns allowed payments for a subject within a window, for
// behavioural monitoring. Only allowed decisions are returned: a refused
// attempt says something about intent but nothing about the movement of money,
// and mixing them would make every alert unexplainable.
func (s *Store) RecentPayments(ctx context.Context, subject string, window time.Duration) ([]monitoring.Payment, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT amount_minor, recipient, decided_at
		FROM risk_decisions
		WHERE subject = $1 AND outcome = 'allow' AND decided_at >= now() - $2::interval
		ORDER BY decided_at DESC
		LIMIT 500
	`, subject, window.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []monitoring.Payment{}
	for rows.Next() {
		var p monitoring.Payment
		if err := rows.Scan(&p.AmountMinor, &p.Recipient, &p.At); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
