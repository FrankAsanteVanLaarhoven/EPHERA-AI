use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskClass {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    Passkey,
    Pin,
    Biometric,
    PolicyAutoLowRisk,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyOutcome {
    Allow,
    Deny,
    StepUp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub outcome: PolicyOutcome,
    pub risk_class: RiskClass,
    pub reasons: Vec<String>,
    pub required_auth: Vec<AuthMethod>,
}

/// Simple v0 policy: high-value or new-recipient always requires passkey step-up.
pub fn evaluate_transfer_v0(
    amount_minor: i64,
    currency: &str,
    new_recipient: bool,
    wallet_frozen: bool,
) -> PolicyDecision {
    if wallet_frozen {
        return PolicyDecision {
            outcome: PolicyOutcome::Deny,
            risk_class: RiskClass::Critical,
            reasons: vec!["wallet_frozen".into()],
            required_auth: vec![],
        };
    }

    // Thresholds are sandbox placeholders (minor units).
    let high_value = match currency {
        "GHS" => amount_minor >= 500_00, // 500 GHS
        "GBP" => amount_minor >= 100_00, // £100
        _ => amount_minor >= 100_00,
    };

    if new_recipient || high_value {
        return PolicyDecision {
            outcome: PolicyOutcome::StepUp,
            risk_class: if new_recipient {
                RiskClass::High
            } else {
                RiskClass::Medium
            },
            reasons: {
                let mut r = vec![];
                if new_recipient {
                    r.push("new_recipient".into());
                }
                if high_value {
                    r.push("high_value".into());
                }
                r
            },
            required_auth: vec![AuthMethod::Passkey],
        };
    }

    PolicyDecision {
        outcome: PolicyOutcome::StepUp,
        risk_class: RiskClass::Low,
        reasons: vec!["money_movement_always_confirms".into()],
        // Voice is never sufficient; still require device auth for all sends.
        required_auth: vec![AuthMethod::Passkey, AuthMethod::Pin],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frozen_denies() {
        let d = evaluate_transfer_v0(10, "GHS", false, true);
        assert_eq!(d.outcome, PolicyOutcome::Deny);
    }

    #[test]
    fn money_always_requires_auth() {
        let d = evaluate_transfer_v0(10, "GHS", false, false);
        assert_eq!(d.outcome, PolicyOutcome::StepUp);
        assert!(!d.required_auth.is_empty());
    }

    #[test]
    fn new_recipient_high_risk() {
        let d = evaluate_transfer_v0(10, "GHS", true, false);
        assert_eq!(d.risk_class, RiskClass::High);
        assert!(d.required_auth.contains(&AuthMethod::Passkey));
    }
}
