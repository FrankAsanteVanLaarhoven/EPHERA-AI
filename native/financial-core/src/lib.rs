//! EPHERA financial core primitives.
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
