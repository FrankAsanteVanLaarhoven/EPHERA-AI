package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound          = errors.New("not found")
	ErrInsufficientFunds = errors.New("insufficient funds")
	ErrFrozen            = errors.New("account frozen")
	ErrUnauthorised      = errors.New("missing authorisation")
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

type Account struct {
	ID          uuid.UUID `json:"id"`
	ExternalRef string    `json:"externalRef"`
	OwnerID     uuid.UUID `json:"ownerId"`
	Currency    string    `json:"currency"`
	AccountType string    `json:"accountType"`
	Status      string    `json:"status"`
	Balance     int64     `json:"balanceMinor"`
	Hold        int64     `json:"holdMinor"`
	Available   int64     `json:"availableMinor"`
}

func (s *Store) GetByExternalRef(ctx context.Context, ref string) (Account, error) {
	var a Account
	err := s.pool.QueryRow(ctx, `
		SELECT a.id, a.external_ref, a.owner_id, a.currency, a.account_type, a.status,
		       COALESCE(b.balance_minor,0), COALESCE(b.hold_minor,0)
		FROM accounts a
		LEFT JOIN account_balances b ON b.account_id = a.id
		WHERE a.external_ref = $1
	`, ref).Scan(&a.ID, &a.ExternalRef, &a.OwnerID, &a.Currency, &a.AccountType, &a.Status, &a.Balance, &a.Hold)
	if errors.Is(err, pgx.ErrNoRows) {
		return Account{}, ErrNotFound
	}
	if err != nil {
		return Account{}, err
	}
	a.Available = a.Balance - a.Hold
	return a, nil
}

func (s *Store) Freeze(ctx context.Context, externalRef, reason string) (Account, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Account{}, err
	}
	defer tx.Rollback(ctx)

	var id uuid.UUID
	var status string
	err = tx.QueryRow(ctx, `SELECT id, status FROM accounts WHERE external_ref=$1 FOR UPDATE`, externalRef).Scan(&id, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return Account{}, ErrNotFound
	}
	if err != nil {
		return Account{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE accounts SET status='frozen', updated_at=now() WHERE id=$1`, id)
	if err != nil {
		return Account{}, err
	}
	// audit row via authorisation_evidence with freeze pseudo-transfer
	_, _ = tx.Exec(ctx, `
		INSERT INTO authorisation_evidence (transfer_id, method, policy_decision)
		VALUES ($1, 'passkey', $2::jsonb)
	`, "freeze:"+externalRef+":"+time.Now().UTC().Format(time.RFC3339Nano),
		fmt.Sprintf(`{"action":"freeze","reason":%q}`, reason))
	if err := tx.Commit(ctx); err != nil {
		return Account{}, err
	}
	return s.GetByExternalRef(ctx, externalRef)
}

func (s *Store) Unfreeze(ctx context.Context, externalRef string) (Account, error) {
	ct, err := s.pool.Exec(ctx, `UPDATE accounts SET status='active', updated_at=now() WHERE external_ref=$1 AND status='frozen'`, externalRef)
	if err != nil {
		return Account{}, err
	}
	if ct.RowsAffected() == 0 {
		// may already be active
		a, err := s.GetByExternalRef(ctx, externalRef)
		if err != nil {
			return Account{}, err
		}
		return a, nil
	}
	return s.GetByExternalRef(ctx, externalRef)
}

type HoldRequest struct {
	FromExternalRef string
	AmountMinor     int64
	Currency        string
	TransferID      string
	IdempotencyKey  string
}

// PlaceHold reserves funds on the sender (hold_minor++). Idempotent.
func (s *Store) PlaceHold(ctx context.Context, req HoldRequest) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var existing string
	err = tx.QueryRow(ctx, `SELECT id::text FROM holds WHERE idempotency_key=$1`, req.IdempotencyKey).Scan(&existing)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	var acctID uuid.UUID
	var status string
	var balance, hold int64
	err = tx.QueryRow(ctx, `
		SELECT a.id, a.status, b.balance_minor, b.hold_minor
		FROM accounts a JOIN account_balances b ON b.account_id=a.id
		WHERE a.external_ref=$1 FOR UPDATE OF a, b
	`, req.FromExternalRef).Scan(&acctID, &status, &balance, &hold)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if status == "frozen" {
		return "", ErrFrozen
	}
	if balance-hold < req.AmountMinor {
		return "", ErrInsufficientFunds
	}

	holdID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO holds (id, account_id, amount_minor, currency, transfer_id, status, idempotency_key)
		VALUES ($1,$2,$3,$4,$5,'open',$6)
	`, holdID, acctID, req.AmountMinor, req.Currency, req.TransferID, req.IdempotencyKey)
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `
		UPDATE account_balances SET hold_minor = hold_minor + $2, updated_at=now() WHERE account_id=$1
	`, acctID, req.AmountMinor)
	if err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return holdID.String(), nil
}

