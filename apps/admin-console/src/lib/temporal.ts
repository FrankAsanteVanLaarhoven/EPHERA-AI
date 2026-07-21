/**
 * Proxy helpers for Temporal HTTP API exposed by temporal-ui (:8088).
 * Keeps all ops inside the Super Admin BFF — no need to leave the dashboard.
 */

const TEMPORAL_HTTP = process.env.TEMPORAL_HTTP_URL || process.env.TEMPORAL_UI_URL || "http://localhost:8088";
const NAMESPACE = process.env.TEMPORAL_NAMESPACE || "default";

export function temporalBase() {
  return TEMPORAL_HTTP.replace(/\/$/, "");
}

export function ns() {
  return NAMESPACE;
}

export async function temporalFetch(path: string, init?: RequestInit) {
  const url = `${temporalBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.headers || {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

export function decodePayloadData(data?: string): unknown {
  if (!data) return null;
  try {
    const json = Buffer.from(data, "base64").toString("utf8");
    try {
      return JSON.parse(json);
    } catch {
      return json;
    }
  } catch {
    return null;
  }
}

export function summariseEvent(ev: Record<string, unknown>) {
  const type = String(ev.eventType || "");
  const id = String(ev.eventId || "");
  const time = String(ev.eventTime || "");
  let summary = type.replace(/^EVENT_TYPE_/, "").replace(/_/g, " ").toLowerCase();
  let detail = "";
  let severity: "info" | "success" | "error" | "warn" = "info";

  const fail = ev.workflowExecutionFailedEventAttributes as
    | { failure?: { message?: string; cause?: { message?: string }; activityFailureInfo?: { activityType?: { name?: string } } } }
    | undefined;
  if (fail?.failure) {
    severity = "error";
    const act = fail.failure.activityFailureInfo?.activityType?.name;
    detail = [act, fail.failure.cause?.message || fail.failure.message].filter(Boolean).join(" · ");
    summary = "workflow failed";
  }

  const actSched = ev.activityTaskScheduledEventAttributes as
    | { activityType?: { name?: string }; activityId?: string }
    | undefined;
  if (actSched?.activityType?.name) {
    summary = `schedule ${actSched.activityType.name}`;
    detail = `activityId ${actSched.activityId || "—"}`;
  }

  const actFail = ev.activityTaskFailedEventAttributes as
    | { failure?: { message?: string; cause?: { message?: string } }; activityType?: { name?: string } }
    | undefined;
  if (actFail) {
    severity = "error";
    summary = `activity failed ${actFail.activityType?.name || ""}`.trim();
    detail = actFail.failure?.cause?.message || actFail.failure?.message || "";
  }

  const actComp = ev.activityTaskCompletedEventAttributes as { result?: unknown } | undefined;
  if (type.includes("ACTIVITY_TASK_COMPLETED")) {
    severity = "success";
    summary = "activity completed";
  }

  if (type.includes("WORKFLOW_EXECUTION_COMPLETED")) severity = "success";
  if (type.includes("WORKFLOW_EXECUTION_STARTED")) summary = "workflow started";

  void actComp;
  return { eventId: id, eventTime: time, eventType: type, summary, detail, severity };
}

export type LiveWorkflowRow = {
  workflowId: string;
  runId: string;
  type: string;
  status: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: string;
  taskQueue?: string;
};
