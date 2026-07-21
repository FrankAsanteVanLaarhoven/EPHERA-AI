// Package store persists operators, change requests and the audit trail.
package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrSelfApproval  = errors.New("an operator cannot approve their own change")
	ErrNotPending    = errors.New("change request is not pending")
	ErrExpired       = errors.New("change request has expired")
	ErrNotApproved   = errors.New("change request has not been approved")
	ErrSuspended     = errors.New("operator is suspended")
)

// GenesisHash begins the audit chain. It is a constant rather than an empty
// string so the first row is still covered by a hash.
const GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000"

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

func (s *Store) Close() { s.pool.Close() }

// Pool exposes the connection for tests that need to inspect raw rows.
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

type Operator struct {
	Subject     string
	DisplayName string
	Status      string
	Roles       []string
}

// LoadOperator returns the operator and the roles held right now. Roles in a
// session are a snapshot from issue time; anything that matters re-reads them,
// so suspending an operator takes effect without waiting for a session to
// expire.
func (s *Store) LoadOperator(ctx context.Context, subject string) (Operator, error) {
	var op Operator
	err := s.pool.QueryRow(ctx, `
		SELECT subject, display_name, status FROM operators WHERE subject = $1
	`, subject).Scan(&op.Subject, &op.DisplayName, &op.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return Operator{}, ErrNotFound
	}
	if err != nil {
		return Operator{}, err
	}
	rows, err := s.pool.Query(ctx, `SELECT role FROM operator_roles WHERE subject = $1 ORDER BY role`, subject)
	if err != nil {
		return Operator{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			return Operator{}, err
		}
		op.Roles = append(op.Roles, r)
	}
	return op, rows.Err()
}

type ChangeRequest struct {
	ID           string
	Action       string
	Target       string
	Payload      map[string]any
	Reason       string
	Status       string
	RequestedBy  string
	RequestedAt  time.Time
	DecidedBy    *string
	DecidedAt    *time.Time
	DecisionNote *string
	ExpiresAt    time.Time
}

func (s *Store) CreateChangeRequest(ctx context.Context, cr ChangeRequest) (ChangeRequest, error) {
	payload, err := json.Marshal(cr.Payload)
	if err != nil {
		return ChangeRequest{}, err
	}
	err = s.pool.QueryRow(ctx, `
		INSERT INTO change_requests (action, target, payload, reason, requested_by, expires_at)
		VALUES ($1,$2,$3::jsonb,$4,$5,$6)
		RETURNING id, status, requested_at, expires_at
	`, cr.Action, cr.Target, payload, cr.Reason, cr.RequestedBy, cr.ExpiresAt).
		Scan(&cr.ID, &cr.Status, &cr.RequestedAt, &cr.ExpiresAt)
	return cr, err
}

func (s *Store) GetChangeRequest(ctx context.Context, id string) (ChangeRequest, error) {
	var cr ChangeRequest
	var payload []byte
	err := s.pool.QueryRow(ctx, `
		SELECT id, action, target, payload, reason, status, requested_by, requested_at,
		       decided_by, decided_at, decision_note, expires_at
		FROM change_requests WHERE id = $1
	`, id).Scan(&cr.ID, &cr.Action, &cr.Target, &payload, &cr.Reason, &cr.Status,
		&cr.RequestedBy, &cr.RequestedAt, &cr.DecidedBy, &cr.DecidedAt, &cr.DecisionNote, &cr.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ChangeRequest{}, ErrNotFound
	}
	if err != nil {
		return ChangeRequest{}, err
	}
	_ = json.Unmarshal(payload, &cr.Payload)
	return cr, nil
}

