"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSession,
  decideCase,
  fetchMe,
  fetchSubject,
  listCases,
  login,
  passkeysSupported,
  registerPasskey,
  storedSession,
  type Me,
  type ReviewCase,
} from "../lib/api";

/**
 * The case queue.
 *
 * A payment held for review is a customer whose money has not moved and who is
 * waiting. The queue therefore leads with the observation that caused the hold
 * and how long the customer has been waiting, rather than with an identifier.
 *
 * Clearing or blocking requires a note. A decision without a reason cannot be
 * reviewed later, and this is the record an examiner reads.
 */
export function CaseQueue() {
  const [subject, setSubject] = useState("compliance.officer@ephera.internal");
  const [me, setMe] = useState<Me | null>(null);
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!storedSession()) {
      setMe(null);
      return;
    }
    const who = await fetchMe();
    setMe(who);
    if (who) setCases(await listCases());
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
        <h2>Analyst sign-in</h2>
        <p className="muted">
          There is no password. Analysts sign in with a passkey; the control
          plane decides what you may do, and every decision you make is recorded
          against you.
        </p>
        {!passkeysSupported() ? (
          <p className="danger">This browser cannot use passkeys.</p>
        ) : null}
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn"
            disabled={busy || !passkeysSupported()}
            onClick={() => void run(() => login(subject))}
          >
            Sign in with passkey
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={busy || !passkeysSupported()}
            onClick={() => void run(() => registerPasskey(subject))}
          >
            Register passkey
          </button>
        </div>
        {msg ? <p className="muted" style={{ marginTop: 12 }}>{msg}</p> : null}
      </section>
    );
  }

  const canDecide = me.permissions.includes("cases.decide");

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Review queue</h2>
          <p className="muted" style={{ margin: 0 }}>
            {me.subject} · {me.roles.join(", ") || "no roles"} · signed in by {me.method}
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

      {!canDecide ? (
        <p className="muted">
          You can see the queue but not decide. Deciding a case needs the
          compliance officer or risk analyst role.
        </p>
      ) : null}

      {cases.length === 0 ? (
        <p className="muted">No payments are held for review.</p>
      ) : (
        cases.map((c) => (
          <article key={c.id} className="glass" style={{ padding: 16, marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong className="mono">{c.subject}</strong>
              <span className="muted">
                held {new Date(c.openedAt).toLocaleString()}
              </span>
            </div>
            {/* The observation, not just the rule name: it is what the analyst
                checks and what the customer will be asked about. */}
            <p style={{ margin: "8px 0" }}>{c.reason}</p>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => void fetchSubject(c.subject).then(setDetail)}
              >
                Look up subject
              </button>
              <input
                className="input"
                placeholder="why you are clearing or blocking this (required)"
                style={{ minWidth: 320 }}
                value={notes[c.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
              />
              <button
                type="button"
                className="btn"
                disabled={busy || !canDecide || !(notes[c.id] ?? "").trim()}
                onClick={() => void run(() => decideCase(c.id, "cleared", notes[c.id] ?? ""))}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy || !canDecide || !(notes[c.id] ?? "").trim()}
                onClick={() => void run(() => decideCase(c.id, "blocked", notes[c.id] ?? ""))}
              >
                Block
              </button>
            </div>
          </article>
        ))
      )}

      {detail ? (
        <pre className="glass" style={{ padding: 14, marginTop: 14, overflowX: "auto" }}>
          {JSON.stringify(detail, null, 2)}
        </pre>
      ) : null}

      {msg ? <p className="muted" style={{ marginTop: 12 }}>{msg}</p> : null}
    </section>
  );
}
