#!/usr/bin/env python3
"""Load the versioned fraud artifact and score rows — advisory only.

This loader exists so the saved artifact is *usable*, not just persisted. It
verifies the artifact's SHA-256 against the model card before trusting it, so a
tampered or truncated binary is refused rather than silently scored.

BOUNDARY: the score is advisory. It proposes attention, it authorises nothing.
Nothing here is on the money path (see README.md).

    from predict import load_scorer
    score = load_scorer()            # verifies checksum, returns a callable
    p = score({"TransactionAmt": 250.0, "ProductCD": "W", "card1": 13926, ...})
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Callable, Mapping

import joblib
import numpy as np

HERE = Path(__file__).resolve().parent
ARTIFACTS = HERE / "artifacts"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_scorer(version: str = "1.0.0") -> Callable[[Mapping[str, object]], float]:
    """Return a callable mapping a row dict to a fraud-risk score in [0, 1].

    The artifact is checksum-verified against model_card.json before use.
    """
    card = json.loads((ARTIFACTS / "model_card.json").read_text())
    art_path = ARTIFACTS / card["artifact_file"]
    if not art_path.exists():
        raise FileNotFoundError(
            f"artifact {art_path.name} not found — run export_model.py to produce it"
        )
    actual = _sha256(art_path)
    if actual != card["artifact_sha256"]:
        raise ValueError(
            f"artifact checksum mismatch: card says {card['artifact_sha256'][:16]}…, "
            f"file is {actual[:16]}… — refusing to load a possibly-tampered model"
        )

    a = joblib.load(art_path)
    model = a["model"]
    feature_cols: list[str] = a["feature_cols"]
    numeric: list[str] = a["numeric"]
    cat_maps: dict[str, dict[str, int]] = a["cat_maps"]

    def score(row: Mapping[str, object]) -> float:
        vec = []
        for c in feature_cols:
            if c in numeric:
                v = row.get(c)
                vec.append(float(v) if v is not None else np.nan)
            else:  # categorical: train-fit ordinal map, unseen -> -1
                vec.append(float(cat_maps[c].get(row.get(c), -1)))
        x = np.asarray(vec, dtype="float32").reshape(1, -1)
        return float(model.predict_proba(x)[0, 1])

    return score


if __name__ == "__main__":
    s = load_scorer()
    demo = {"TransactionAmt": 250.0, "ProductCD": "W", "card1": 13926,
            "card4": "visa", "card6": "debit", "C1": 1, "D1": 14}
    print(f"advisory fraud-risk score = {s(demo):.4f}  (proposes attention, "
          "authorises nothing)")
