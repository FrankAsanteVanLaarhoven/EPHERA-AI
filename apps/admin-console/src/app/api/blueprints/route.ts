import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import type { WorkflowBlueprint, WorkflowStep } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: store.workflowBlueprints });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name: string;
    workflowType: string;
    description?: string;
    steps?: WorkflowStep[];
    actor?: string;
  };
  const bp: WorkflowBlueprint = {
    id: uid("bp"),
    name: body.name,
    workflowType: body.workflowType || "CustomWorkflow",
    taskQueue: "ephera-payments",
    description: body.description || "",
    steps: body.steps?.length
      ? body.steps
      : [
          {
            id: uid("step"),
            activity: "Quote",
            label: "Quote",
            required: true,
            timeoutSec: 30,
            retries: 3,
          },
        ],
    version: "0.1.0-draft",
    status: "draft",
    updatedAt: new Date().toISOString(),
    createdBy: body.actor || "superadmin",
  };
  store.saveBlueprint(bp, body.actor || "superadmin");
  return NextResponse.json(bp, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    action?: "publish" | "archive" | "save";
    steps?: WorkflowStep[];
    name?: string;
    description?: string;
    actor?: string;
  };
  const existing = store.workflowBlueprints.find((x) => x.id === body.id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.action === "publish") {
    return NextResponse.json(store.publishBlueprint(body.id, body.actor || "superadmin"));
  }
  if (body.action === "archive") {
    existing.status = "archived";
    existing.updatedAt = new Date().toISOString();
    store.logAction("workflow.blueprint.archive", body.id, body.actor || "superadmin", "archived");
    return NextResponse.json(existing);
  }

  const next: WorkflowBlueprint = {
    ...existing,
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    steps: body.steps ?? existing.steps,
  };
  return NextResponse.json(store.saveBlueprint(next, body.actor || "superadmin"));
}
