/**
 * RBAC permission catalog & default role grants.
 * Keep keys stable — UI and API guard with `can(user, permission)`.
 * Later these can be loaded from Prisma RolePermission instead of this map.
 */

export const PERMISSIONS = [
  "dashboard:read",
  "executive:read",
  "ticket:read",
  "ticket:create",
  "ticket:update",
  "ticket:assign",
  "ticket:close",
  "ticket:sla_pause",
  "noc:read",
  "noc:manage_shift",
  "wfm:read",
  "wfm:approve",
  "inventory:read",
  "inventory:mutate",
  "vendor:read",
  "vendor:manage",
  "notification:read",
  "integration:read",
  "ola:read",
  "ola:manage",
  "category:read",
  "category:manage",
  "location:read",
  "location:manage",
  "report:read",
  "report:export",
  "user:read",
  "user:manage",
  "config:manage",
  "audit:read",
  "admin:access",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type AppRole =
  | "ADMIN"
  | "NOC"
  | "SUPERVISOR"
  | "VENDOR_TECH"
  | "OPS_MANAGER"
  | "GM";

const ALL: Permission[] = [...PERMISSIONS];

/**
 * Nav matrix (hubs — lihat `nav.config.ts`):
 * | Role         | Primary strip |
 * | ADMIN        | Dasbor, Tiket, Workforce, Inventori + Lainnya (config/API/admin) |
 * | GM           | Dasbor, Executive, Pelaporan, Vendor |
 * | OPS_MANAGER  | Dasbor, Tiket, Inventori, Pelaporan + Executive/Config |
 * | SUPERVISOR   | Dasbor, Tiket, Workforce, Inventori |
 * | NOC (L1)     | Dasbor, Tiket, Workforce (tab NOC) · notif di header |
 * | VENDOR_TECH  | Dasbor, Tiket, Inventori |
 *
 * Hubs: /inventory · /workforce · /config · /vendors — tab di dalamnya tetap RBAC per modul CRUD.
 * Notifikasi: icon bell di header (bukan strip menu).
 */
export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: ALL,
  GM: [
    "dashboard:read",
    "executive:read",
    "vendor:read",
    "report:read",
    "report:export",
    "notification:read",
  ],
  OPS_MANAGER: [
    "dashboard:read",
    "executive:read",
    "ticket:read",
    "ticket:create",
    "ticket:update",
    "ticket:assign",
    "ticket:close",
    "ticket:sla_pause",
    "wfm:read",
    "wfm:approve",
    "inventory:read",
    "inventory:mutate",
    "vendor:read",
    "vendor:manage",
    "notification:read",
    "ola:read",
    "ola:manage",
    "category:read",
    "category:manage",
    "location:read",
    "location:manage",
    "report:read",
    "report:export",
    "user:read",
    "audit:read",
  ],
  SUPERVISOR: [
    "dashboard:read",
    "ticket:read",
    "ticket:create",
    "ticket:update",
    "ticket:assign",
    "ticket:close",
    "ticket:sla_pause",
    "noc:read",
    "noc:manage_shift",
    "wfm:read",
    "wfm:approve",
    "inventory:read",
    "inventory:mutate",
    "vendor:read",
    "notification:read",
    "ola:read",
    "category:read",
    "location:read",
    "report:read",
    "report:export",
    "user:read",
  ],
  NOC: [
    "dashboard:read",
    "ticket:read",
    "ticket:create",
    "ticket:update",
    "ticket:assign",
    "ticket:sla_pause",
    "noc:read",
    "vendor:read",
    "notification:read",
    "category:read",
    "location:read",
  ],
  VENDOR_TECH: [
    "dashboard:read",
    "ticket:read",
    "ticket:update",
    "inventory:read",
    "vendor:read",
    "category:read",
    "location:read",
  ],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  NOC: "NOC / L1",
  SUPERVISOR: "Supervisor",
  VENDOR_TECH: "Vendor Tech",
  OPS_MANAGER: "Ops Manager",
  GM: "GM / BOD",
};

/** Page path prefix → required permission (first match wins). */
export const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  /** Require this single permission. */
  permission?: Permission;
  /** Or any of these (hubs). */
  anyOf?: readonly Permission[];
}> = [
  { prefix: "/admin", permission: "admin:access" },
  { prefix: "/api/admin", permission: "admin:access" },
  { prefix: "/integration", permission: "integration:read" },
  { prefix: "/notifications", permission: "notification:read" },
  { prefix: "/inventory", permission: "inventory:read" },
  { prefix: "/buffer-stock", permission: "inventory:read" },
  { prefix: "/peripherals", permission: "inventory:read" },
  { prefix: "/api/peripherals", permission: "inventory:read" },
  { prefix: "/assets", permission: "inventory:read" },
  { prefix: "/api/assets", permission: "inventory:read" },
  { prefix: "/evaluasi-vendor", permission: "vendor:read" },
  { prefix: "/vendors", permission: "vendor:read" },
  { prefix: "/api/vendors", permission: "vendor:read" },
  { prefix: "/ticketing", permission: "ticket:read" },
  { prefix: "/ops/near-breach", permission: "ticket:read" },
  { prefix: "/api/ops/near-breach", permission: "ticket:read" },
  { prefix: "/reporting", permission: "report:read" },
  { prefix: "/api/reporting", permission: "report:read" },
  { prefix: "/executive", permission: "executive:read" },
  { prefix: "/config", anyOf: ["ola:read", "category:read", "location:read"] },
  { prefix: "/ola", permission: "ola:read" },
  { prefix: "/api/ola", permission: "ola:read" },
  { prefix: "/categories", permission: "category:read" },
  { prefix: "/api/categories", permission: "category:read" },
  { prefix: "/locations", permission: "location:read" },
  { prefix: "/api/locations", permission: "location:read" },
  { prefix: "/workforce", anyOf: ["noc:read", "wfm:read"] },
  { prefix: "/wfm", permission: "wfm:read" },
  { prefix: "/api/wfm", permission: "wfm:read" },
  { prefix: "/noc", permission: "noc:read" },
];

export const DEMO_PASSWORD = "edc123";