type TransferRequest struct {
	FromExternalRef  string
	ToExternalRef    string
	AmountMinor      int64
	Currency         string
	TransferID       string
	IdempotencyKey   string
	AuthorisationRef string
	HoldID           string
	Description      string
	FeeMinor         int64
}

// CaptureTransfer releases hold and posts double-entry transfer + optional fee.
func (s *Store) CaptureTransfer(ctx context.Context, req TransferRequest) (string, error) {
	if req.AuthorisationRef == "" {
		return "", ErrUnauthorised
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var existingJE string
	err = tx.QueryRow(ctx, `SELECT id::text FROM journal_entries WHERE idempotency_key=$1`, req.IdempotencyKey).Scan(&existingJE)
	if err == nil {
		return existingJE, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	from, err := lockAccount(ctx, tx, req.FromExternalRef)
	if err != nil {
		return "", err
	}
	to, err := lockAccount(ctx, tx, req.ToExternalRef)
	if err != nil {
		return "", err
	}
	if from.Status == "frozen" {
		return "", ErrFrozen
	}
	if from.Currency != req.Currency || to.Currency != req.Currency {
		return "", fmt.Errorf("currency mismatch")
	}

	// Capture open hold if provided
	if req.HoldID != "" {
		holdUUID, err := uuid.Parse(req.HoldID)
		if err != nil {
			return "", fmt.Errorf("invalid hold id")
		}
		var holdAmt int64
		var holdStatus string
		var holdAcct uuid.UUID
		err = tx.QueryRow(ctx, `
			SELECT account_id, amount_minor, status FROM holds WHERE id=$1 FOR UPDATE
		`, holdUUID).Scan(&holdAcct, &holdAmt, &holdStatus)
		if err != nil {
			return "", fmt.Errorf("hold: %w", err)
		}
		if holdStatus == "open" {
			_, err = tx.Exec(ctx, `UPDATE holds SET status='captured', updated_at=now() WHERE id=$1`, holdUUID)
			if err != nil {
				return "", err
			}
			_, err = tx.Exec(ctx, `
				UPDATE account_balances SET hold_minor = hold_minor - $2, updated_at=now() WHERE account_id=$1
			`, holdAcct, holdAmt)
			if err != nil {
				return "", err
			}
		}
	}

	// Re-read available after hold release
	var bal, h int64
	err = tx.QueryRow(ctx, `SELECT balance_minor, hold_minor FROM account_balances WHERE account_id=$1`, from.ID).Scan(&bal, &h)
	if err != nil {
		return "", err
	}
	totalDebit := req.AmountMinor + req.FeeMinor
	if bal-h < totalDebit {
		return "", ErrInsufficientFunds
	}

	jeID := uuid.New()
	desc := req.Description
	if desc == "" {
		desc = fmt.Sprintf("Transfer %s", req.TransferID)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO journal_entries (id, idempotency_key, transfer_id, description, metadata)
		VALUES ($1,$2,$3,$4,$5::jsonb)
	`, jeID, req.IdempotencyKey, req.TransferID, desc,
		fmt.Sprintf(`{"authorisationRef":%q}`, req.AuthorisationRef))
	if err != nil {
		return "", err
	}

	// Debit sender principal
	if err := insertPosting(ctx, tx, jeID, from.ID, req.AmountMinor, req.Currency, "debit"); err != nil {
		return "", err
	}
	// Credit recipient principal
	if err := insertPosting(ctx, tx, jeID, to.ID, req.AmountMinor, req.Currency, "credit"); err != nil {
		return "", err
	}

	if err := adjustBalance(ctx, tx, from.ID, -req.AmountMinor); err != nil {
		return "", err
	}
	if err := adjustBalance(ctx, tx, to.ID, req.AmountMinor); err != nil {
		return "", err
	}

	if req.FeeMinor > 0 {
		var feeID uuid.UUID
		err = tx.QueryRow(ctx, `SELECT id FROM accounts WHERE external_ref=$1`, "system:fee:"+req.Currency).Scan(&feeID)
		if err != nil {
			return "", fmt.Errorf("fee account: %w", err)
		}
		if err := insertPosting(ctx, tx, jeID, from.ID, req.FeeMinor, req.Currency, "debit"); err != nil {
			return "", err
		}
		if err := insertPosting(ctx, tx, jeID, feeID, req.FeeMinor, req.Currency, "credit"); err != nil {
			return "", err
		}
		if err := adjustBalance(ctx, tx, from.ID, -req.FeeMinor); err != nil {
			return "", err
		}
		if err := adjustBalance(ctx, tx, feeID, req.FeeMinor); err != nil {
			return "", err
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO authorisation_evidence (transfer_id, method, policy_decision)
		VALUES ($1, 'passkey', $2::jsonb)
	`, req.TransferID, fmt.Sprintf(`{"authorisationRef":%q}`, req.AuthorisationRef))
	if err != nil {
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return jeID.String(), nil
}

type acctRow struct {
	ID       uuid.UUID
	Status   string
	Currency string
}

func lockAccount(ctx context.Context, tx pgx.Tx, externalRef string) (acctRow, error) {
	var a acctRow
	err := tx.QueryRow(ctx, `
		SELECT a.id, a.status, a.currency
		FROM accounts a JOIN account_balances b ON b.account_id=a.id
		WHERE a.external_ref=$1 FOR UPDATE OF a, b
	`, externalRef).Scan(&a.ID, &a.Status, &a.Currency)
	if errors.Is(err, pgx.ErrNoRows) {
		return acctRow{}, ErrNotFound
	}
	return a, err
}

func insertPosting(ctx context.Context, tx pgx.Tx, je, acct uuid.UUID, amount int64, ccy, dir string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO postings (journal_entry_id, account_id, amount_minor, currency, direction)
		VALUES ($1,$2,$3,$4,$5)
	`, je, acct, amount, ccy, dir)
	return err
}

func adjustBalance(ctx context.Context, tx pgx.Tx, acct uuid.UUID, delta int64) error {
	_, err := tx.Exec(ctx, `
		UPDATE account_balances SET balance_minor = balance_minor + $2, updated_at=now() WHERE account_id=$1
	`, acct, delta)
	return err
}

// ReleaseHold cancels an open hold (failed transfer path).
func (s *Store) ReleaseHold(ctx context.Context, holdID string) error {
	id, err := uuid.Parse(holdID)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var acct uuid.UUID
	var amount int64
	var status string
	err = tx.QueryRow(ctx, `SELECT account_id, amount_minor, status FROM holds WHERE id=$1 FOR UPDATE`, id).
		Scan(&acct, &amount, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status != "open" {
		return nil
	}
	_, err = tx.Exec(ctx, `UPDATE holds SET status='released', updated_at=now() WHERE id=$1`, id)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE account_balances SET hold_minor = hold_minor - $2, updated_at=now() WHERE account_id=$1`, acct, amount)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
