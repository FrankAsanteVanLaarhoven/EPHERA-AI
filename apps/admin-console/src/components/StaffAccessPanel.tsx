"use client";

import { useCallback, useEffect, useState } from "react";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  level: number;
  department: string;
  status: string;
  reportsTo?: string;
  permissions: string[];
  canBeManagedByActor: boolean;
};

type HierarchyRow = {
  role: string;
  level: number;
  permissions: string[];
};

export function StaffAccessPanel({ flash }: { flash: (m: string) => void }) {
  const [items, setItems] = useState<StaffRow[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyRow[]>([]);
  const [actor, setActor] = useState<{
    id: string;
    name: string;
    role: string;
    level: number;
    permissions: string[];
  } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/staff?actorId=staff_super");
    const j = await r.json();
    setItems(j.items || []);
    setHierarchy(j.hierarchy || []);
    setActor(j.actor || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(targetId: string, role: string) {
    const r = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorId: "staff_super", targetId, role }),
    });
    const j = await r.json();
    if (!r.ok) {
      flash(j.reason || j.error || "Forbidden");
      return;
    }
    flash(`Role updated → ${role}`);
    void load();
  }

  async function setStatus(targetId: string, status: string) {
    const r = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorId: "staff_super", targetId, status }),
    });
    if (!r.ok) {
      const j = await r.json();
      flash(j.reason || "Forbidden");
      return;
    }
    flash(`Status → ${status}`);
    void load();
  }

  const byManager = (id?: string) => items.filter((s) => s.reportsTo === id);

  function Tree({ managerId, depth = 0 }: { managerId?: string; depth?: number }) {
    const kids = managerId
      ? byManager(managerId)
      : items.filter((s) => !s.reportsTo);
    return (
      <ul style={{ listStyle: "none", margin: 0, paddingLeft: depth ? 18 : 0 }}>
        {kids.map((s) => (
          <li key={s.id} style={{ marginBottom: 8 }}>
            <div
              className="card"
              style={{ padding: "10px 12px", marginBottom: 6 }}
            >
              <strong>
                L{s.level} · {s.name}
              </strong>{" "}
              <span className="tag info">{s.role}</span>{" "}
              <span className={`tag ${s.status === "active" ? "active" : "warn"}`}>{s.status}</span>
              <div className="msg">
                {s.department} · {s.email}
              </div>
            </div>
            <Tree managerId={s.id} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="stack-lg">
      <div className="card glass-hero">
        <h3 className="section-title">Staff access control · hierarchy</h3>
        <p className="lede">
          Role-based access with numeric levels (100 Super Admin → 10 Read-only). Staff can only
          manage <strong>strictly lower</strong> levels. Tabs and kill switches require matching
          permissions.
        </p>
        {actor && (
          <p className="msg">
            Acting as <strong>{actor.name}</strong> ({actor.role} · L{actor.level}) ·{" "}
            {actor.permissions.length} permissions
          </p>
        )}
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Org hierarchy</h3>
          <Tree />
        </div>
        <div className="card">
          <h3 className="section-title">Role ladder & permissions</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Role</th>
                  <th># Perms</th>
                  <th>Sample</th>
                </tr>
              </thead>
              <tbody>
                {hierarchy.map((h) => (
                  <tr key={h.role}>
                    <td className="mono">{h.level}</td>
                    <td>
                      <span className="tag info">{h.role}</span>
                    </td>
                    <td>{h.permissions.length}</td>
                    <td className="msg mono">{h.permissions.slice(0, 4).join(", ")}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Directory · manage lower levels</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Level</th>
                <th>Role</th>
                <th>Status</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="msg">{s.email}</div>
                  </td>
                  <td className="mono">L{s.level}</td>
                  <td>{s.role}</td>
                  <td>
                    <span className={`tag ${s.status === "active" ? "active" : "warn"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.role === "super_admin" ? (
                      <span className="msg">root</span>
                    ) : (
                      <div className="actions">
                        <select
                          defaultValue={s.role}
                          onChange={(e) => void setRole(s.id, e.target.value)}
                          style={{ maxWidth: 160 }}
                        >
                          {[
                            "admin",
                            "compliance_officer",
                            "risk_analyst",
                            "ops_manager",
                            "ops_agent",
                            "support_lead",
                            "support_agent",
                            "finance",
                            "read_only",
                          ].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => void setStatus(s.id, "suspended")}
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void setStatus(s.id, "active")}
                        >
                          Activate
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
