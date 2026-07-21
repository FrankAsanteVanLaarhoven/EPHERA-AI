/**
 * Hierarchical staff access control for Super Admin / ops.
 * Higher level inherits lower permissions unless explicitly denied.
 */

export type StaffRole =
  | "super_admin"
  | "admin"
  | "compliance_officer"
  | "risk_analyst"
  | "ops_manager"
  | "ops_agent"
  | "support_lead"
  | "support_agent"
  | "finance"
  | "read_only";

export type Permission =
  | "console.access"
  | "overview.view"
  | "workflows.view"
  | "workflows.control"
  | "features.view"
  | "features.edit"
  | "kill_switch"
  | "providers.view"
  | "providers.edit"
  | "provider_registry.view"
  | "provider_registry.approve"
  | "users.view"
  | "users.freeze"
  | "transactions.view"
  | "mandates.view"
  | "mandates.edit"
  | "comms.view"
  | "ai.view"
  | "ai.edit"
  | "security.view"
  | "security.edit"
  | "audit.view"
  | "staff.view"
  | "staff.manage"
  | "analytics.view";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** 100 = super admin, 10 = read only */
  level: number;
  department: string;
  status: "active" | "suspended" | "invited";
  reportsTo?: string;
  lastLoginAt?: string;
};

export const ROLE_LEVEL: Record<StaffRole, number> = {
  super_admin: 100,
  admin: 90,
  compliance_officer: 75,
  risk_analyst: 70,
  ops_manager: 65,
  finance: 60,
  ops_agent: 50,
  support_lead: 45,
  support_agent: 30,
  read_only: 10,
};

const ROLE_PERMS: Record<StaffRole, Permission[]> = {
  super_admin: [
    "console.access",
    "overview.view",
    "workflows.view",
    "workflows.control",
    "features.view",
    "features.edit",
    "kill_switch",
    "providers.view",
    "providers.edit",
    "provider_registry.view",
    "provider_registry.approve",
    "users.view",
    "users.freeze",
    "transactions.view",
    "mandates.view",
    "mandates.edit",
    "comms.view",
    "ai.view",
    "ai.edit",
    "security.view",
    "security.edit",
    "audit.view",
    "staff.view",
    "staff.manage",
    "analytics.view",
  ],
  admin: [
    "console.access",
    "overview.view",
    "workflows.view",
    "workflows.control",
    "features.view",
    "features.edit",
    "providers.view",
    "providers.edit",
    "provider_registry.view",
    "provider_registry.approve",
    "users.view",
    "users.freeze",
    "transactions.view",
    "mandates.view",
    "mandates.edit",
    "comms.view",
    "ai.view",
    "ai.edit",
    "security.view",
    "security.edit",
    "audit.view",
    "staff.view",
    "analytics.view",
  ],
  compliance_officer: [
    "console.access",
    "overview.view",
    "provider_registry.view",
    "provider_registry.approve",
    "users.view",
    "transactions.view",
    "security.view",
    "security.edit",
    "audit.view",
    "analytics.view",
  ],
  risk_analyst: [
    "console.access",
    "overview.view",
    "workflows.view",
    "users.view",
    "users.freeze",
    "transactions.view",
    "providers.view",
    "ai.view",
    "audit.view",
    "analytics.view",
  ],
  ops_manager: [
    "console.access",
    "overview.view",
    "workflows.view",
    "workflows.control",
    "providers.view",
    "providers.edit",
    "provider_registry.view",
    "users.view",
    "users.freeze",
    "transactions.view",
    "mandates.view",
    "mandates.edit",
    "comms.view",
    "staff.view",
    "analytics.view",
  ],
  ops_agent: [
    "console.access",
    "overview.view",
    "workflows.view",
    "providers.view",
    "users.view",
    "transactions.view",
    "mandates.view",
    "comms.view",
    "analytics.view",
  ],
  support_lead: [
    "console.access",
    "overview.view",
    "users.view",
    "users.freeze",
    "transactions.view",
    "comms.view",
    "security.view",
    "staff.view",
  ],
  support_agent: [
    "console.access",
    "overview.view",
    "users.view",
    "transactions.view",
    "comms.view",
  ],
  finance: [
    "console.access",
    "overview.view",
    "transactions.view",
    "mandates.view",
    "analytics.view",
    "audit.view",
  ],
  read_only: [
    "console.access",
    "overview.view",
    "analytics.view",
    "transactions.view",
  ],
};

