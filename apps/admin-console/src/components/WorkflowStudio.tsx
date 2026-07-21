"use client";

import { useCallback, useEffect, useState } from "react";
import { shortTime } from "@/lib/format";
import type { WorkflowBlueprint, WorkflowEvent, WorkflowStep } from "@/lib/types";

type LiveRow = {
  workflowId: string;
  runId: string;
  type: string;
  status: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: string;
  taskQueue?: string;
};

type HistEvent = {
  eventId: string;
  eventTime: string;
  eventType: string;
  summary: string;
  detail: string;
  severity: string;
};

type Props = {
  seeded: WorkflowEvent[];
  flash: (m: string) => void;
  onRefreshSeeded: () => void;
};

export function WorkflowStudio({ seeded, flash, onRefreshSeeded }: Props) {
  const [live, setLive] = useState<LiveRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<LiveRow | null>(null);
  const [events, setEvents] = useState<HistEvent[]>([]);
  const [blueprints, setBlueprints] = useState<WorkflowBlueprint[]>([]);
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("Ama Mensah");
  const [builderName, setBuilderName] = useState("");
  const [builderType, setBuilderType] = useState("CustomOpsFlow");
  const [builderSteps, setBuilderSteps] = useState<WorkflowStep[]>([
    { id: "ns1", activity: "Quote", label: "Quote", required: true, timeoutSec: 30, retries: 3 },
    {
      id: "ns2",
      activity: "RequireAuthorisation",
      label: "Authorise",
      required: true,
      timeoutSec: 30,
      retries: 2,
    },
    {
      id: "ns3",
      activity: "PostLedgerHold",
      label: "Ledger hold",
      required: true,
      timeoutSec: 30,
      retries: 3,
    },
  ]);
  const [editBp, setEditBp] = useState<WorkflowBlueprint | null>(null);

  const loadLive = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/temporal?pageSize=50");
      const j = await r.json();
      setConnected(!!j.connected);
      setLive(j.items || []);
    } catch {
      setConnected(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadBlueprints = useCallback(async () => {
    const r = await fetch("/api/blueprints");
    const j = await r.json();
    setBlueprints(j.items || []);
  }, []);

  useEffect(() => {
    void loadLive();
    void loadBlueprints();
    const t = setInterval(() => void loadLive(), 12000);
    return () => clearInterval(t);
  }, [loadLive, loadBlueprints]);

  async function openHistory(row: LiveRow) {
    setSelected(row);
    setEvents([]);
    const q = new URLSearchParams({
      workflowId: row.workflowId,
      runId: row.runId,
    });
    const r = await fetch(`/api/temporal/history?${q}`);
    const j = await r.json();
    setEvents(j.events || []);
  }

  async function startWorkflow() {
    setBusy(true);
    const minor = Math.round((Number(amount) || 0) * 100);
    const r = await fetch("/api/temporal/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountMinor: minor,
        recipientName: recipient,
        blueprintId: "bp_domestic",
      }),
    });
    const j = await r.json();
    flash(j.ok ? "Workflow started inside dashboard" : `Start failed: ${JSON.stringify(j).slice(0, 120)}`);
    setBusy(false);
    void loadLive();
    onRefreshSeeded();
  }

  async function createBlueprint() {
    if (!builderName.trim()) {
      flash("Name the workflow blueprint");
      return;
    }
    const r = await fetch("/api/blueprints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: builderName,
        workflowType: builderType,
        description: "Created in Super Admin Workflow Studio",
        steps: builderSteps,
      }),
    });
    if (r.ok) {
      flash("Blueprint created (draft)");
      setBuilderName("");
      void loadBlueprints();
    }
  }

  async function publish(id: string) {
    await fetch("/api/blueprints", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "publish" }),
    });
    flash("Blueprint published");
    void loadBlueprints();
  }

  async function saveSteps(bp: WorkflowBlueprint) {
    await fetch("/api/blueprints", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: bp.id, action: "save", steps: bp.steps, name: bp.name, description: bp.description }),
    });
    flash("Blueprint saved");
    setEditBp(null);
    void loadBlueprints();
  }

  function addStep() {
    setBuilderSteps((s) => [
      ...s,
      {
        id: `ns_${Date.now()}_${s.length}`,
        activity: "CustomActivity",
        label: "New activity",
        required: true,
        timeoutSec: 30,
        retries: 2,
      },
    ]);
  }

  return (
    <div className="stack-lg">
      <div className="card glass-hero">
        <div className="row-between">
          <div>
            <h3 className="section-title">Workflow Studio · in-dashboard Temporal</h3>
            <p className="lede">
              List, inspect history, design blueprints, and start DomesticTransferSim without leaving
              EPHERA Super Admin. Live cluster:{" "}
              <span className={`tag ${connected ? "online" : "error"}`}>
                {connected ? "CONNECTED" : "OFFLINE"}
              </span>
            </p>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={() => void loadLive()} disabled={busy}>
              Refresh live
            </button>
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Run workflow (sandbox)</h3>
          <p className="lede">Starts via Payments API → Temporal worker · stays inside this console.</p>
          <div className="form-grid">
            <label>
              Amount
              <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>
              Recipient
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={() => void startWorkflow()} disabled={busy}>
              Start DomesticTransferSim
            </button>
          </div>
          <p className="footer-note">
            Tip: demo wallet often has &lt; ₵50 available — use ₵10 to succeed, ₵50 to reproduce
            PostLedgerHold insufficient_funds.
          </p>
        </div>

        <div className="card">
          <h3 className="section-title">Pipeline designer</h3>
          <div className="form-grid">
            <label>
              Blueprint name
              <input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="e.g. FX settle flow" />
            </label>
            <label>
              Workflow type
              <input value={builderType} onChange={(e) => setBuilderType(e.target.value)} />
            </label>
          </div>
          <div className="pipeline">
            {builderSteps.map((s, i) => (
              <div key={s.id} className="pipeline-step">
                <span className="pipe-idx">{i + 1}</span>
                <input
                  value={s.activity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBuilderSteps((rows) =>
                      rows.map((r) => (r.id === s.id ? { ...r, activity: v, label: v } : r)),
                    );
                  }}
                />
                <span className="msg">
                  {s.timeoutSec}s · {s.retries} retries
                </span>
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={addStep}>
              + Activity
            </button>
            <button type="button" className="btn primary" onClick={() => void createBlueprint()}>
              Save draft blueprint
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Blueprints library</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {blueprints.map((bp) => (
                <tr key={bp.id}>
                  <td>
                    <strong>{bp.name}</strong>
                    <div className="msg">{bp.description}</div>
                  </td>
                  <td className="mono">{bp.workflowType}</td>
                  <td>
                    <span className={`tag ${bp.status === "published" ? "active" : "warn"}`}>{bp.status}</span>
                  </td>
                  <td>
                    <div className="pipeline mini">
                      {bp.steps.map((s) => (
                        <span key={s.id} className="chip">
                          {s.activity}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn ghost" onClick={() => setEditBp(bp)}>
                        Edit
                      </button>
                      {bp.status !== "published" && (
                        <button type="button" className="btn" onClick={() => void publish(bp.id)}>
                          Publish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editBp && (
          <div className="edit-panel">
            <h4>Edit · {editBp.name}</h4>
            <div className="pipeline">
              {editBp.steps.map((s, i) => (
                <div key={s.id} className="pipeline-step">
                  <span className="pipe-idx">{i + 1}</span>
                  <input
                    value={s.activity}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditBp({
                        ...editBp,
                        steps: editBp.steps.map((r) =>
                          r.id === s.id ? { ...r, activity: v, label: v } : r,
                        ),
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => void saveSteps(editBp)}>
                Save
              </button>
              <button type="button" className="btn ghost" onClick={() => setEditBp(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Live Temporal executions</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Workflow ID</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => (
                  <tr key={`${row.workflowId}:${row.runId}`}>
                    <td>
                      <span
                        className={`tag ${
                          row.status.includes("FAILED")
                            ? "error"
                            : row.status.includes("COMPLETED")
                              ? "success"
                              : "info"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="mono">{row.type}</td>
                    <td className="mono msg" style={{ maxWidth: 200 }}>
                      {row.workflowId}
                    </td>
                    <td className="mono">{row.startTime ? shortTime(row.startTime) : "—"}</td>
                    <td>
                      <button type="button" className="btn ghost" onClick={() => void openHistory(row)}>
                        History
                      </button>
                    </td>
                  </tr>
                ))}
                {!live.length && (
                  <tr>
                    <td colSpan={5} className="msg">
                      {connected
                        ? "No executions yet — start a transfer above."
                        : "Temporal HTTP offline — start docker compose temporal-ui (:8088)."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">
            Event history {selected ? `· ${selected.workflowId}` : ""}
          </h3>
          {!selected && <p className="lede">Select a live execution to inspect the full activity timeline here.</p>}
          <div className="timeline">
            {events.map((ev) => (
              <div key={`${ev.eventId}-${ev.eventType}`} className={`tl-item ${ev.severity}`}>
                <div className="tl-meta mono">
                  #{ev.eventId} · {ev.eventTime ? shortTime(ev.eventTime) : "—"}
                </div>
                <div className="tl-sum">{ev.summary}</div>
                {ev.detail ? <div className="msg">{ev.detail}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Seeded / ops event stream</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Workflow</th>
                <th>Activity</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {seeded.map((w) => (
                <tr key={w.id}>
                  <td className="mono">{shortTime(w.occurredAt)}</td>
                  <td>
                    <span className={`tag ${w.status}`}>{w.status}</span>
                    {w.errorCode ? <span className="tag error"> {w.errorCode}</span> : null}
                  </td>
                  <td className="mono msg">{w.workflowId}</td>
                  <td>{w.activityType || "—"}</td>
                  <td className="msg">{w.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