// Decide approves or rejects a change request. Self-approval is refused here
// and, independently, by a database constraint -- so a defect in this function
// cannot produce a self-approved change.
func (s *Store) Decide(ctx context.Context, id, decider, decision, note string) (ChangeRequest, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ChangeRequest{}, err
	}
	defer tx.Rollback(ctx)

	var requestedBy, status string
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT requested_by, status, expires_at FROM change_requests WHERE id = $1 FOR UPDATE
	`, id).Scan(&requestedBy, &status, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ChangeRequest{}, ErrNotFound
	}
	if err != nil {
		return ChangeRequest{}, err
	}
	if status != "pending" {
		return ChangeRequest{}, ErrNotPending
	}
	if time.Now().After(expiresAt) {
		_, _ = tx.Exec(ctx, `UPDATE change_requests SET status='expired' WHERE id=$1`, id)
		_ = tx.Commit(ctx)
		return ChangeRequest{}, ErrExpired
	}
	if decider == requestedBy {
		return ChangeRequest{}, ErrSelfApproval
	}

	if _, err := tx.Exec(ctx, `
		UPDATE change_requests
		SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4
		WHERE id = $1
	`, id, decision, decider, note); err != nil {
		return ChangeRequest{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ChangeRequest{}, err
	}
	return s.GetChangeRequest(ctx, id)
}

// MarkApplied records that an approved change was carried out. Only an approved
// request can reach this state.
func (s *Store) MarkApplied(ctx context.Context, id string) error {
	ct, err := s.pool.Exec(ctx, `
		UPDATE change_requests SET status='applied', applied_at=now()
		WHERE id=$1 AND status='approved'
	`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotApproved
	}
	return nil
}

type AuditEntry struct {
	Actor           string
	ActorMethod     string
	SessionID       string
	Action          string
	Target          string
	Outcome         string
	Detail          map[string]any
	ChangeRequestID *string
}

// Append writes one audit record, chained to the previous one. Both the read of
// the tip and the insert happen in a single serialisable transaction, so two
// concurrent writers cannot produce a fork.
func (s *Store) Append(ctx context.Context, e AuditEntry) (string, error) {
	detail, err := json.Marshal(e.Detail)
	if err != nil {
		return "", err
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	prev := GenesisHash
	err = tx.QueryRow(ctx, `SELECT entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1`).Scan(&prev)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	// Postgres timestamptz keeps microseconds, so the value must be truncated
	// before it is hashed. Hashing a nanosecond timestamp that the database
	// then rounds would break the chain on the first verification.
	at := time.Now().UTC().Truncate(time.Microsecond)
	hash := chainHash(prev, at, e, detail)
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_log
			(at, actor, actor_method, session_id, action, target, outcome, detail,
			 change_request_id, prev_hash, entry_hash)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
	`, at, e.Actor, e.ActorMethod, e.SessionID, e.Action, e.Target, e.Outcome, detail,
		e.ChangeRequestID, prev, hash); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return hash, nil
}

// canonicalDetail normalises the JSON detail so the hash is stable across a
// database round-trip. Postgres stores jsonb in its own normalised form -- key
// order and whitespace are not preserved -- so hashing the bytes as written
// would break verification the moment they were read back. Go's encoder sorts
// map keys, which gives both sides the same representation.
func canonicalDetail(raw []byte) []byte {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}

func chainHash(prev string, at time.Time, e AuditEntry, detail []byte) string {
	h := sha256.New()
	write := func(s string) {
		_, _ = fmt.Fprintf(h, "%d:", len(s))
		_, _ = h.Write([]byte(s))
	}
	write(prev)
	write(at.Format(time.RFC3339Nano))
	write(e.Actor)
	write(e.ActorMethod)
	write(e.SessionID)
	write(e.Action)
	write(e.Target)
	write(e.Outcome)
	write(string(canonicalDetail(detail)))
	if e.ChangeRequestID != nil {
		write(*e.ChangeRequestID)
	} else {
		write("")
	}
	return hex.EncodeToString(h.Sum(nil))
}

// VerifyChain recomputes every hash from the genesis value. It returns the
// sequence number of the first row that does not match, or 0 when the chain is
// intact. This is what makes tampering detectable by anyone, not just by the
// service that wrote the rows.
func (s *Store) VerifyChain(ctx context.Context) (int64, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT seq, at, actor, actor_method, session_id, action, target, outcome,
		       detail, change_request_id, prev_hash, entry_hash
		FROM audit_log ORDER BY seq ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	prev := GenesisHash
	for rows.Next() {
		var seq int64
		var at time.Time
		var e AuditEntry
		var detail []byte
		var prevHash, entryHash string
		if err := rows.Scan(&seq, &at, &e.Actor, &e.ActorMethod, &e.SessionID, &e.Action,
			&e.Target, &e.Outcome, &detail, &e.ChangeRequestID, &prevHash, &entryHash); err != nil {
			return 0, err
		}
		if prevHash != prev {
			return seq, nil
		}
		if chainHash(prev, at.UTC(), e, detail) != entryHash {
			return seq, nil
		}
		prev = entryHash
	}
	return 0, rows.Err()
}
