import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: store.actions.slice(0, 50) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: string;
    target?: string;
    actor?: string;
    payload?: Record<string, unknown>;
  };
  const actor = body.actor || "superadmin";
  const target = body.target || "platform";

  switch (body.action) {
    case "kill_switch_payments": {
      store.setFeature("feat_voice_send", { enabled: false, rolloutPercent: 0 }, actor);
      store.setFeature("feat_pwa_send", { enabled: false, rolloutPercent: 0 }, actor);
      store.logAction("kill_switch.payments", target, actor, "Voice + PWA send disabled");
      return NextResponse.json({ ok: true, message: "Payment kill switch engaged" });
    }
    case "resume_payments": {
      store.setFeature("feat_voice_send", { enabled: true, rolloutPercent: 100 }, actor);
      store.setFeature("feat_pwa_send", { enabled: true, rolloutPercent: 100 }, actor);
      store.logAction("kill_switch.resume", target, actor, "Voice + PWA send resumed");
      return NextResponse.json({ ok: true, message: "Payments resumed" });
    }
    case "enable_video_verify": {
      store.setFeature("feat_video_verify", { enabled: true, rolloutPercent: 10 }, actor);
      store.logAction("feature.canary", "feat_video_verify", actor, "10% canary");
      return NextResponse.json({ ok: true, message: "Video verification canary 10%" });
    }
    case "note": {
      store.logAction("note", target, actor, String(body.payload?.text || "note"));
      return NextResponse.json({ ok: true });
    }
    default:
      store.logAction(body.action, target, actor, JSON.stringify(body.payload || {}));
      return NextResponse.json({ ok: true, message: "Action recorded" });
  }
}
