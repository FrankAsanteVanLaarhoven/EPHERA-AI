"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CountryTerms,
  Institution,
  ProviderApplication,
  RegulatoryRequirement,
  SwiftMessage,
} from "@ephera/connect-layer";

type Tab = "register" | "compliance" | "terms" | "openbanking" | "swift" | "status";

const DOC_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "licence",
  "aml_policy",
  "kyc_policy",
  "data_protection",
  "incident_response",
  "insurance",
  "pci_attestation",
  "central_bank_approval",
  "other",
] as const;

export function ProviderShell() {
  const [tab, setTab] = useState<Tab>("register");
  const [toast, setToast] = useState<string | null>(null);
  const [apps, setApps] = useState<ProviderApplication[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [requirements, setRequirements] = useState<RegulatoryRequirement[]>([]);
  const [terms, setTerms] = useState<CountryTerms[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [swiftDir, setSwiftDir] = useState<
    { bic: string; name: string; country: string; status: string; connectivity: string }[]
  >([]);
  const [swiftMsgs, setSwiftMsgs] = useState<SwiftMessage[]>([]);

  const [form, setForm] = useState({
    legalName: "",
    tradingName: "",
    category: "merchant",
    primaryCountry: "GH",
    registrationNumber: "",
    taxId: "",
    website: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    servicesOffered: "checkout, invoices",
    description: "",
    wantsOpenBanking: true,
    wantsSwift: false,
    mtlsReady: false,
    webhookUrl: "",
  });

  const [docForm, setDocForm] = useState({
    type: "terms_and_conditions" as (typeof DOC_TYPES)[number],
    title: "",
    fileName: "",
    version: "1.0",
  });

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const loadApps = useCallback(async () => {
    const r = await fetch("/api/applications");
    const j = await r.json();
    setApps(j.items || []);
    if (!activeId && j.items?.[0]?.id) setActiveId(j.items[0].id);
  }, [activeId]);

  const loadCatalog = useCallback(async () => {
    const r = await fetch(
      `/api/catalog?country=${encodeURIComponent(form.primaryCountry)}&category=${encodeURIComponent(form.category)}`,
    );
    const j = await r.json();
    setRequirements(j.requirements || []);
    setTerms(j.terms || []);
  }, [form.primaryCountry, form.category]);

  const loadOb = useCallback(async () => {
    const r = await fetch(`/api/open-banking?country=${form.primaryCountry}`);
    const j = await r.json();
    setInstitutions(j.institutions || []);
  }, [form.primaryCountry]);

  const loadSwift = useCallback(async () => {
    const r = await fetch("/api/swift");
    const j = await r.json();
    setSwiftDir(j.directory || []);
    setSwiftMsgs(j.messages || []);
  }, []);

  useEffect(() => {
    void loadApps();
    void loadCatalog();
    void loadOb();
    void loadSwift();
  }, [loadApps, loadCatalog, loadOb, loadSwift]);

  const active = useMemo(() => apps.find((a) => a.id === activeId) || null, [apps, activeId]);

  async function register() {
    if (!form.legalName || !form.contactEmail || !form.contactName) {
      flash("Legal name, contact name, and email are required");
      return;
    }
    const r = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        legalName: form.legalName,
        tradingName: form.tradingName || form.legalName,
        category: form.category,
        primaryCountry: form.primaryCountry,
        countries: [form.primaryCountry],
        registrationNumber: form.registrationNumber,
        taxId: form.taxId,
        website: form.website,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        servicesOffered: form.servicesOffered.split(",").map((s) => s.trim()).filter(Boolean),
        description: form.description,
        security: {
          wantsOpenBanking: form.wantsOpenBanking,
          wantsSwift: form.wantsSwift,
          mtlsReady: form.mtlsReady,
          webhookUrl: form.webhookUrl || undefined,
          ipAllowlist: [],
        },
      }),
    });
    const app = await r.json();
    if (!r.ok) {
      flash(app.error || "Registration failed");
      return;
    }
    flash(`Application created · ${app.id}`);
    setActiveId(app.id);
    setTab("compliance");
    void loadApps();
  }

  async function uploadDoc() {
    if (!activeId) {
      flash("Select or create an application first");
      return;
    }
    if (!docForm.title || !docForm.fileName) {
      flash("Document title and file name required");
      return;
    }
    const r = await fetch("/api/compliance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: activeId,
        type: docForm.type,
        title: docForm.title,
        fileName: docForm.fileName,
        version: docForm.version,
        jurisdiction: active?.primaryCountry || form.primaryCountry,
      }),
    });
    if (r.ok) {
      flash("Compliance document submitted for Super Admin review");
      setDocForm((d) => ({ ...d, title: "", fileName: "" }));
      void loadApps();
    }
  }

  async function acceptTerm(termId: string, country: string) {
    if (!activeId) return;
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activeId, action: "accept_terms", termId, country }),
    });
    flash(`Accepted ${termId}`);
    void loadApps();
  }

  async function submitApp() {
    if (!activeId) return;
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activeId, action: "submit" }),
    });
    flash("Submitted to Super Admin compliance queue");
    void loadApps();
  }

  async function linkInstitution(institutionId: string) {
    if (!activeId) {
      flash("Create application first");
      return;
    }
    await fetch("/api/open-banking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "link_token",
        applicationId: activeId,
        countryCodes: [form.primaryCountry],
      }),
    });
    const r = await fetch("/api/open-banking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "exchange",
        applicationId: activeId,
        institutionId,
      }),
    });
    const conn = await r.json();
    flash(`Open banking connected · ${conn.accounts?.length || 0} accounts`);
    void loadApps();
  }

  async function verifyName() {
    const r = await fetch("/api/open-banking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "verify_name",
        accountNumber: "0123456789",
        sortOrBankCode: "040",
        expectedName: form.legalName || "Demo Merchant",
      }),
    });
    const j = await r.json();
    flash(`Name enquiry · match=${j.match} score=${j.providerScore}`);
  }

  async function queueSwift() {
    if (!activeId) return;
    const r = await fetch("/api/swift", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: activeId,
        type: "pacs.008",
        senderBic: "EPHRGHAC",
        receiverBic: "ECOCGHAC",
        currency: "USD",
        amountMinor: 25000,
        purpose: "Sandbox correspondent credit",
      }),
    });
    const msg = await r.json();
    flash(`SWIFT message queued · UETR ${msg.uetr}`);
    void loadSwift();
    void loadApps();
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="brand-row">
          <div className="mark">EPH</div>
          <div>
            <h1>Provider Portal</h1>
            <p>
              Register merchants, mobile money, banks, utilities, and fintechs. Submit country
              regulatory packs, accept T&amp;Cs, and enable open banking / SWIFT layers under Super
              Admin monitoring.
            </p>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <a className="btn ghost" href="http://localhost:3007" target="_blank" rel="noreferrer">
            Super Admin
          </a>
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <div className="tabs">
        {(
          [
            ["register", "1 · Register"],
            ["compliance", "2 · Compliance docs"],
            ["terms", "3 · Terms & regulations"],
            ["openbanking", "4 · Open banking"],
            ["swift", "5 · SWIFT"],
            ["status", "Status"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "register" && (
        <div className="grid two">
          <div className="card">
            <h3>Provider registration</h3>
            <p className="lede">
              All fields feed Super Admin monitoring. Production requires licensed entities only.
            </p>
            <div className="form">
              <div className="form row">
                <label>
                  Legal name
                  <input
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  />
                </label>
                <label>
                  Trading name
                  <input
                    value={form.tradingName}
                    onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
                  />
                </label>
              </div>
              <div className="form row">
                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="merchant">Merchant</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="bank">Bank</option>
                    <option value="utility">Utility</option>
                    <option value="telecom">Telecom</option>
                    <option value="open_banking">Open banking TPP</option>
                    <option value="card_acquirer">Card acquirer</option>
                    <option value="fx">FX</option>
                    <option value="swift_correspondent">SWIFT correspondent</option>
                    <option value="fintech">Fintech</option>
                  </select>
                </label>
                <label>
                  Primary country
                  <select
                    value={form.primaryCountry}
                    onChange={(e) => setForm({ ...form, primaryCountry: e.target.value })}
                  >
                    <option value="GH">Ghana (GH)</option>
                    <option value="NG">Nigeria (NG)</option>
                    <option value="KE">Kenya (KE)</option>
                    <option value="ZA">South Africa (ZA)</option>
                    <option value="RW">Rwanda (RW)</option>
                  </select>
                </label>
              </div>
              <div className="form row">
                <label>
                  Registration number
                  <input
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  />
                </label>
                <label>
                  Tax ID
                  <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                </label>
              </div>
              <div className="form row">
                <label>
                  Contact name
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </label>
                <label>
                  Contact email
                  <input
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Services offered (comma-separated)
                <input
                  value={form.servicesOffered}
                  onChange={(e) => setForm({ ...form, servicesOffered: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="check">
                <input
                  type="checkbox"
                  checked={form.wantsOpenBanking}
                  onChange={(e) => setForm({ ...form, wantsOpenBanking: e.target.checked })}
                />
                <div>
                  <strong>Enable open banking layer</strong>
                  <div className="msg">Plaid-like AIS/PIS, account verify, consent security</div>
                </div>
              </div>
              <div className="check">
                <input
                  type="checkbox"
                  checked={form.wantsSwift}
                  onChange={(e) => setForm({ ...form, wantsSwift: e.target.checked })}
                />
                <div>
                  <strong>Enable SWIFT / cross-border (future scale)</strong>
                  <div className="msg">ISO 20022 pacs / MT messaging with dual control</div>
                </div>
              </div>
              <div className="check">
                <input
                  type="checkbox"
                  checked={form.mtlsReady}
                  onChange={(e) => setForm({ ...form, mtlsReady: e.target.checked })}
                />
                <div>
                  <strong>mTLS certificates ready</strong>
                  <div className="msg">Required for production open banking & SWIFT</div>
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => void register()}>
                  Create application
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Regulatory criteria · {form.primaryCountry} / {form.category}</h3>
            <p className="lede">Mandatory packs for your country and category (sandbox summaries).</p>
            {requirements.map((r) => (
              <div key={r.id} className="req-card">
                <strong>
                  {r.title}{" "}
                  {r.mandatory ? <span className="tag err">mandatory</span> : <span className="tag info">optional</span>}
                </strong>
                <div className="msg">{r.authority}</div>
                <div className="msg">{r.description}</div>
                <div className="msg mono" style={{ marginTop: 6 }}>
                  Docs: {r.requiredDocs.join(" · ")}
                </div>
              </div>
            ))}
            {!requirements.length && <p className="msg">No mapped requirements for this pair.</p>}
          </div>
        </div>
      )}

      {tab === "compliance" && (
        <div className="grid two">
          <div className="card">
            <h3>Submit compliance documents</h3>
            <p className="lede">
              Upload references for T&amp;Cs, licences, AML/KYC, data protection — reviewed in Super
              Admin.
            </p>
            <label>
              Active application
              <select value={activeId} onChange={(e) => setActiveId(e.target.value)}>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.tradingName} · {a.status}
                  </option>
                ))}
              </select>
            </label>
            <div className="form" style={{ marginTop: 12 }}>
              <label>
                Document type
                <select
                  value={docForm.type}
                  onChange={(e) =>
                    setDocForm({ ...docForm, type: e.target.value as (typeof DOC_TYPES)[number] })
                  }
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                />
              </label>
              <label>
                File name (sandbox reference)
                <input
                  value={docForm.fileName}
                  onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })}
                  placeholder="aml-policy-v3.pdf"
                />
              </label>
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => void uploadDoc()}>
                  Submit document
                </button>
                <button type="button" className="btn" onClick={() => void submitApp()}>
                  Send full app to Super Admin
                </button>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Documents on file</h3>
            {!active && <p className="msg">No application selected.</p>}
            {active && (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {active.documents.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">{d.type}</td>
                      <td>
                        {d.title}
                        <div className="msg">{d.fileName}</div>
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            d.status === "approved" ? "ok" : d.status === "rejected" ? "err" : "warn"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!active.documents.length && (
                    <tr>
                      <td colSpan={3} className="msg">
                        No documents yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "terms" && (
        <div className="grid two">
          {terms
            .filter(
              (t) =>
                t.country === "MULTI" ||
                t.country === (active?.primaryCountry || form.primaryCountry),
            )
            .map((t) => (
              <div key={t.id} className="card">
                <h3>
                  {t.title} · v{t.version}
                </h3>
                <p className="lede">
                  {t.authority} · {t.summary}
                </p>
                <div className="terms-box">{t.body}</div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => void acceptTerm(t.id, t.country)}
                    disabled={!activeId}
                  >
                    Accept for application
                  </button>
                </div>
                {active?.acceptedCountryTerms.some((a) => a.termId === t.id) && (
                  <p className="msg" style={{ marginTop: 8 }}>
                    ✓ Accepted
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      {tab === "openbanking" && (
        <div className="grid two">
          <div className="card">
            <h3>Open banking layer (Plaid-style)</h3>
            <p className="lede">
              Link institutions, AIS/PIS products, account name verification. Security: OAuth2+PKCE,
              mTLS, HMAC webhooks, short-lived tokens.
            </p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => void verifyName()}>
                Run name enquiry (sandbox)
              </button>
            </div>
            <table style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Country</th>
                  <th>Products</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.name}</strong>
                      <div className="mono msg">{i.id}</div>
                    </td>
                    <td>{i.country}</td>
                    <td className="msg">{i.products.join(", ")}</td>
                    <td>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => void linkInstitution(i.id)}
                      >
                        Link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Security controls</h3>
            <div className="req-card">
              <strong>OAuth2 + PKCE</strong>
              <div className="msg">Consent sessions for AIS/PIS; no long-lived browser secrets.</div>
            </div>
            <div className="req-card">
              <strong>mTLS</strong>
              <div className="msg">Mutual TLS for TPP ↔ bank / EPHERA gateway in production.</div>
            </div>
            <div className="req-card">
              <strong>Webhook HMAC + replay window</strong>
              <div className="msg">Signed callbacks; 300s skew protection in connect-layer.</div>
            </div>
            <div className="req-card">
              <strong>Envelope PII encryption</strong>
              <div className="msg">Account holder data encrypted at rest (policy flag).</div>
            </div>
            {active?.openBanking && (
              <p className="msg">
                Link tokens issued: {active.openBanking.linkTokensIssued} · Connections:{" "}
                {active.openBanking.connections}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "swift" && (
        <div className="grid two">
          <div className="card">
            <h3>SWIFT / ISO 20022 layer</h3>
            <p className="lede">
              Future-scale cross-border. Sandbox queues pacs.008 / MT103 with UETR, signed &
              encrypted flags, dual control for high value.
            </p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => void queueSwift()}>
                Queue sandbox pacs.008
              </button>
            </div>
            <table style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>BIC</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {swiftDir.map((b) => (
                  <tr key={b.bic}>
                    <td className="mono">{b.bic}</td>
                    <td>
                      {b.name}
                      <div className="msg">{b.connectivity}</div>
                    </td>
                    <td>
                      <span className={`tag ${b.status === "sandbox" ? "ok" : "warn"}`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Queued messages</h3>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>UETR</th>
                  <th>Status</th>
                  <th>Security</th>
                </tr>
              </thead>
              <tbody>
                {swiftMsgs.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.type}</td>
                    <td className="mono msg">{m.uetr}</td>
                    <td>
                      <span className="tag info">{m.status}</span>
                    </td>
                    <td className="msg">
                      {m.security.signed ? "signed " : ""}
                      {m.security.encrypted ? "encrypted " : ""}
                      {m.security.dualControl ? "dual-control" : ""}
                    </td>
                  </tr>
                ))}
                {!swiftMsgs.length && (
                  <tr>
                    <td colSpan={4} className="msg">
                      No SWIFT messages yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "status" && (
        <div className="card">
          <h3>Applications · Super Admin visibility</h3>
          <p className="lede">
            These applications appear in Super Admin → Providers &amp; compliance for approval,
            document review, and rail enablement.
          </p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Category</th>
                <th>Country</th>
                <th>Status</th>
                <th>Docs</th>
                <th>Layers</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.tradingName}</strong>
                    <div className="msg mono">{a.id}</div>
                  </td>
                  <td>{a.category}</td>
                  <td>{a.primaryCountry}</td>
                  <td>
                    <span
                      className={`tag ${
                        a.status === "approved" ? "ok" : a.status === "rejected" ? "err" : "warn"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td>{a.documents.length}</td>
                  <td className="msg">
                    {a.security.wantsOpenBanking ? "OB " : ""}
                    {a.security.wantsSwift ? "SWIFT " : ""}
                    {a.security.mtlsReady ? "mTLS" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="footer">
        EPHERA Provider Portal · sandbox · regulatory text is illustrative, not legal advice ·
        Super Admin monitors all applications at :3007
      </p>
    </div>
  );
}
