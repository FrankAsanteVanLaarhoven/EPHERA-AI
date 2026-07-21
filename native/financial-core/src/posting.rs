use crate::money::{Currency, Money, MoneyError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Debit,
    Credit,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TransferId(pub Uuid);

impl TransferId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for TransferId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Posting {
    pub account_id: Uuid,
    pub money: Money,
    pub direction: Direction,
}

impl Posting {
    /// Signed contribution to account balance: credits increase, debits decrease.
    pub fn signed_delta(&self) -> i64 {
        match self.direction {
            Direction::Credit => self.money.amount_minor.abs(),
            Direction::Debit => -self.money.amount_minor.abs(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct JournalEntry {
    pub id: Uuid,
    pub transfer_id: TransferId,
    pub idempotency_key: String,
    pub description: String,
    pub postings: Vec<Posting>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum JournalError {
    #[error("journal must contain at least two postings")]
    TooFewPostings,
    #[error("journal is not balanced for currency {0}: net {1}")]
    Unbalanced(String, i64),
    #[error("duplicate idempotency key: {0}")]
    DuplicateIdempotency(String),
    #[error("missing authorisation evidence for transfer")]
    MissingAuthorisation,
    #[error(transparent)]
    Money(#[from] MoneyError),
    #[error("insufficient available balance on account {0}")]
    InsufficientFunds(Uuid),
    #[error("account not found: {0}")]
    AccountNotFound(Uuid),
    #[error("account is frozen: {0}")]
    AccountFrozen(Uuid),
}

#[derive(Clone, Debug)]
pub struct AccountState {
    pub id: Uuid,
    pub currency: Currency,
    pub balance_minor: i64,
    pub hold_minor: i64,
    pub frozen: bool,
}

impl AccountState {
    pub fn available(&self) -> i64 {
        self.balance_minor - self.hold_minor
    }
}

/// In-memory ledger for unit tests and offline dry-runs.
#[derive(Default)]
pub struct Ledger {
    accounts: HashMap<Uuid, AccountState>,
    seen_idempotency: HashMap<String, Uuid>,
    journals: Vec<JournalEntry>,
}

impl Ledger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_account(&mut self, id: Uuid, currency: Currency) {
        self.accounts.insert(
            id,
            AccountState {
                id,
                currency,
                balance_minor: 0,
                hold_minor: 0,
                frozen: false,
            },
        );
    }

    pub fn credit_opening_balance(
        &mut self,
        account_id: Uuid,
        amount_minor: i64,
    ) -> Result<(), JournalError> {
        let acct = self
            .accounts
            .get_mut(&account_id)
            .ok_or(JournalError::AccountNotFound(account_id))?;
        acct.balance_minor = acct
            .balance_minor
            .checked_add(amount_minor)
            .ok_or(MoneyError::Overflow)?;
        Ok(())
    }

    pub fn set_frozen(&mut self, account_id: Uuid, frozen: bool) -> Result<(), JournalError> {
        let acct = self
            .accounts
            .get_mut(&account_id)
            .ok_or(JournalError::AccountNotFound(account_id))?;
        acct.frozen = frozen;
        Ok(())
    }

    pub fn balance(&self, account_id: Uuid) -> Result<i64, JournalError> {
        self.accounts
            .get(&account_id)
            .map(|a| a.balance_minor)
            .ok_or(JournalError::AccountNotFound(account_id))
    }

    /// Validate double-entry balance: for each currency, sum of signed deltas is zero.
    pub fn validate_balanced(postings: &[Posting]) -> Result<(), JournalError> {
        if postings.len() < 2 {
            return Err(JournalError::TooFewPostings);
        }
        let mut nets: HashMap<String, i64> = HashMap::new();
        for p in postings {
            let key = p.money.currency.as_str().to_string();
            let entry = nets.entry(key).or_insert(0);
            *entry = entry
                .checked_add(p.signed_delta())
                .ok_or(MoneyError::Overflow)?;
        }
        for (ccy, net) in nets {
            if net != 0 {
                return Err(JournalError::Unbalanced(ccy, net));
            }
        }
        Ok(())
    }

    /// Post a balanced journal. Requires authorisation flag for money-moving entries.
    pub fn post(
        &mut self,
        entry: JournalEntry,
        authorised: bool,
    ) -> Result<Uuid, JournalError> {
        if !authorised {
            return Err(JournalError::MissingAuthorisation);
        }
        if let Some(existing) = self.seen_idempotency.get(&entry.idempotency_key) {
            return Ok(*existing);
        }
        Self::validate_balanced(&entry.postings)?;

        // Pre-check accounts and available funds for debits
        for p in &entry.postings {
            let acct = self
                .accounts
                .get(&p.account_id)
                .ok_or(JournalError::AccountNotFound(p.account_id))?;
            if acct.frozen {
                return Err(JournalError::AccountFrozen(p.account_id));
            }
            if acct.currency != p.money.currency {
                return Err(MoneyError::CurrencyMismatch(
                    acct.currency.to_string(),
                    p.money.currency.to_string(),
                )
                .into());
            }
            if matches!(p.direction, Direction::Debit) && acct.available() < p.money.amount_minor.abs()
            {
                // Allow system/clearing overdraft in tests only if balance was seeded;
                // strict for all accounts in this engine.
                return Err(JournalError::InsufficientFunds(p.account_id));
            }
        }

        for p in &entry.postings {
            let acct = self.accounts.get_mut(&p.account_id).unwrap();
            acct.balance_minor = acct
                .balance_minor
                .checked_add(p.signed_delta())
                .ok_or(MoneyError::Overflow)?;
        }

        let id = entry.id;
        self.seen_idempotency
            .insert(entry.idempotency_key.clone(), id);
        self.journals.push(entry);
        Ok(id)
    }

    pub fn journal_count(&self) -> usize {
        self.journals.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::money::Currency;

    fn ghs(amount: i64) -> Money {
        Money::new(amount, Currency::new("GHS").unwrap()).unwrap()
    }

    #[test]
    fn balanced_transfer_moves_funds() {
        let mut ledger = Ledger::new();
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        ledger.open_account(alice, Currency::new("GHS").unwrap());
        ledger.open_account(bob, Currency::new("GHS").unwrap());
        ledger.credit_opening_balance(alice, 10_000).unwrap();

        let entry = JournalEntry {
            id: Uuid::new_v4(),
            transfer_id: TransferId::new(),
            idempotency_key: "tx-1".into(),
            description: "Send to Bob".into(),
            postings: vec![
                Posting {
                    account_id: alice,
                    money: ghs(1_500),
                    direction: Direction::Debit,
                },
                Posting {
                    account_id: bob,
                    money: ghs(1_500),
                    direction: Direction::Credit,
                },
            ],
        };

        ledger.post(entry, true).unwrap();
        assert_eq!(ledger.balance(alice).unwrap(), 8_500);
        assert_eq!(ledger.balance(bob).unwrap(), 1_500);
    }

    #[test]
    fn rejects_unauthorised() {
        let mut ledger = Ledger::new();
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        ledger.open_account(a, Currency::new("GHS").unwrap());
        ledger.open_account(b, Currency::new("GHS").unwrap());
        ledger.credit_opening_balance(a, 100).unwrap();
        let entry = JournalEntry {
            id: Uuid::new_v4(),
            transfer_id: TransferId::new(),
            idempotency_key: "tx-u".into(),
            description: "no auth".into(),
            postings: vec![
                Posting {
                    account_id: a,
                    money: ghs(50),
                    direction: Direction::Debit,
                },
                Posting {
                    account_id: b,
                    money: ghs(50),
                    direction: Direction::Credit,
                },
            ],
        };
        assert_eq!(
            ledger.post(entry, false).unwrap_err(),
            JournalError::MissingAuthorisation
        );
    }

    #[test]
    fn idempotent_post() {
        let mut ledger = Ledger::new();
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        ledger.open_account(a, Currency::new("GHS").unwrap());
        ledger.open_account(b, Currency::new("GHS").unwrap());
        ledger.credit_opening_balance(a, 500).unwrap();
        let make = || JournalEntry {
            id: Uuid::new_v4(),
            transfer_id: TransferId::new(),
            idempotency_key: "same-key".into(),
            description: "once".into(),
            postings: vec![
                Posting {
                    account_id: a,
                    money: ghs(100),
                    direction: Direction::Debit,
                },
                Posting {
                    account_id: b,
                    money: ghs(100),
                    direction: Direction::Credit,
                },
            ],
        };
        ledger.post(make(), true).unwrap();
        ledger.post(make(), true).unwrap();
        assert_eq!(ledger.journal_count(), 1);
        assert_eq!(ledger.balance(a).unwrap(), 400);
        assert_eq!(ledger.balance(b).unwrap(), 100);
    }

    #[test]
    fn unbalanced_rejected() {
        let postings = vec![Posting {
            account_id: Uuid::new_v4(),
            money: ghs(100),
            direction: Direction::Debit,
        }];
        assert!(matches!(
            Ledger::validate_balanced(&postings),
            Err(JournalError::TooFewPostings)
        ));

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let postings = vec![
            Posting {
                account_id: a,
                money: ghs(100),
                direction: Direction::Debit,
            },
            Posting {
                account_id: b,
                money: ghs(90),
                direction: Direction::Credit,
            },
        ];
        assert!(matches!(
            Ledger::validate_balanced(&postings),
            Err(JournalError::Unbalanced(_, _))
        ));
    }

    #[test]
    fn frozen_blocks_debit() {
        let mut ledger = Ledger::new();
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        ledger.open_account(a, Currency::new("GHS").unwrap());
        ledger.open_account(b, Currency::new("GHS").unwrap());
        ledger.credit_opening_balance(a, 1000).unwrap();
        ledger.set_frozen(a, true).unwrap();
        let entry = JournalEntry {
            id: Uuid::new_v4(),
            transfer_id: TransferId::new(),
            idempotency_key: "frozen".into(),
            description: "blocked".into(),
            postings: vec![
                Posting {
                    account_id: a,
                    money: ghs(100),
                    direction: Direction::Debit,
                },
                Posting {
                    account_id: b,
                    money: ghs(100),
                    direction: Direction::Credit,
                },
            ],
        };
        assert!(matches!(
            ledger.post(entry, true),
            Err(JournalError::AccountFrozen(_))
        ));
    }
}
