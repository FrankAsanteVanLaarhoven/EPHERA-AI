# Model Card — fraud-ieee-cis v1.0.0

> **Advisory research artifact.** A methodology proxy for payment-risk scoring on a public dataset. It is **not** product performance and is **not** wired into any money-path service. It authorises nothing.

- **Artifact:** `fraud-ieee-cis-v1.0.0.joblib`
- **SHA-256:** `c4e6d6a1523b60f8abd5c16e94a7d50341d2030aba8b1e2796051448b9f5f664`
- **Author:** Frank Asante Van Laarhoven

## Data
- **Dataset:** IEEE-CIS Fraud Detection (Kaggle)
- **Source:** kaggle.com/competitions/ieee-fraud-detection
- **Licence:** Kaggle competition rules; research use only
- **Rows:** 590,540
- **File SHA-256:** `3a5c83ab6b3cc13dcabe5ffa9f522307fd5f7f7b6e6f6a60c32284ca6283d642`
- **Split:** temporal on TransactionDT; train earliest 80%, test latest 20%; encoders fit on train only

## Method
- **Model:** HistGradientBoostingClassifier
- **Hyperparameters:** max_iter=300, learning_rate=0.05, max_leaf_nodes=63, l2_regularization=1.0, class_weight=balanced, early_stopping=True, validation_fraction=0.1, seed=42
- **Numeric features:** TransactionAmt, card1, card2, card3, card5, addr1, addr2, dist1, dist2, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14, D15
- **Categorical features:** ProductCD, card4, card6 (ordinal-encoded on train only; unseen → −1)

## Results (held-out latest window)
- **ROC-AUC:** 0.9022
- **AUPRC:** 0.4897
- **Precision@1%:** 0.8603
- **Precision@5%:** 0.3727
- **Brier:** 0.0741
- **Test prevalence (AUPRC floor):** 0.0344
- **Boosting iterations (early-stopped):** 300

## Leakage checks
Temporal split precedes all fitting; categorical encoders are train-fit only, unseen → −1; no V-block, no identity join, no future features.

## Boundaries
- **Intended use:** research proxy; threshold-recommendation experiments
- **Non-intended use:** live fraud blocking; production decisioning; any authorisation on the money path
- **Audit status:** self-validated; **not** third-party audited or certified.

## Provenance
- sklearn_version=1.9.0, numpy_version=1.26.4, pandas_version=3.0.2, python_version=3.13.13, git_commit=f24cedf546204d35e4428b9eaa20bf4468df191f
