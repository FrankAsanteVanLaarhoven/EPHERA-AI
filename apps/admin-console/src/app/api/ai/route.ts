import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    models: store.aiModels,
    subscriptions: store.aiSubscriptions,
    actions: store.actions.filter((a) => a.action.startsWith("ai.")).slice(0, 20),
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    status: "active" | "canary" | "disabled" | "training";
    actor?: string;
  };
  const m = store.setAiModelStatus(body.id, body.status, body.actor || "superadmin");
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(m);
}
