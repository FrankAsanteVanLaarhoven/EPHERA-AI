# Fraud model — versioned artifact (advisory, off the money path)

This directory turns the fraud-detection study notebook into a **persisted,
versioned, reproducible artifact**. Before, the model was trained ephemerally
inside the notebook and thrown away when the kernel closed — nothing was saved.
Now there is a producer, a saved binary addressed by checksum, a machine- and
human-readable model card, and a loader that verifies the checksum before use.

## The boundary — read this first

This model is a **research / methodology proxy** for payment-risk scoring on a
public dataset. It is:

- **Advisory only.** A score proposes analyst attention. It authorises nothing.
- **Not wired into any service.** No code under `services/` imports it. It is not
  on the money path, by the same principle the rest of the platform is built on:
  a probabilistic model may propose, never authorise.
- **Not product performance.** The metrics are on the IEEE-CIS card-fraud
  dataset, a different problem from the platform's authorised-push engine. They
  must not be quoted as platform or product claims.
- **Not third-party audited or certified.**

## Files

| File | What it is | In git |
| --- | --- | --- |
| `export_model.py` | Reproducible producer: load → temporal split → train → evaluate → save → checksum → round-trip verify → write card | yes |
| `predict.py` | Loader that verifies the artifact's SHA-256, then scores rows (advisory) | yes |
| `MODEL_CARD.md` | Human model card with the real metrics of the committed version | yes |
| `artifacts/model_card.json` | Machine-readable card: version, checksum, metrics, provenance | yes |
| `artifacts/*.joblib` | The trained binary (content-addressed by the card's SHA-256) | **no — gitignored** |
| `requirements.txt` | Pinned libraries | yes |

The binary is deliberately **not committed** (per the workspace rule that model
weights are not committed without approval). The artifact is still *versioned*
and *verifiable*: `model_card.json` pins its exact SHA-256, and `export_model.py`
regenerates a bit-reproducible binary from the same data and seed. To put the
binary in the repo or attach it as a release asset instead, that is a one-line
change to `.gitignore` — ask.

## Reproduce

```bash
pip install -r requirements.txt
DATA_DIR=/path/to/ieee_cis_fraud python3 export_model.py
```

The producer refuses to run on missing or empty data — it trains on real data or
not at all. It prints the metrics, writes the card, and verifies that the saved
model reloads to bit-identical predictions.

## Current version

`fraud-ieee-cis v1.0.0` — HistGradientBoosting, temporal 80/20 split, seed 42.
See [`MODEL_CARD.md`](MODEL_CARD.md) for the measured ROC-AUC, AUPRC,
precision@k, Brier, and full provenance (dataset checksum, library versions,
git commit).
