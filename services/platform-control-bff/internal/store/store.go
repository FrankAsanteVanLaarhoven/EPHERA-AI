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
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrSelfApproval = errors.New("an operator cannot approve their own change")
	ErrNotPending   = errors.New("change request is not pending")
	ErrExpired      = errors.New("change request has expired")
	ErrNotApproved  = errors.New("change request has not been approved")
	ErrSuspended    = errors.New("operator is suspended")
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

// Append writes an audit entry, chained to the previous one, retrying on a
// serialization failure.
//
// The append reads the tail hash and inserts the next link in one Serializable
// transaction, so two concurrent appends conflict: one commits and the other
// fails with 40001. That failure was previously returned and then swallowed by
// the caller, so under contention audit entries were silently dropped — and an
// attacker able to induce contention could suppress them, defeating the
// "every attempt is audited" guarantee. Retrying the conflicting append makes
// it wait for the winner and chain onto it instead of being lost.
func (s *Store) Append(ctx context.Context, e AuditEntry) (string, error) {
	const maxAttempts = 8
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		hash, err := s.appendOnce(ctx, e)
		if err == nil {
			return hash, nil
		}
		lastErr = err
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "40001" {
			continue // serialization failure — another append won the race; retry
		}
		return "", err
	}
	return "", fmt.Errorf("audit append failed after %d attempts: %w", maxAttempts, lastErr)
}

func (s *Store) appendOnce(ctx context.Context, e AuditEntry) (string, error) {
	detail, err := json.Marshal(e.Detail)
	if err != nil {
		return "", err
	}
	// An append-only hash chain is inherently serial: each entry links to the
	// current tip, so two appends cannot proceed at once. A transaction-scoped
	// advisory lock makes that explicit — concurrent appends queue in an orderly
	// line. The transaction is Read Committed rather than Serializable on
	// purpose: a Serializable snapshot is fixed before the lock is acquired, so a
	// waiter reads a stale tip and still aborts with 40001 at commit, which is
	// how audit entries were being dropped under contention. Under Read
	// Committed the tip read below runs after the lock is held and sees the
	// previous appender's committed row, so there is no conflict to retry. The
	// lock is released when this transaction commits or rolls back.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('ephera_audit_log'))`); err != nil {
		return "", err
	}

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

// ListChangeRequests returns the most recent requests, newest first.
func (s *Store) ListChangeRequests(ctx context.Context, limit int) ([]ChangeRequest, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, action, target, payload, reason, status, requested_by, requested_at,
		       decided_by, decided_at, decision_note, expires_at
		FROM change_requests ORDER BY requested_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ChangeRequest{}
	for rows.Next() {
		var cr ChangeRequest
		var payload []byte
		if err := rows.Scan(&cr.ID, &cr.Action, &cr.Target, &payload, &cr.Reason, &cr.Status,
			&cr.RequestedBy, &cr.RequestedAt, &cr.DecidedBy, &cr.DecidedAt, &cr.DecisionNote,
			&cr.ExpiresAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(payload, &cr.Payload)
		out = append(out, cr)
	}
	return out, rows.Err()
}

// AuditRow is one entry as presented to an operator.
type AuditRow struct {
	Seq         int64     `json:"seq"`
	At          time.Time `json:"at"`
	Actor       string    `json:"actor"`
	ActorMethod string    `json:"actorMethod"`
	Action      string    `json:"action"`
	Target      string    `json:"target"`
	Outcome     string    `json:"outcome"`
	EntryHash   string    `json:"entryHash"`
}

func (s *Store) ListAudit(ctx context.Context, limit int) ([]AuditRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT seq, at, actor, actor_method, action, target, outcome, entry_hash
		FROM audit_log ORDER BY seq DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []AuditRow{}
	for rows.Next() {
		var a AuditRow
		if err := rows.Scan(&a.Seq, &a.At, &a.Actor, &a.ActorMethod, &a.Action,
			&a.Target, &a.Outcome, &a.EntryHash); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// --- platform flags ---

type Flag struct {
	Key         string    `json:"key"`
	Enabled     bool      `json:"enabled"`
	Description string    `json:"description"`
	UpdatedBy   string    `json:"updatedBy"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (s *Store) Flags(ctx context.Context) ([]Flag, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT key, enabled, description, updated_by, updated_at
		FROM platform_flags ORDER BY key
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Flag{}
	for rows.Next() {
		var f Flag
		if err := rows.Scan(&f.Key, &f.Enabled, &f.Description, &f.UpdatedBy, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// SetFlag records a new value and appends to the flag's history. Both happen in
// one transaction: a flag whose current value is not in its own history cannot
// be explained after the fact.
func (s *Store) SetFlag(ctx context.Context, key string, enabled bool, changedBy, changeRequestID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var crID *string
	if changeRequestID != "" {
		crID = &changeRequestID
	}
	ct, err := tx.Exec(ctx, `
		UPDATE platform_flags
		SET enabled = $2, updated_by = $3, updated_at = now(), change_request_id = $4
		WHERE key = $1
	`, key, enabled, changedBy, crID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("%w: flag %q", ErrNotFound, key)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO platform_flag_history (key, enabled, changed_by, change_request_id)
		VALUES ($1,$2,$3,$4)
	`, key, enabled, changedBy, crID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
