import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    questions: store.securityQuestions,
    challenges: store.securityChallenges,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "create_question" | "issue_challenge";
    prompt?: string;
    category?: "identity" | "device" | "transaction" | "recovery" | "ops";
    requiredFor?: string[];
    minAnswerLength?: number;
    userId?: string;
    userName?: string;
    questionId?: string;
    purpose?: string;
    actor?: string;
  };

  if (body.action === "create_question") {
    if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
    const q = store.addSecurityQuestion(
      {
        prompt: body.prompt,
        category: body.category || "identity",
        requiredFor: body.requiredFor || ["step_up"],
        active: true,
        minAnswerLength: body.minAnswerLength || 2,
      },
      body.actor || "superadmin",
    );
    return NextResponse.json(q, { status: 201 });
  }

  if (body.action === "issue_challenge") {
    const q = store.securityQuestions.find((x) => x.id === body.questionId);
    if (!q || !body.userId) {
      return NextResponse.json({ error: "questionId and userId required" }, { status: 400 });
    }
    const c = store.issueChallenge(
      {
        userId: body.userId,
        userName: body.userName || body.userId,
        questionId: q.id,
        questionPrompt: q.prompt,
        purpose: body.purpose || "manual_ops_challenge",
      },
      body.actor || "superadmin",
    );
    return NextResponse.json(c, { status: 201 });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    kind: "question" | "challenge";
    id: string;
    active?: boolean;
    status?: "pending" | "passed" | "failed" | "expired";
    actor?: string;
  };

  if (body.kind === "question") {
    const q = store.setSecurityQuestion(
      body.id,
      typeof body.active === "boolean" ? { active: body.active } : {},
      body.actor || "superadmin",
    );
    if (!q) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(q);
  }

  if (body.kind === "challenge" && body.status) {
    const c = store.resolveChallenge(body.id, body.status, body.actor || "superadmin");
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(c);
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
