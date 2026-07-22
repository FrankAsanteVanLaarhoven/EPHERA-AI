"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { money, pct, platformLabel, shortTime } from "@/lib/format";
import { SecurityPanel } from "@/components/SecurityPanel";
import { WorkflowStudio } from "@/components/WorkflowStudio";
import { ProviderCompliancePanel } from "@/components/ProviderCompliancePanel";
import { ControlPlanePanel } from "./ControlPlanePanel";
import { StaffAccessPanel } from "@/components/StaffAccessPanel";
import type {
  AiModel,
  AiSubscription,
  CommunicationEvent,
  DeviceStat,
  FeatureFlag,
  Mandate,
  Overview,
  Provider,
  RegionVolume,
  TransactionRow,
  UserRow,
  WorkflowEvent,
  AdminAction,
} from "@/lib/types";

type Tab =
  | "control"
  | "overview"
  | "workflows"
  | "security"
  | "analytics"
  | "features"
  | "providers"
  | "provider_registry"
  | "users"
  | "transactions"
  | "mandates"
  | "comms"
  | "ai"
  | "staff"
  | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "control", label: "Control plane" },
  { id: "overview", label: "Command centre" },
  { id: "workflows", label: "Workflow studio" },
  { id: "security", label: "Security questions" },
  { id: "analytics", label: "Analytics" },
  { id: "features", label: "Feature control" },
  { id: "providers", label: "Providers & rails" },
  { id: "provider_registry", label: "Provider compliance" },
  { id: "users", label: "Users & devices" },
  { id: "transactions", label: "Transactions" },
  { id: "mandates", label: "Mandates & DD" },
  { id: "comms", label: "Communications" },
  { id: "ai", label: "AI models" },
  { id: "staff", label: "Staff access" },
  { id: "audit", label: "Audit log" },
];


