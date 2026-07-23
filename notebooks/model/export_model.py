#!/usr/bin/env python3
"""Train and persist the IEEE-CIS fraud model as a versioned artifact.

This is a RESEARCH / METHODOLOGY artifact. It is advisory only and is NOT wired
into any service on the money path. See README.md for the boundary.

What it does, deterministically:

  1. Loads the IEEE-CIS Fraud Detection transaction data (real, public).
  2. Splits it TEMPORALLY — trains on the earliest transactions, tests on the
     latest — so no future information leaks into training. All encoding is fit
     on the training split only.
  3. Trains a HistGradientBoosting classifier with a fixed seed.
  4. Evaluates on the held-out later window: ROC-AUC, AUPRC, precision@1%, Brier.
  5. Saves a versioned artifact (joblib) and records its SHA-256.
  6. Reloads the artifact and asserts predictions are bit-identical — a saved
     model that does not reload to the same predictions is not a saved model.
  7. Writes model_card.json (machine-readable) and MODEL_CARD.md (human) with the
     REAL metrics produced by this run, plus full provenance.

Run:
    python3 export_model.py                      # defaults below
    DATA_DIR=/path/to/ieee_cis_fraud python3 export_model.py

Everything about the run — seed, feature list, split point, dataset fingerprint,
library versions, git commit — is written into the card so the artifact is
reproducible and its lineage is checkable.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)

# ---- configuration (all overridable by environment) -------------------------

VERSION = os.environ.get("MODEL_VERSION", "1.0.0")
SEED = int(os.environ.get("SEED", "42"))
DATA_DIR = Path(
    os.environ.get(
        "DATA_DIR", "/home/favl/cashaegis-control-plane/data/raw/ieee_cis_fraud"
    )
)
HERE = Path(__file__).resolve().parent
OUT_DIR = Path(os.environ.get("OUT_DIR", str(HERE / "artifacts")))
TRAIN_FRACTION = float(os.environ.get("TRAIN_FRACTION", "0.80"))
MAX_ITER = int(os.environ.get("MAX_ITER", "300"))

MODEL_NAME = "fraud-ieee-cis"
TARGET = "isFraud"
TIME_COL = "TransactionDT"

# The "light+" feature set: an honest, small, inspectable set. No V1..V339 block
# (opaque provenance), no identity join. Categorical strings are ordinal-encoded
# on the training split only; unseen categories map to -1.
NUMERIC = (
    ["TransactionAmt", "card1", "card2", "card3", "card5", "addr1", "addr2",
     "dist1", "dist2"]
    + [f"C{i}" for i in range(1, 15)]
    + [f"D{i}" for i in range(1, 16)]
)
CATEGORICAL = ["ProductCD", "card4", "card6"]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(HERE), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return "unknown"


def precision_at_k(y_true: np.ndarray, scores: np.ndarray, k_frac: float) -> float:
    n = max(1, int(len(scores) * k_frac))
    idx = np.argsort(-scores)[:n]
    return float(y_true[idx].mean())


def main() -> int:
    tx_path = DATA_DIR / "train_transaction.csv"
    if not tx_path.exists() or tx_path.stat().st_size == 0:
        sys.stderr.write(
            f"ERROR: dataset not found or empty at {tx_path}\n"
            "This producer trains on REAL data only; it will not fabricate an "
            "artifact. Set DATA_DIR to a directory containing "
            "train_transaction.csv.\n"
        )
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    present = pd.read_csv(tx_path, nrows=0).columns.tolist()
    numeric = [c for c in NUMERIC if c in present]
    categorical = [c for c in CATEGORICAL if c in present]
    usecols = [TARGET, TIME_COL] + numeric + categorical

    print(f"[1/6] loading {tx_path.name} ({len(usecols)} columns)…", flush=True)
    df = pd.read_csv(tx_path, usecols=usecols)
    df = df.sort_values(TIME_COL, kind="mergesort").reset_index(drop=True)

    split = int(len(df) * TRAIN_FRACTION)
    train, test = df.iloc[:split], df.iloc[split:]
    print(
        f"[2/6] temporal split at row {split}: "
        f"train={len(train)} (fraud {train[TARGET].mean():.4f}), "
        f"test={len(test)} (fraud {test[TARGET].mean():.4f})",
        flush=True,
    )

    # Ordinal-encode categoricals on the TRAIN split only. Unseen -> -1.
    cat_maps: dict[str, dict[str, int]] = {}
    feature_cols = list(numeric)
    Xtr = train[numeric].astype("float32").copy()
    Xte = test[numeric].astype("float32").copy()
    for c in categorical:
        cats = {v: i for i, v in enumerate(sorted(train[c].dropna().unique()))}
        cat_maps[c] = cats
        Xtr[c] = train[c].map(cats).fillna(-1).astype("float32")
        Xte[c] = test[c].map(cats).fillna(-1).astype("float32")
        feature_cols.append(c)

    ytr = train[TARGET].to_numpy()
    yte = test[TARGET].to_numpy()

    print(f"[3/6] training HistGradientBoosting (seed={SEED}, max_iter={MAX_ITER})…",
          flush=True)
    model = HistGradientBoostingClassifier(
        max_iter=MAX_ITER,
        learning_rate=0.05,
        max_leaf_nodes=63,
        l2_regularization=1.0,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=SEED,
        class_weight="balanced",
    )
    model.fit(Xtr[feature_cols].to_numpy(), ytr)

    scores = model.predict_proba(Xte[feature_cols].to_numpy())[:, 1]
    metrics = {
        "roc_auc": float(roc_auc_score(yte, scores)),
        "auprc": float(average_precision_score(yte, scores)),
        "precision_at_1pct": precision_at_k(yte, scores, 0.01),
        "precision_at_5pct": precision_at_k(yte, scores, 0.05),
        "brier": float(brier_score_loss(yte, scores)),
        "test_prevalence": float(yte.mean()),
        "n_iter": int(model.n_iter_),
    }
    print("[4/6] test metrics:", json.dumps(metrics, indent=2), flush=True)

    # Persist the artifact: the model plus everything needed to score a row the
    # same way it was trained (feature order, categorical maps).
    artifact = {
        "schema": f"{MODEL_NAME}/1",
        "version": VERSION,
        "model": model,
        "feature_cols": feature_cols,
        "numeric": numeric,
        "categorical": categorical,
        "cat_maps": cat_maps,
        "target": TARGET,
        "sklearn_version": sklearn.__version__,
        "seed": SEED,
    }
    art_path = OUT_DIR / f"{MODEL_NAME}-v{VERSION}.joblib"
    joblib.dump(artifact, art_path, compress=3)
    art_sha = sha256_file(art_path)
    print(f"[5/6] saved {art_path.name} ({art_path.stat().st_size} bytes)",
          flush=True)

    # Round-trip: a saved model must reload to identical predictions.
    reloaded = joblib.load(art_path)
    rscores = reloaded["model"].predict_proba(Xte[feature_cols].to_numpy())[:, 1]
    if not np.allclose(scores, rscores, rtol=0, atol=0):
        sys.stderr.write("ERROR: reloaded model predictions differ from in-memory\n")
        return 3
    print("[6/6] round-trip verified: reloaded predictions are identical",
          flush=True)

    card = {
        "name": MODEL_NAME,
        "version": VERSION,
        "artifact_file": art_path.name,
        "artifact_sha256": art_sha,
        "created_by": "Frank Asante Van Laarhoven",
        "purpose": "Research / methodology proxy for payment-risk scoring. "
        "Advisory only. NOT wired into any money-path service.",
        "model_type": "HistGradientBoostingClassifier",
        "hyperparameters": {
            "max_iter": MAX_ITER,
            "learning_rate": 0.05,
            "max_leaf_nodes": 63,
            "l2_regularization": 1.0,
            "class_weight": "balanced",
            "early_stopping": True,
            "validation_fraction": 0.1,
            "seed": SEED,
        },
        "dataset": {
            "name": "IEEE-CIS Fraud Detection (Kaggle)",
            "source": "kaggle.com/competitions/ieee-fraud-detection",
            "licence": "Kaggle competition rules; research use only",
            "file": tx_path.name,
            "file_sha256": sha256_file(tx_path),
            "rows": int(len(df)),
            "split": "temporal on TransactionDT; "
            f"train earliest {TRAIN_FRACTION:.0%}, test latest "
            f"{1 - TRAIN_FRACTION:.0%}; encoders fit on train only",
        },
        "features": {"numeric": numeric, "categorical": categorical},
        "metrics": metrics,
        "provenance": {
            "sklearn_version": sklearn.__version__,
            "numpy_version": np.__version__,
            "pandas_version": pd.__version__,
            "python_version": sys.version.split()[0],
            "git_commit": git_commit(),
        },
        "boundaries": {
            "intended_use": "research proxy; threshold-recommendation experiments",
            "non_intended_use": "live fraud blocking; production decisioning; "
            "any authorisation on the money path",
            "not_third_party_audited": True,
        },
    }
    (OUT_DIR / "model_card.json").write_text(json.dumps(card, indent=2) + "\n")
    write_markdown_card(HERE / "MODEL_CARD.md", card)
    print(f"\nDone. Artifact v{VERSION}  sha256={art_sha[:16]}…", flush=True)
    print(f"  binary:     {art_path}")
    print(f"  card (json): {OUT_DIR / 'model_card.json'}")
    print(f"  card (md):   {HERE / 'MODEL_CARD.md'}")
    return 0


def write_markdown_card(path: Path, c: dict) -> None:
    m = c["metrics"]
    d = c["dataset"]
    lines = [
        f"# Model Card — {c['name']} v{c['version']}",
        "",
        "> **Advisory research artifact.** A methodology proxy for payment-risk "
        "scoring on a public dataset. It is **not** product performance and is "
        "**not** wired into any money-path service. It authorises nothing.",
        "",
        f"- **Artifact:** `{c['artifact_file']}`",
        f"- **SHA-256:** `{c['artifact_sha256']}`",
        f"- **Author:** {c['created_by']}",
        "",
        "## Data",
        f"- **Dataset:** {d['name']}",
        f"- **Source:** {d['source']}",
        f"- **Licence:** {d['licence']}",
        f"- **Rows:** {d['rows']:,}",
        f"- **File SHA-256:** `{d['file_sha256']}`",
        f"- **Split:** {d['split']}",
        "",
        "## Method",
        f"- **Model:** {c['model_type']}",
        "- **Hyperparameters:** "
        + ", ".join(f"{k}={v}" for k, v in c["hyperparameters"].items()),
        f"- **Numeric features:** {', '.join(c['features']['numeric'])}",
        f"- **Categorical features:** {', '.join(c['features']['categorical'])} "
        "(ordinal-encoded on train only; unseen → −1)",
        "",
        "## Results (held-out latest window)",
        f"- **ROC-AUC:** {m['roc_auc']:.4f}",
        f"- **AUPRC:** {m['auprc']:.4f}",
        f"- **Precision@1%:** {m['precision_at_1pct']:.4f}",
        f"- **Precision@5%:** {m['precision_at_5pct']:.4f}",
        f"- **Brier:** {m['brier']:.4f}",
        f"- **Test prevalence (AUPRC floor):** {m['test_prevalence']:.4f}",
        f"- **Boosting iterations (early-stopped):** {m['n_iter']}",
        "",
        "## Leakage checks",
        "Temporal split precedes all fitting; categorical encoders are train-fit "
        "only, unseen → −1; no V-block, no identity join, no future features.",
        "",
        "## Boundaries",
        f"- **Intended use:** {c['boundaries']['intended_use']}",
        f"- **Non-intended use:** {c['boundaries']['non_intended_use']}",
        "- **Audit status:** self-validated; **not** third-party audited or "
        "certified.",
        "",
        "## Provenance",
        "- "
        + ", ".join(f"{k}={v}" for k, v in c["provenance"].items()),
        "",
    ]
    path.write_text("\n".join(lines))


if __name__ == "__main__":
    raise SystemExit(main())
