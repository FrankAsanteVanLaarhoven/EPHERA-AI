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
