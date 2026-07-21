import { NextResponse } from "next/server";
import {
  ROLE_LEVEL,
  SEED_STAFF,
  can,
  canManageStaff,
  permissionsFor,
  type StaffMember,
  type StaffRole,
} from "@/lib/rbac";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const staff: StaffMember[] = [...SEED_STAFF];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const asRole = (searchParams.get("asRole") as StaffRole) || "super_admin";
  const actorId = searchParams.get("actorId") || "staff_super";
  const actor = staff.find((s) => s.id === actorId) || staff[0];

  return NextResponse.json({
    hierarchy: Object.entries(ROLE_LEVEL)
      .sort((a, b) => b[1] - a[1])
      .map(([role, level]) => ({
        role,
        level,
        permissions: permissionsFor(role as StaffRole),
      })),
    actor: {
      ...actor,
      permissions: permissionsFor(actor.role),
      // also expose simulated role switch for demo
      simulatedRole: asRole,
      simulatedPermissions: permissionsFor(asRole),
    },
    items: staff.map((s) => ({
      ...s,
      permissions: permissionsFor(s.role),
      canBeManagedByActor: canManageStaff(actor, s),
    })),
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    actorId?: string;
    targetId: string;
    role?: StaffRole;
    status?: StaffMember["status"];
  };
  const actor = staff.find((s) => s.id === (body.actorId || "staff_super")) || staff[0];
  const target = staff.find((s) => s.id === body.targetId);
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!can(actor.role, "staff.manage")) {
    return NextResponse.json({ error: "forbidden", reason: "staff.manage required" }, { status: 403 });
  }
  if (!canManageStaff(actor, target) && target.id !== actor.id) {
    // allow status self? no — only higher can manage
    if (body.role || (body.status && body.status !== target.status)) {
      if (actor.level <= target.level) {
        return NextResponse.json(
          { error: "forbidden", reason: "cannot manage equal_or_higher_level" },
          { status: 403 },
        );
      }
    }
  }

  if (body.role) {
    if (ROLE_LEVEL[body.role] >= actor.level) {
      return NextResponse.json(
        { error: "forbidden", reason: "cannot assign role at or above your level" },
        { status: 403 },
      );
    }
    target.role = body.role;
    target.level = ROLE_LEVEL[body.role];
  }
  if (body.status) target.status = body.status;

  store.logAction(
    "staff.update",
    target.id,
    actor.email,
    JSON.stringify({ role: target.role, status: target.status }),
  );

  return NextResponse.json({
    ...target,
    permissions: permissionsFor(target.role),
  });
}
