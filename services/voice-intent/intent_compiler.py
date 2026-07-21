"""Rule-based intent compiler for sandbox. Proposes PaymentIntent only — never authorises."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

AMOUNT_PATTERN = re.compile(
    r"(?P<amount>\d+(?:[.,]\d+)?)\s*(?P<unit>cedis?|ghs|pounds?|gbp|GBP)?",
    re.IGNORECASE,
)
SEND_PATTERN = re.compile(
    r"\b(send|transfer|pay)\b.+\bto\b\s+(?P<name>[A-Za-z][A-Za-z\s'-]{0,40})",
    re.IGNORECASE,
)
FREEZE_PATTERN = re.compile(r"\b(freeze|lock)\b.+\b(wallet|account)\b", re.IGNORECASE)
BALANCE_PATTERN = re.compile(r"\b(balance|how much)\b", re.IGNORECASE)
AIRTIME_PATTERN = re.compile(r"\b(airtime|data|gigabytes?|gb)\b", re.IGNORECASE)
HELP_PATTERN = re.compile(r"\b(help|what can you do)\b", re.IGNORECASE)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_minor(amount: float, currency: str) -> int:
    return int(round(amount * 100))


def compile_text(utterance: str, language: str = "en") -> dict[str, Any]:
    text = utterance.strip()
    lower = text.lower()

    if FREEZE_PATTERN.search(lower):
        return {
            "id": f"intent_{uuid.uuid4().hex[:12]}",
            "name": "freeze_wallet",
            "language": language,
            "confidence": 0.93,
            "rawUtterance": text,
            "createdAt": _now(),
            "riskClass": "critical",
        }

    if HELP_PATTERN.search(lower):
        return {
            "id": f"intent_{uuid.uuid4().hex[:12]}",
            "name": "help",
            "language": language,
            "confidence": 0.99,
            "rawUtterance": text,
            "createdAt": _now(),
            "riskClass": "low",
        }

    if BALANCE_PATTERN.search(lower) and "send" not in lower:
        return {
            "id": f"intent_{uuid.uuid4().hex[:12]}",
            "name": "check_balance",
            "language": language,
            "confidence": 0.9,
            "rawUtterance": text,
            "createdAt": _now(),
            "riskClass": "low",
        }

    if AIRTIME_PATTERN.search(lower):
        amount_minor = 1000
        currency = "GHS"
        m = AMOUNT_PATTERN.search(text)
        if m:
            raw = m.group("amount").replace(",", ".")
            unit = (m.group("unit") or "GHS").lower()
            currency = "GBP" if unit in {"pound", "pounds", "gbp"} else "GHS"
            amount_minor = _to_minor(float(raw), currency)
        return {
            "id": f"intent_{uuid.uuid4().hex[:12]}",
            "name": "buy_airtime",
            "language": language,
            "confidence": 0.88,
            "amount": {"amountMinor": amount_minor, "currency": currency},
            "rawUtterance": text,
            "createdAt": _now(),
            "riskClass": "medium",
        }

    send = SEND_PATTERN.search(text)
    if send or ("send" in lower and AMOUNT_PATTERN.search(text)):
        name = send.group("name").strip() if send else "Unknown"
        name = re.sub(r"[.?!,]+$", "", name).strip()
        amount_minor = 0
        currency = "GHS"
        conf = 0.55
        m = AMOUNT_PATTERN.search(text)
        if m:
            raw = m.group("amount").replace(",", ".")
            unit = (m.group("unit") or "").lower()
            if unit in {"pound", "pounds", "gbp"}:
                currency = "GBP"
            else:
                currency = "GHS"
            amount_minor = _to_minor(float(raw), currency)
            conf = 0.92 if name.lower() != "unknown" else 0.7
        else:
            conf = 0.45

        known = {"ama", "ama mensah", "akosua", "kofi"}
        return {
            "id": f"intent_{uuid.uuid4().hex[:12]}",
            "name": "send_money",
            "language": language,
            "confidence": conf,
            "amount": {"amountMinor": amount_minor, "currency": currency}
            if amount_minor
            else None,
            "recipient": {
                "displayName": name,
                "verified": name.lower() in {"ama", "ama mensah", "akosua"},
                "accountHint": "wallet ending 4281"
                if name.lower().startswith("ama")
                else None,
                "isNew": name.lower() not in known,
            },
            "rawUtterance": text,
            "createdAt": _now(),
            "riskClass": "high"
            if name.lower() not in {"ama", "ama mensah"}
            else "medium",
        }

    return {
        "id": f"intent_{uuid.uuid4().hex[:12]}",
        "name": "help",
        "language": language,
        "confidence": 0.35,
        "rawUtterance": text,
        "createdAt": _now(),
        "riskClass": "low",
        "clarification": "I did not understand. Try: Send 50 cedis to Ama.",
    }


def needs_clarification(intent: dict[str, Any]) -> bool:
    if intent.get("confidence", 0) < 0.75:
        return True
    if intent.get("name") == "send_money":
        if not intent.get("amount") or not intent.get("recipient", {}).get("displayName"):
            return True
    return False
