from intent_compiler import compile_text, needs_clarification


def test_send_ama():
    intent = compile_text("Send 50 cedis to Ama")
    assert intent["name"] == "send_money"
    assert intent["amount"]["amountMinor"] == 5000
    assert intent["amount"]["currency"] == "GHS"
    assert intent["recipient"]["displayName"].lower().startswith("ama")
    assert intent["confidence"] >= 0.75
    assert not needs_clarification(intent)


def test_low_confidence_without_amount():
    intent = compile_text("Send money to someone")
    assert needs_clarification(intent)


def test_freeze():
    intent = compile_text("Freeze my wallet. I think my phone has been stolen.")
    assert intent["name"] == "freeze_wallet"


def test_never_authorises():
    # Module has no authorise function by design; compile only proposes.
    intent = compile_text("Send 50 cedis to Ama")
    assert "authorisation" not in intent
