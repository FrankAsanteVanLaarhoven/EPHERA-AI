import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  let rows = [...store.workflows];
  if (status) rows = rows.filter((w) => w.status === status);
  rows.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  return NextResponse.json({
    temporalUi: process.env.TEMPORAL_UI_URL || "http://localhost:8088",
    count: rows.length,
    items: rows,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    workflowType: string;
    workflowId: string;
    runId: string;
    activityType?: string;
    attempt?: number;
    status: "running" | "completed" | "failed" | "retrying";
    severity: "critical" | "error" | "warn" | "info" | "success";
    message: string;
    errorCode?: string;
  };
  const row = store.ingestWorkflow({
    ...body,
    occurredAt: new Date().toISOString(),
    namespace: "default",
    taskQueue: "ephera-payments",
  });
  return NextResponse.json(row, { status: 201 });
}
