// Package store persists customer verification state, screening data and
// decisions.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

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
	Subject string    `json:"subject"`
	Tier    string    `json:"tier"`
	Status  string    `json:"status"`
	Limits  risk.Tier `json:"limits"`
}

// EnsureCustomer returns the customer, creating them unverified on first sight.
// Unverified is the correct default: it is what the platform actually knows.
func (s *Store) EnsureCustomer(ctx context.Context, subject string) (Customer, error) {
	var c Customer
	err := s.pool.QueryRow(ctx, `
		INSERT INTO customers (subject) VALUES ($1)
		ON CONFLICT (subject) DO UPDATE SET subject = EXCLUDED.subject
		RETURNING subject, tier, status
	`, subject).Scan(&c.Subject, &c.Tier, &c.Status)
	if err != nil {
		return Customer{}, err
	}
	c.Limits, err = s.Tier(ctx, c.Tier)
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
