"use client";

import { useState } from "react";
import { EpheraPaymentClient } from "@ephera/payment-sdk";

const client = new EpheraPaymentClient({ baseUrl: "http://localhost:3005" });

export default function MerchantHome() {
  const [amount, setAmount] = useState("30000");
  const [description, setDescription] = useState("20 bags of maize @ 300 GHS");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createLink() {
    setBusy(true);
    try {
      const amountMinor = Number.parseInt(amount, 10);
      const result = await client.createPaymentLink({
        amountMinor,
        currency: "GHS",
        description,
      });
      setLink(result.url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <span className="badge">SANDBOX · NO LIVE FUNDS</span>
      <h1 style={{ marginTop: 16 }}>EPHERA Business</h1>
      <p className="muted">
        Create payment links and checkouts. Voice-generated merchant checkout arrives in Gate 2.
        High-risk settlement remains server-authoritative.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create payment link</h2>
        <label>
          Amount (minor units, GHS pesewas)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={createLink} disabled={busy}>
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>
        {link ? (
          <p style={{ marginTop: 16 }}>
            Link: <a href={link}>{link}</a>
          </p>
        ) : null}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Product rule</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          The merchant speaks or fills a form. EPHERA generates the instrument. The customer sees
          cost and consequence. Money moves only after cryptographic authorisation, policy approval
          and independent verification.
        </p>
      </div>
    </main>
  );
}
