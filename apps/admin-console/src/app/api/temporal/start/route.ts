import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Start a sandbox domestic transfer workflow via Payments API (in-dashboard).
 * This is the operational "run workflow" path — no external Temporal UI required.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    amountMinor?: number;
    currency?: string;
    recipientName?: string;
    fromExternalRef?: string;
    blueprintId?: string;
    actor?: string;
  };

  const payments = process.env.PAYMENTS_URL || "http://localhost:8090";
  const amountMinor = body.amountMinor ?? 1000;
  const currency = body.currency || "GHS";
  const recipientName = body.recipientName || "Ama Mensah";
  const idem = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const r = await fetch(`${payments}/v1/transfers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountMinor,
        currency,
        recipientName,
        fromExternalRef: body.fromExternalRef || "user:demo-self:GHS",
        authorisationRef: "passkey_admin_console_demo",
        idempotencyKey: idem,
        rail: "mobile-money-sim",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    store.logAction(
      "workflow.start",
      body.blueprintId || "DomesticTransferSim",
      body.actor || "superadmin",
      `HTTP ${r.status} · ${JSON.stringify(json).slice(0, 240)}`,
    );

    store.ingestWorkflow({
      workflowType: "DomesticTransferSim",
      workflowId: String(json.workflowId || json.transferId || `transfer-admin_${Date.now()}`),
      runId: String(json.runId || "pending"),
      activityType: "Start",
      status: r.ok ? "running" : "failed",
      severity: r.ok ? "info" : "error",
      message: r.ok
        ? `Started from Super Admin studio · ${amountMinor / 100} ${currency} → ${recipientName}`
        : `Start failed: ${text.slice(0, 300)}`,
      errorCode: r.ok ? undefined : "start_failed",
      occurredAt: new Date().toISOString(),
      namespace: "default",
      taskQueue: "ephera-payments",
    });

    return NextResponse.json(
      { ok: r.ok, status: r.status, paymentsResponse: json, idempotencyKey: idem },
      { status: r.ok ? 200 : 502 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "start_error";
    store.logAction("workflow.start", "DomesticTransferSim", body.actor || "superadmin", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
