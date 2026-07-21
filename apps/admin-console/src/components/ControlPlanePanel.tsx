"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyChange,
  clearSession,
  decideChange,
  fetchMe,
  listAudit,
  listChanges,
  operatorLogin,
  passkeysSupported,
  proposeChange,
  registerOperatorPasskey,
  storedSession,
  verifyAuditChain,
  type AuditRow,
  type ChangeRequest,
  type Me,
} from "../lib/control-plane";

/**
 * The control plane surface.
 *
 * Everything here goes through platform-control-bff: the console decides
 * nothing. Sensitive actions are proposed, approved by a different operator,
 * then applied, and every attempt lands in an append-only hash-chained log.
 */

const ACTIONS = [
  "wallet.freeze",
  "wallet.unfreeze",
  "kill_switch",
  "features.edit",
  "provider.approve",
  "mandate.change",
];

export function ControlPlanePanel() {
  const [subject, setSubject] = useState("ops.maker@ephera.internal");
  const [me, setMe] = useState<Me | null>(null);
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [chain, setChain] = useState<{ intact: boolean; firstBadSeq: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [action, setAction] = useState(ACTIONS[0]);
  const [target, setTarget] = useState("user:demo-self:GHS");
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    if (!storedSession()) {
      setMe(null);
      return;
    }
    const who = await fetchMe();
    setMe(who);
    if (!who) return;
    setChanges(await listChanges());
    setAudit(await listAudit());
    setChain(await verifyAuditChain());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setMsg(r.message);
    await refresh();
    setBusy(false);
  }

  if (!me) {
    return (
      <section className="panel">
        <h2>Operator sign-in</h2>
        <p className="muted">
          The console has no password. Operators authenticate with a passkey; the
          session it returns is verified by the control plane, which resolves
          what you may do from its own records.
        </p>
        {!passkeysSupported() ? (
          <p className="danger">
            This browser cannot use passkeys, so it cannot sign in to the control plane.
          </p>
        ) : null}
        <label className="kicker">Operator</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button
            type="button"
            className="btn"
            disabled={busy || !passkeysSupported()}
            onClick={() => void run(() => operatorLogin(subject))}
          >
            Sign in with passkey
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={busy || !passkeysSupported()}
            onClick={() => void run(() => registerOperatorPasskey(subject))}
          >
            Register passkey
          </button>
        </div>
        {msg ? <p className="muted" style={{ marginTop: 12 }}>{msg}</p> : null}
      </section>
    );
  }

  const canApprove = me.permissions.includes("change.approve");

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Control plane</h2>
          <p className="muted" style={{ margin: 0 }}>
            {me.subject} · roles {me.roles.join(", ") || "none"} · signed in by {me.method}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            clearSession();
            setMe(null);
          }}
        >
          Sign out
        </button>
      </div>

      <h3>Propose a change</h3>
      <p className="muted">
        Holding the role lets you propose. Applying needs a different operator to
        approve — including for your own proposals, at every severity.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="target"
        />
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="reason (required)"
          style={{ minWidth: 260 }}
        />
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void run(() => proposeChange({ action, target, reason }))}
        >
          Propose
        </button>
      </div>

      <h3>Change queue</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Target</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Proposed by</th>
            <th>Decided by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {changes.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                No change requests.
              </td>
            </tr>
          ) : (
            changes.map((c) => (
              <tr key={c.ID}>
                <td>{c.Action}</td>
                <td className="mono">{c.Target}</td>
                <td>{c.Reason}</td>
                <td>{c.Status}</td>
                <td className="mono">{c.RequestedBy}</td>
                <td className="mono">{c.DecidedBy ?? "—"}</td>
                <td>
                  {c.Status === "pending" && canApprove ? (
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void run(() => decideChange(c.ID, "approved", "approved in console"))}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void run(() => decideChange(c.ID, "rejected", "rejected in console"))}
                      >
                        Reject
                      </button>
                    </div>
                  ) : c.Status === "approved" ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void run(() => applyChange(c.ID))}
                    >
                      Apply
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3>
        Audit{" "}
        {chain ? (
          <span className={chain.intact ? "ok" : "danger"}>
            {chain.intact ? "· chain verified" : `· chain broken at ${chain.firstBadSeq}`}
          </span>
        ) : null}
      </h3>
      <p className="muted">
        Append-only and hash-chained. The database refuses updates and deletes,
        and the chain above is recomputed from the first record on every load.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {audit.map((a) => (
            <tr key={a.seq}>
              <td>{a.seq}</td>
              <td>{new Date(a.at).toLocaleTimeString()}</td>
              <td className="mono">{a.actor}</td>
              <td>{a.action}</td>
              <td className="mono">{a.target}</td>
              <td className={a.outcome === "denied" ? "danger" : "ok"}>{a.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {msg ? <p className="muted" style={{ marginTop: 12 }}>{msg}</p> : null}
    </section>
  );
}
