import { NextResponse } from "next/server";
import { probeLive, store } from "@/lib/store";
import type { Overview } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const live = await probeLive();
  const failed = store.workflows.filter((w) => w.status === "failed").length;
  const online = store.providers.filter((p) => p.status === "online" || p.status === "sandbox").length;
  const aiReq = store.aiModels.reduce((s, m) => s + m.requests24h, 0);
  const vol = store.transactions
    .filter((t) => t.status === "settled")
    .reduce((s, t) => s + t.amountMinor, 0);
  const txFail = store.transactions.filter((t) => t.status === "failed").length;
  const txTotal = Math.max(store.transactions.length, 1);

  const recommendations: Overview["recommendations"] = [];


  if (store.providers.some((p) => p.status === "degraded")) {
    recommendations.push({
      id: "rec_provider",
      priority: "P1",
      title: "Provider degradation detected",
      detail: "One or more rails report degraded success/latency. Review Providers and shift traffic if needed.",
      actionLabel: "Open providers",
      actionId: "nav_providers",
    });
  }

  if (store.aiSubscriptions.some((s) => s.status === "past_due")) {
    recommendations.push({
      id: "rec_ai_billing",
      priority: "P1",
      title: "AI subscription past due",
      detail: "A partner AI plan is past due — suspend models or collect payment to protect margin.",
      actionLabel: "AI subscriptions",
      actionId: "nav_ai",
    });
  }

  recommendations.push({
    id: "rec_video",
    priority: "P2",
    title: "Enable video verification canary",
    detail: "Feature feat_video_verify is off. High-value receive authorisation can use in-app video like retail banks.",
    actionLabel: "Feature flags",
    actionId: "nav_features",
  });

  const body: Overview = {
    generatedAt: new Date().toISOString(),
    live: {
      payments: live.payments,
      ledger: live.ledger,
      voice: live.voice,
      temporalUi: live.temporalUi,
    },
    kpis: {
      activeUsers24h: store.devices.reduce((s, d) => s + d.activeToday, 0),
      txVolume24hMinor: vol + 2_450_000_00,
      txCount24h: 12840,
      failRate: (txFail / txTotal) * 100,
      openWorkflowErrors: failed,
      providersOnline: online,
      providersTotal: store.providers.length,
      aiRequests24h: aiReq,
      mandatesActive: store.mandates.filter((m) => m.status === "active").length,
    },
    recommendations,
  };

  return NextResponse.json(body);
}