export function AdminShell() {
  const [authed] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowEvent[]>([]);
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [txs, setTxs] = useState<TransactionRow[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [comms, setComms] = useState<CommunicationEvent[]>([]);
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [aiSubs, setAiSubs] = useState<AiSubscription[]>([]);
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [devices, setDevices] = useState<DeviceStat[]>([]);
  const [regions, setRegions] = useState<RegionVolume[]>([]);
  const [hourly, setHourly] = useState<number[]>([]);
  const [temporalConnected, setTemporalConnected] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = useCallback(async () => {
    setBusy(true);
    try {
      const [
        ov,
        wf,
        ft,
        pr,
        us,
        tx,
        md,
        cm,
        ai,
        an,
        ac,
      ] = await Promise.all([
        fetch("/api/overview").then((r) => r.json()),
        fetch("/api/workflows").then((r) => r.json()),
        fetch("/api/features").then((r) => r.json()),
        fetch("/api/providers").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/transactions").then((r) => r.json()),
        fetch("/api/mandates").then((r) => r.json()),
        fetch("/api/communications").then((r) => r.json()),
        fetch("/api/ai").then((r) => r.json()),
        fetch("/api/analytics").then((r) => r.json()),
        fetch("/api/actions").then((r) => r.json()),
      ]);
      setOverview(ov);
      setWorkflows(wf.items || []);
      setFeatures(ft.items || []);
      setProviders(pr.items || []);
      setUsers(us.items || []);
      setTxs(tx.items || []);
      setMandates(md.items || []);
      setComms(cm.items || []);
      setAiModels(ai.models || []);
      setAiSubs(ai.subscriptions || []);
      setDevices(an.devices || []);
      setRegions(an.regions || []);
      setHourly(an.hourlyVolume || []);
      // Dedupe audit rows by id (safety if older server used Date.now() collisions)
      const acts: AdminAction[] = ac.items || [];
      const seen = new Set<string>();
      setActions(
        acts.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        }),
      );
      try {
        const t = await fetch("/api/temporal?pageSize=1").then((r) => r.json());
        setTemporalConnected(!!t.connected);
      } catch {
        setTemporalConnected(false);
      }
    } catch {
      flash("Failed to load admin data");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void loadAll();
  }, [authed, loadAll]);

  const failCount = useMemo(
    () => workflows.filter((w) => w.status === "failed").length,
    [workflows],
  );

  async function patchFeature(id: string, _enabled: boolean, _rolloutPercent?: number) {
    flash("Feature changes move through platform-control-bff: propose, second operator approves, then apply.");
  }

  async function patchProvider(id: string, _status: Provider["status"]) {
    flash("Provider status changes move through platform-control-bff and require a second operator.");
  }

  async function patchUser(id: string, _status: UserRow["status"]) {
    flash("Customer status changes move through platform-control-bff and require a second operator.");
  }

  async function patchMandate(id: string, _status: Mandate["status"]) {
    flash("Mandate changes move through platform-control-bff and require a second operator.");
  }

  async function patchAi(id: string, _status: AiModel["status"]) {
    flash("Model status changes move through platform-control-bff and require a second operator.");
  }

  async function runAction(action: string) {
    flash("Break-glass actions move through platform-control-bff: they are proposed, approved by a second operator, and audited.");
  }

  // There is no console-level gate. The previous one compared a password in
  // the browser against a value printed on its own screen, and the server never
  // saw it (D-06). The console is read-only; the control-plane tab performs a
  // real passkey login against identity-access, and every state change is
  // authorised, approved and audited by platform-control-bff.


  const title = TABS.find((t) => t.id === tab)?.label || "Admin";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EPH</div>
          <div>
            <h1>SUPER ADMIN</h1>
            <p>EPHERA Money · ops</p>
          </div>
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`nav-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            {t.id === "workflows" && failCount > 0 ? (
              <span className="badge">{failCount}</span>
            ) : null}
          </button>
        ))}
        <div style={{ marginTop: 18 }} className="stack-sm">
          <button type="button" className="btn ghost" onClick={() => void loadAll()} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh data"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              // Signing out means dropping the operator session; the console
              // itself holds no authority to sign out of.
              sessionStorage.removeItem("ephera_operator_session");
              flash("Operator session cleared. Sign in again on the control plane tab.");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{title}</h2>
            <p className="sub">
              Remote control of product surfaces, Temporal workflows, providers, and AI engines
            </p>
          </div>
          <div className="live-pills">
            <span className={`pill ${overview?.live.payments ? "on" : "off"}`}>
              Payments {overview?.live.payments ? "UP" : "DOWN"}
            </span>
            <span className={`pill ${overview?.live.ledger ? "on" : "off"}`}>
              Ledger {overview?.live.ledger ? "UP" : "DOWN"}
            </span>
            <span className={`pill ${overview?.live.voice ? "on" : "off"}`}>
              Voice {overview?.live.voice ? "UP" : "DOWN"}
            </span>
            <span className={`pill ${temporalConnected ? "on" : "off"}`}>
              Temporal {temporalConnected ? "IN-DASH" : "OFF"}
            </span>
          </div>
        </div>

        {toast && <div className="card toast">{toast}</div>}

        {tab === "control" && <ControlPlanePanel />}

        {tab === "overview" && overview && (
          <>
            <div className="grid kpis">
              <Kpi label="Active users 24h" value={overview.kpis.activeUsers24h.toLocaleString()} />
              <Kpi
                label="Tx volume 24h"
                value={money(overview.kpis.txVolume24hMinor, "GHS")}
              />
              <Kpi label="Tx count 24h" value={overview.kpis.txCount24h.toLocaleString()} />
              <Kpi label="Sample fail rate" value={pct(overview.kpis.failRate)} />
              <Kpi label="Workflow errors" value={String(overview.kpis.openWorkflowErrors)} />
              <Kpi
                label="Providers online"
                value={`${overview.kpis.providersOnline}/${overview.kpis.providersTotal}`}
              />
              <Kpi label="AI requests 24h" value={overview.kpis.aiRequests24h.toLocaleString()} />
              <Kpi label="Active mandates" value={String(overview.kpis.mandatesActive)} />
            </div>

            <div className="grid two">
              <div className="card">
                <h3>Live demo wallet (ledger)</h3>
                <p className="msg">
                  Live customer balances are not shown here. The ledger
                  authenticates its callers, and this console holds no ledger
                  credential by design — balances belong to the control plane.
                </p>
              </div>

              <div className="card">
                <h3>Decision recommendations</h3>
                {overview.recommendations.map((r) => (
                  <div key={r.id} className={`rec ${r.priority}`}>
                    <strong>
                      [{r.priority}] {r.title}
                    </strong>
                    <p>{r.detail}</p>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        const map: Record<string, Tab> = {
                          nav_workflows: "workflows",
                          nav_providers: "providers",
                          nav_ai: "ai",
                          nav_features: "features",
                          nav_security: "security",
                        };
                        if (map[r.actionId]) setTab(map[r.actionId]);
                      }}
                    >
                      {r.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <h3>Remote kill switches</h3>
              <div className="actions">
                <button type="button" className="btn danger" onClick={() => void runAction("kill_switch_payments")}>
                  Kill switch — stop sends
                </button>
                <button type="button" className="btn success" onClick={() => void runAction("resume_payments")}>
                  Resume sends
                </button>
                <button type="button" className="btn" onClick={() => void runAction("enable_video_verify")}>
                  Canary video verification 10%
                </button>
              </div>
              <p className="footer-note">
                Future: in-app voice/video bank calls for authorisations & support, receive-fund
                identity verification, full SSO. Feature flags already reserve those surfaces.
              </p>
            </div>
          </>
        )}

        {tab === "workflows" && (
          <WorkflowStudio
            seeded={workflows}
            flash={flash}
            onRefreshSeeded={() => void loadAll()}
          />
        )}

        {tab === "security" && <SecurityPanel users={users} flash={flash} />}

        {tab === "analytics" && (
          <div className="grid two">
            <div className="card">
              <h3>Devices · who is using what</h3>
              {devices.map((d) => (
                <div className="bar-row" key={d.platform}>
                  <span>{platformLabel(d.platform)}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${d.share}%` }} />
                  </div>
                  <span>{d.share}%</span>
                </div>
              ))}
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Install base</th>
                      <th>Active today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.platform}>
                        <td>{platformLabel(d.platform)}</td>
                        <td>{d.count.toLocaleString()}</td>
                        <td>{d.activeToday.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h3>Hourly transaction intensity</h3>
              <div className="spark">
                {hourly.map((v, i) => (
                  <i
                    key={i}
                    style={{ height: `${Math.max(8, (v / Math.max(...hourly, 1)) * 100)}%` }}
                    title={`Hour ${i}: ${v}`}
                  />
                ))}
              </div>
              <h3 style={{ marginTop: 18 }}>Regions · currency · volume</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Region</th>
                      <th>CCY</th>
                      <th>Tx</th>
                      <th>Volume</th>
                      <th>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map((r) => (
                      <tr key={`${r.region}-${r.currency}`}>
                        <td>
                          {r.region} <span className="msg">({r.country})</span>
                        </td>
                        <td>{r.currency}</td>
                        <td>{r.txCount.toLocaleString()}</td>
                        <td>{money(r.volumeMinor, r.currency)}</td>
                        <td>{r.failedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "features" && (
          <div className="card">
            <h3>Remote feature flags — control app functions</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Category</th>
                    <th>On</th>
                    <th>Rollout %</th>
                    <th>Envs</th>
                    <th>Changed</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.name}</strong>
                        <div className="msg">{f.description}</div>
                        <div className="mono msg">{f.id}</div>
                      </td>
                      <td>
                        <span className="tag info">{f.category}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`toggle ${f.enabled ? "on" : ""}`}
                          onClick={() => void patchFeature(f.id, !f.enabled)}
                          aria-label="Toggle feature"
                        >
                          <span />
                        </button>
                      </td>
                      <td>
                        <input
                          className="range"
                          type="range"
                          min={0}
                          max={100}
                          value={f.rolloutPercent}
                          onChange={(e) =>
                            void patchFeature(f.id, f.enabled, Number(e.target.value))
                          }
                        />{" "}
                        {f.rolloutPercent}%
                      </td>
                      <td className="mono">{f.environments.join(", ")}</td>
                      <td className="msg">
                        {f.lastChangedBy}
                        <br />
                        {shortTime(f.lastChangedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "provider_registry" && <ProviderCompliancePanel flash={flash} />}

        {tab === "providers" && (
          <div className="card">
            <h3>Service providers — MM, banks, open banking, utilities</h3>
            <p className="lede" style={{ marginBottom: 12 }}>
              Runtime rail health. Onboarding &amp; compliance docs live under{" "}
              <strong>Provider compliance</strong> (Provider Portal → Super Admin review).
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Success</th>
                    <th>Latency</th>
                    <th>Capabilities</th>
                    <th>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div className="msg mono">
                          {p.id} · {p.region}
                        </div>
                      </td>
                      <td>
                        <span className="tag info">{p.type}</span>
                      </td>
                      <td>
                        <span className={`tag ${p.status}`}>{p.status}</span>
                      </td>
                      <td>{pct(p.successRate)}</td>
                      <td>{p.latencyMs} ms</td>
                      <td className="msg">{p.capabilities.join(" · ")}</td>
                      <td>
                        <div className="actions">
                          {(["online", "sandbox", "degraded", "offline"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="btn ghost"
                              onClick={() => void patchProvider(p.id, s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="card">
            <h3>Users · KYC · device · remote status</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>KYC</th>
                    <th>Status</th>
                    <th>Device</th>
                    <th>Region</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <div className="msg mono">{u.phone}</div>
                      </td>
                      <td>{u.kycLevel}</td>
                      <td>
                        <span className={`tag ${u.status}`}>{u.status}</span>
                      </td>
                      <td className="msg">{u.device}</td>
                      <td>
                        {u.region}
                        <div className="msg">{u.channels.join(", ")}</div>
                      </td>
                      <td>{money(u.balanceMinor, u.currency)}</td>
                      <td>
                        <div className="actions">
                          <button type="button" className="btn" onClick={() => void patchUser(u.id, "active")}>
                            Activate
                          </button>
                          <button
                            type="button"
                            className="btn danger"
                            onClick={() => void patchUser(u.id, "frozen")}
                          >
                            Freeze
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void patchUser(u.id, "suspended")}
                          >
                            Suspend
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <div className="card">
            <h3>Transactions · linked workflow failures</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>From → To</th>
                    <th>Region / provider</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{shortTime(t.createdAt)}</td>
                      <td>{t.type}</td>
                      <td>
                        <span className={`tag ${t.status}`}>{t.status}</span>
                      </td>
                      <td>{money(t.amountMinor, t.currency)}</td>
                      <td>
                        {t.from} → {t.to}
                      </td>
                      <td className="msg">
                        {t.region}
                        <br />
                        {t.provider || "—"}
                      </td>
                      <td className="msg mono">
                        {t.failReason || "—"}
                        {t.workflowId ? (
                          <>
                            <br />
                            {t.workflowId}
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "mandates" && (
          <div className="card">
            <h3>Direct debit · standing orders · recurring · AI subscriptions billing</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Customer</th>
                    <th>Provider</th>
                    <th>Amount</th>
                    <th>Frequency</th>
                    <th>Next</th>
                    <th>Status</th>
                    <th>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {mandates.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="tag info">{m.kind}</span>
                      </td>
                      <td>{m.userName}</td>
                      <td>{m.provider}</td>
                      <td>{money(m.amountMinor, m.currency)}</td>
                      <td>{m.frequency}</td>
                      <td className="mono">{shortTime(m.nextRunAt)}</td>
                      <td>
                        <span className={`tag ${m.status}`}>{m.status}</span>
                      </td>
                      <td>
                        <div className="actions">
                          <button type="button" className="btn" onClick={() => void patchMandate(m.id, "active")}>
                            Active
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void patchMandate(m.id, "paused")}
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            className="btn danger"
                            onClick={() => void patchMandate(m.id, "cancelled")}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "comms" && (
          <div className="card">
            <h3>Communications — push, SMS, voice, video, WhatsApp</h3>
            <p className="msg" style={{ marginBottom: 12 }}>
              Bank-style inbound/outbound calls and video account verification are modelled here for
              future live telephony / WebRTC integration.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Channel</th>
                    <th>Dir</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th>Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {comms.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{shortTime(c.createdAt)}</td>
                      <td>
                        <span className="tag info">{c.channel}</span>
                      </td>
                      <td>{c.direction}</td>
                      <td>{c.purpose}</td>
                      <td>
                        <span className={`tag ${c.status === "failed" ? "error" : "info"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="msg">{c.subject}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="grid two">
            <div className="card">
              <h3>AI models & engines</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Status</th>
                      <th>24h req</th>
                      <th>Latency</th>
                      <th>Err %</th>
                      <th>Cost</th>
                      <th>Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiModels.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.name}</strong>
                          <div className="msg">
                            {m.role} · {m.version}
                          </div>
                          <div className="msg mono">{m.provider}</div>
                        </td>
                        <td>
                          <span className={`tag ${m.status}`}>{m.status}</span>
                        </td>
                        <td>{m.requests24h.toLocaleString()}</td>
                        <td>{m.avgLatencyMs} ms</td>
                        <td>{pct(m.errorRate)}</td>
                        <td>${m.costUsd24h.toFixed(2)}</td>
                        <td>
                          <div className="actions">
                            <button type="button" className="btn" onClick={() => void patchAi(m.id, "active")}>
                              Active
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => void patchAi(m.id, "canary")}
                            >
                              Canary
                            </button>
                            <button
                              type="button"
                              className="btn danger"
                              onClick={() => void patchAi(m.id, "disabled")}
                            >
                              Disable
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h3>Client AI subscriptions</h3>
              <p className="msg" style={{ marginBottom: 10 }}>
                Merchants, banks, and partners subscribe to EPHERA AI services (voice, fraud,
                recommendations, support). Control quota and plan status here.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Plan</th>
                      <th>Usage</th>
                      <th>Status</th>
                      <th>Models</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiSubs.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.clientName}</strong>
                          <div className="msg">{s.clientType}</div>
                        </td>
                        <td>{s.plan}</td>
                        <td>
                          {s.usedThisMonth.toLocaleString()} / {s.monthlyQuota.toLocaleString()}
                          <div className="bar-track" style={{ marginTop: 4 }}>
                            <div
                              className="bar-fill"
                              style={{
                                width: `${Math.min(100, (s.usedThisMonth / s.monthlyQuota) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <span className={`tag ${s.status === "active" ? "active" : "warn"}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="msg mono">{s.models.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "staff" && <StaffAccessPanel flash={flash} />}

        {tab === "audit" && (
          <div className="card">
            <h3>Super-admin audit trail</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a, idx) => (
                    <tr key={`${a.id}__${idx}`}>
                      <td className="mono">{shortTime(a.at)}</td>
                      <td>{a.actor}</td>
                      <td className="mono">{a.action}</td>
                      <td className="mono">{a.target}</td>
                      <td className="msg">{a.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="footer-note">
          EPHERA Super Admin · sandbox control plane · generated{" "}
          {overview ? shortTime(overview.generatedAt) : "—"} · Do not expose publicly without SSO &
          network policy.
        </p>
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="kpi-val">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
