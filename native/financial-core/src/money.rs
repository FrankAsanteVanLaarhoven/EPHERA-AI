use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum MoneyError {
    #[error("currency mismatch: {0} vs {1}")]
    CurrencyMismatch(String, String),
    #[error("overflow")]
    Overflow,
    #[error("invalid currency code: {0}")]
    InvalidCurrency(String),
    #[error("amount must be non-zero for postings")]
    ZeroAmount,
}

/// ISO-4217 style currency code (validated as 3 ASCII letters).
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Currency(String);

impl Currency {
    pub fn new(code: impl AsRef<str>) -> Result<Self, MoneyError> {
        let c = code.as_ref().to_uppercase();
        if c.len() != 3 || !c.chars().all(|ch| ch.is_ascii_alphabetic()) {
            return Err(MoneyError::InvalidCurrency(c));
        }
        Ok(Self(c))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Money in minor units (e.g. pesewas, pence) to avoid float errors.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub amount_minor: i64,
    pub currency: Currency,
}

impl Money {
    pub fn new(amount_minor: i64, currency: Currency) -> Result<Self, MoneyError> {
        if amount_minor == 0 {
            return Err(MoneyError::ZeroAmount);
        }
        Ok(Self {
            amount_minor,
            currency,
        })
    }

    pub fn checked_add(&self, other: &Money) -> Result<Money, MoneyError> {
        if self.currency != other.currency {
            return Err(MoneyError::CurrencyMismatch(
                self.currency.to_string(),
                other.currency.to_string(),
            ));
        }
        let sum = self
            .amount_minor
            .checked_add(other.amount_minor)
            .ok_or(MoneyError::Overflow)?;
        Ok(Money {
            amount_minor: sum,
            currency: self.currency.clone(),
        })
    }

    pub fn negate(&self) -> Money {
        Money {
            amount_minor: -self.amount_minor,
            currency: self.currency.clone(),
        }
    }

    pub fn abs(&self) -> Money {
        Money {
            amount_minor: self.amount_minor.abs(),
            currency: self.currency.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn currency_normalises() {
        let c = Currency::new("ghs").unwrap();
        assert_eq!(c.as_str(), "GHS");
    }

    #[test]
    fn rejects_zero() {
        let c = Currency::new("GHS").unwrap();
        assert!(Money::new(0, c).is_err());
    }

    #[test]
    fn add_same_currency() {
        let c = Currency::new("GHS").unwrap();
        let a = Money::new(100, c.clone()).unwrap();
        let b = Money::new(50, c).unwrap();
        assert_eq!(a.checked_add(&b).unwrap().amount_minor, 150);
    }
}
