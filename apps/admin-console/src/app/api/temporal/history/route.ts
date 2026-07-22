import { NextResponse } from "next/server";
import { decodePayloadData, ns, summariseEvent, temporalFetch } from "@/lib/temporal";

export const dynamic = "force-dynamic";

// Mutating routes were removed at G2-C.
//
// This console had no server-side authentication on any route, took the acting
// identity from the request body defaulting to "superadmin", and enforced its
// role model on one route in nineteen (D-06, D-07, D-12). Two of its routes
// reached the money path using a hardcoded authorisation literal.
//
// State-changing operations now belong to platform-control-bff, where they are
// authenticated from a signed operator session, permissioned server-side,
// require a second operator, and are written to an append-only hash-chained
// audit log. Until this console is rebuilt against that service it is
// read-only: removing the routes removes the exposure, rather than leaving it
// in place behind a promise.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  const runId = searchParams.get("runId") || "";
  if (!workflowId) {
    return NextResponse.json({ error: "workflowId required" }, { status: 400 });
  }

  const q = new URLSearchParams({ maximumPageSize: "200" });
  if (runId) q.set("execution.runId", runId);

  const path = `/api/v1/namespaces/${encodeURIComponent(ns())}/workflows/${encodeURIComponent(workflowId)}/history?${q}`;
  const { ok, status, body } = await temporalFetch(path);
  if (!ok) {
    return NextResponse.json({ error: body }, { status: status || 502 });
  }

  const raw = body as { history?: { events?: Record<string, unknown>[] } };
  const events = (raw.history?.events || []).map((ev) => {
    const s = summariseEvent(ev);
    // try extract failure detail deeper
    return { ...s, rawType: s.eventType };
  });

  // describe
  const descPath =
    `/api/v1/namespaces/${encodeURIComponent(ns())}/workflows/${encodeURIComponent(workflowId)}` +
    (runId ? `?execution.runId=${encodeURIComponent(runId)}` : "");
  const desc = await temporalFetch(descPath);

  return NextResponse.json({
    workflowId,
    runId,
    describe: desc.ok ? desc.body : null,
    events,
    eventCount: events.length,
  });
}

/** Decode helpers available for clients that pass base64 payloads. */
