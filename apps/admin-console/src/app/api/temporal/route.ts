import { NextResponse } from "next/server";
import { ns, temporalBase, temporalFetch, type LiveWorkflowRow } from "@/lib/temporal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageSize = searchParams.get("pageSize") || "40";
  const query = searchParams.get("query") || "";

  const path =
    `/api/v1/namespaces/${encodeURIComponent(ns())}/workflows?pageSize=${encodeURIComponent(pageSize)}` +
    (query ? `&query=${encodeURIComponent(query)}` : "");

  const { ok, status, body } = await temporalFetch(path);
  if (!ok) {
    return NextResponse.json(
      {
        connected: false,
        temporalHttp: temporalBase(),
        namespace: ns(),
        error: body,
        items: [] as LiveWorkflowRow[],
      },
      { status: status || 502 },
    );
  }

  const raw = body as {
    executions?: Array<{
      execution?: { workflowId?: string; runId?: string };
      type?: { name?: string };
      status?: string;
      startTime?: string;
      closeTime?: string;
      historyLength?: string;
      taskQueue?: string;
    }>;
    nextPageToken?: string;
  };

  const items: LiveWorkflowRow[] = (raw.executions || []).map((e) => ({
    workflowId: e.execution?.workflowId || "",
    runId: e.execution?.runId || "",
    type: e.type?.name || "—",
    status: (e.status || "").replace("WORKFLOW_EXECUTION_STATUS_", ""),
    startTime: e.startTime,
    closeTime: e.closeTime,
    historyLength: e.historyLength,
    taskQueue: e.taskQueue,
  }));

  return NextResponse.json({
    connected: true,
    temporalHttp: temporalBase(),
    namespace: ns(),
    count: items.length,
    nextPageToken: raw.nextPageToken,
    items,
  });
}
