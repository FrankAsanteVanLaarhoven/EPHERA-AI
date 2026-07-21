# First 20 supported intents (Phase 0 corpus)

Pilot framing (sandbox default): **Ghana** — English + Twi placeholders, currency **GHS**.

| # | Intent | Example utterance | Policy class |
| --- | --- | --- | --- |
| 1 | send_money | Send 50 cedis to Ama | step-up passkey |
| 2 | request_money | Request 20 cedis from Kofi | confirm |
| 3 | check_balance | How much money do I have? | low |
| 4 | list_transactions | Show my last five transfers | low |
| 5 | pay_bill | Pay my electricity bill | step-up |
| 6 | buy_airtime | Buy five gigabytes of data | step-up |
| 7 | freeze_wallet | Freeze my wallet. Phone stolen | step-up + urgent |
| 8 | unfreeze_wallet | Unfreeze my wallet | strong step-up |
| 9 | add_recipient | Save Ama's number as Mum | step-up |
| 10 | quote_domestic | Cheapest way to send 100 cedis | low |
| 11 | quote_cross_border | Cheapest safe way to send £200 to Ghana | low |
| 12 | create_payment_link | Create a payment link for 30 uniforms | merchant |
| 13 | create_merchant_checkout | Checkout for twenty bags of maize | merchant |
| 14 | move_to_savings | Move 50 pounds into emergency savings | step-up |
| 15 | read_fee_breakdown | Read the fee breakdown | low |
| 16 | change_amount | Change the amount to 200 | in-panel |
| 17 | cancel_intent | Cancel | low |
| 18 | dispute_transfer | Dispute the last transfer | step-up |
| 19 | help | What can you do? | low |
| 20 | delete_voice_recording | Delete the recording of this conversation | confirm |

Recording corpora and evaluation sets will live under `tests/` in Gate 1.
