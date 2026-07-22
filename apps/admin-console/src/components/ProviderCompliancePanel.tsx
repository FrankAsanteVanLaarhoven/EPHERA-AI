"use client";

import { useCallback, useEffect, useState } from "react";

type Doc = {
  id: string;
  type: string;
  title: string;
  status: string;
  fileName: string;
  jurisdiction: string;
};

type App = {
  id: string;
  legalName: string;
  tradingName: string;
  category: string;
  primaryCountry: string;
  status: string;
  contactEmail: string;
  documents: Doc[];
  security: {
    wantsOpenBanking: boolean;
    wantsSwift: boolean;
    mtlsReady: boolean;
  };
  openBanking?: { linkTokensIssued: number; connections: number };
  swift?: { bic?: string; messagesQueued: number };
  adminNotes: string[];
  acceptedCountryTerms: { country: string; termId: string }[];
};

export function ProviderCompliancePanel({ flash }: { flash: (m: string) => void }) {
  const [connected, setConnected] = useState(false);
  const [portalUrl, setPortalUrl] = useState("http://localhost:3008");
  const [items, setItems] = useState<App[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<App | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/provider-registry");
    const j = await r.json();
    setConnected(!!j.connected);
    setPortalUrl(j.portalUrl || "http://localhost:3008");
    setItems(j.items || []);
    setSummary(j.summary || null);
    if (j.items?.[0]) setSelected((s) => s || j.items[0]);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(id: string, status: string) {
    const r = await fetch("/api/provider-registry", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "set_status",
        applicationId: id,
        status,
        note: `Super Admin set status to ${status}`,
      }),
    });
    const j = await r.json();
    // The approval response used to carry the raw payments:write secret, which
    // was then rendered into this toast and written to logs (D-09). Credentials
    // are no longer minted by an approval and no secret crosses this boundary.
    void load();
  }

  async function reviewDoc(appId: string, documentId: string, docStatus: string) {
    await fetch("/api/provider-registry", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "review_doc",
        applicationId: appId,
        documentId,
        docStatus,
        note: `Reviewed ${docStatus}`,
      }),
    });
    flash(`Document ${docStatus}`);
    void load();
  }

  return (
    <div className="stack-lg">
      <div className="card glass-hero">
        <div className="row-between">
          <div>
            <h3 className="section-title">Provider registry · compliance monitoring</h3>
            <p className="lede">
              Merchants, MMOs, banks, utilities register via Provider Portal. Super Admin reviews
              licences, T&amp;Cs, AML packs, open banking and SWIFT readiness — all country
              regulations enforced at onboarding.
            </p>
          </div>
          <div className="actions">
            <span className={`pill ${connected ? "on" : "off"}`}>
              Portal {connected ? "UP" : "DOWN"}
            </span>
            <a className="btn" href={portalUrl} target="_blank" rel="noreferrer">
              Open Provider Portal
            </a>
            <button type="button" className="btn ghost" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
        {summary && (
          <div className="grid kpis" style={{ marginTop: 14 }}>
            <div className="card">
              <div className="kpi-val">{String((summary as { total?: number }).total ?? 0)}</div>
              <div className="kpi-label">Applications</div>
            </div>
            <div className="card">
              <div className="kpi-val">{String((summary as { pendingDocs?: number }).pendingDocs ?? 0)}</div>
              <div className="kpi-label">Docs pending review</div>
            </div>
            <div className="card">
              <div className="kpi-val">
                {String((summary as { openBankingOptIn?: number }).openBankingOptIn ?? 0)}
              </div>
              <div className="kpi-label">Open banking opt-in</div>
            </div>
            <div className="card">
              <div className="kpi-val">{String((summary as { swiftOptIn?: number }).swiftOptIn ?? 0)}</div>
              <div className="kpi-label">SWIFT opt-in</div>
            </div>
          </div>
        )}
        {!connected && (
          <p className="msg" style={{ marginTop: 10 }}>
            Start portal: <span className="mono">npm run dev:provider</span> → {portalUrl}
          </p>
        )}
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Applications</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Category</th>
                  <th>CC</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.tradingName}</strong>
                      <div className="msg mono">{a.id}</div>
                    </td>
                    <td>{a.category}</td>
                    <td>{a.primaryCountry}</td>
                    <td>
                      <span className={`tag ${a.status === "approved" ? "active" : "warn"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn ghost" onClick={() => setSelected(a)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={5} className="msg">
                      No applications — providers register at the portal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">
            Review {selected ? `· ${selected.tradingName}` : ""}
          </h3>
          {!selected && <p className="lede">Select an application.</p>}
          {selected && (
            <>
              <p className="msg">
                {selected.legalName} · {selected.contactEmail}
                <br />
                OB: {selected.security.wantsOpenBanking ? "yes" : "no"} · SWIFT:{" "}
                {selected.security.wantsSwift ? "yes" : "no"} · mTLS:{" "}
                {selected.security.mtlsReady ? "ready" : "not ready"}
                <br />
                Terms accepted: {selected.acceptedCountryTerms.length}
              </p>
              <div className="actions" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn success"
                  onClick={() => void setStatus(selected.id, "approved")}
                >
                  Approve + issue API key
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void setStatus(selected.id, "security_review")}
                >
                  Security review
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void setStatus(selected.id, "compliance_review")}
                >
                  Compliance review
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => void setStatus(selected.id, "rejected")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void setStatus(selected.id, "suspended")}
                >
                  Suspend
                </button>
              </div>
              <h3 className="section-title">Documents</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.documents.map((d) => (
                      <tr key={d.id}>
                        <td className="mono">{d.type}</td>
                        <td>
                          {d.title}
                          <div className="msg">{d.fileName}</div>
                        </td>
                        <td>
                          <span className={`tag ${d.status === "approved" ? "active" : "warn"}`}>
                            {d.status}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="btn success"
                              onClick={() => void reviewDoc(selected.id, d.id, "approved")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn danger"
                              onClick={() => void reviewDoc(selected.id, d.id, "rejected")}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!selected.documents.length && (
                      <tr>
                        <td colSpan={4} className="msg">
                          No documents submitted
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {selected.adminNotes?.length > 0 && (
                <>
                  <h3 className="section-title" style={{ marginTop: 14 }}>
                    Notes
                  </h3>
                  <ul className="msg">
                    {selected.adminNotes.map((n, i) => (
                      <li key={`${i}-${n.slice(0, 12)}`}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Connector security layers (platform standard)</h3>
        <div className="grid three">
          <div className="req-like">
            <strong>Open banking</strong>
            <p className="msg">
              OAuth2+PKCE, mTLS, account verify, AIS/PIS, HMAC webhooks — Plaid-style abstraction in
              @ephera/connect-layer
            </p>
          </div>
          <div>
            <strong>SWIFT / ISO 20022</strong>
            <p className="msg">
              pacs.008 / MT103 sandbox, UETR tracking, signed+encrypted, dual control for high value
            </p>
          </div>
          <div>
            <strong>Provider API</strong>
            <p className="msg">
              API keys issued on approval, fingerprint stored only, IP allowlist + webhook URL on
              application
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