export function permissionsFor(role: StaffRole): Permission[] {
  return ROLE_PERMS[role] || ROLE_PERMS.read_only;
}

export function can(role: StaffRole, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function canManageStaff(actor: StaffMember, target: StaffMember): boolean {
  if (!can(actor.role, "staff.manage")) return false;
  // Can only manage strictly lower hierarchy
  return actor.level > target.level;
}

export const SEED_STAFF: StaffMember[] = [
  {
    id: "staff_super",
    name: "Platform Super Admin",
    email: "superadmin@ephera.internal",
    role: "super_admin",
    level: 100,
    department: "Executive / Platform",
    status: "active",
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: "staff_admin",
    name: "Abena Mensah",
    email: "abena.admin@ephera.internal",
    role: "admin",
    level: 90,
    department: "Platform Ops",
    status: "active",
    reportsTo: "staff_super",
  },
  {
    id: "staff_compliance",
    name: "Kwame Osei",
    email: "kwame.compliance@ephera.internal",
    role: "compliance_officer",
    level: 75,
    department: "Compliance",
    status: "active",
    reportsTo: "staff_admin",
  },
  {
    id: "staff_risk",
    name: "Ngozi Okonkwo",
    email: "ngozi.risk@ephera.internal",
    role: "risk_analyst",
    level: 70,
    department: "Risk",
    status: "active",
    reportsTo: "staff_admin",
  },
  {
    id: "staff_ops_mgr",
    name: "David Kimani",
    email: "david.ops@ephera.internal",
    role: "ops_manager",
    level: 65,
    department: "Operations",
    status: "active",
    reportsTo: "staff_admin",
  },
  {
    id: "staff_ops",
    name: "Ama Boateng",
    email: "ama.ops@ephera.internal",
    role: "ops_agent",
    level: 50,
    department: "Operations",
    status: "active",
    reportsTo: "staff_ops_mgr",
  },
  {
    id: "staff_support_lead",
    name: "Fatima Diallo",
    email: "fatima.support@ephera.internal",
    role: "support_lead",
    level: 45,
    department: "Support",
    status: "active",
    reportsTo: "staff_ops_mgr",
  },
  {
    id: "staff_support",
    name: "John Tetteh",
    email: "john.support@ephera.internal",
    role: "support_agent",
    level: 30,
    department: "Support",
    status: "active",
    reportsTo: "staff_support_lead",
  },
  {
    id: "staff_finance",
    name: "Sara Adeyemi",
    email: "sara.finance@ephera.internal",
    role: "finance",
    level: 60,
    department: "Finance",
    status: "active",
    reportsTo: "staff_admin",
  },
  {
    id: "staff_ro",
    name: "Observer (Audit)",
    email: "observer@ephera.internal",
    role: "read_only",
    level: 10,
    department: "Audit",
    status: "active",
    reportsTo: "staff_compliance",
  },
];

/** Map nav tabs to required permission */
export const TAB_PERMISSION: Record<string, Permission> = {
  overview: "overview.view",
  workflows: "workflows.view",
  security: "security.view",
  analytics: "analytics.view",
  features: "features.view",
  providers: "providers.view",
  provider_registry: "provider_registry.view",
  users: "users.view",
  transactions: "transactions.view",
  mandates: "mandates.view",
  comms: "comms.view",
  ai: "ai.view",
  audit: "audit.view",
  staff: "staff.view",
};
