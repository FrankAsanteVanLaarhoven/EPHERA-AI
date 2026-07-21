//! EPHERA financial core primitives.
//!
//! # This crate is not in the money path
//!
//! Nothing links, calls or embeds it: there is no FFI surface, no dynamic
//! library target, and no Go, TypeScript or Swift consumer (deviation D-11).
//! It is executable specification -- the double-entry and policy rules written
//! so they can be exercised -- and its passing tests are **not** assurance
//! about the ledger service.
//!
//! The ledger's own assurance lives in `services/ledger`, where the same
//! invariants are enforced by database constraints and triggers and covered by
//! integration tests that run against Postgres.
//!
//! Whether this crate is linked into the money path, kept as specification, or
//! retired is an open decision recorded against D-11.
//!
//! The server ledger service is the system of record. This crate provides:
//! - typed money amounts
//! - double-entry journal validation
//! - idempotent posting helpers for tests and offline dry-runs
//!
//! Mobile may use a subset for offline queue validation; it must never treat
//! local state as settled balances.

pub mod money;
pub mod posting;
pub mod policy;

pub use money::{Currency, Money, MoneyError};
pub use posting::{
    Direction, JournalEntry, JournalError, Ledger, Posting, TransferId,
};
pub use policy::{AuthMethod, PolicyDecision, PolicyOutcome, RiskClass};
