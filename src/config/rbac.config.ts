/**
 * RBAC permission catalog & default role grants.
 * Keep keys stable — UI and API guard with `can(user, permission)`.
 * Later these can be loaded from Prisma RolePermission instead of this map.
 */

export const PERMISSIONS = [
  "dashboard:read",
  "ticket:read",
  "ticket:create",
  "ticket:update",
  "ticket:assign",
  "ticket:close",
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
  | "OPS_MANAGER";

const ALL: Permission[] = [...PERMISSIONS];

/**
 * Nav matrix (distinct per role):
 * | Role         | Menu |
 * | ADMIN        | semua + Integration + Admin Users |
 * | OPS_MANAGER  | Dashboard, Ticketing, Assets, Buffer, Vendor, Notifications, WFM, OLA, Reporting |
 * | SUPERVISOR   | Dashboard, Ticketing, NOC, WFM, Assets, Buffer, Notifications, OLA read, Reporting |
 * | NOC (L1)     | Dashboard, Ticketing, NOC, WFM, Notifications, OLA read |
 * | VENDOR_TECH  | Dashboard, Ticketing, Assets, Buffer Stock |
 */
export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: ALL,
  OPS_MANAGER: [
    "dashboard:read",
    "ticket:read",
    "ticket:create",
    "ticket:update",
    "ticket:assign",
    "ticket:close",
    "wfm:read",
    "wfm:approve",
    "inventory:read",
    "inventory:mutate",
    "vendor:read",
    "vendor:manage",
    "notification:read",
    "ola:read",
    "ola:manage",
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
    "noc:read",
    "noc:manage_shift",
    "wfm:read",
    "wfm:approve",
    "inventory:read",
    "inventory:mutate",
    "notification:read",
    "ola:read",
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
    "noc:read",
    "noc:manage_shift",
    "wfm:read",
    "notification:read",
    "ola:read",
  ],
  VENDOR_TECH: [
    "dashboard:read",
    "ticket:read",
    "ticket:update",
    "inventory:read",
  ],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  NOC: "NOC / L1",
  SUPERVISOR: "Supervisor",
  VENDOR_TECH: "Vendor Tech",
  OPS_MANAGER: "Ops Manager",
};

/** Page path prefix → required permission (first match wins). */
export const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  permission: Permission;
}> = [
  { prefix: "/admin", permission: "admin:access" },
  { prefix: "/api/admin", permission: "admin:access" },
  { prefix: "/integration", permission: "integration:read" },
  { prefix: "/notifications", permission: "notification:read" },
  { prefix: "/buffer-stock", permission: "inventory:read" },
  { prefix: "/assets", permission: "inventory:read" },
  { prefix: "/api/assets", permission: "inventory:read" },
  { prefix: "/evaluasi-vendor", permission: "vendor:read" },
  { prefix: "/ticketing", permission: "ticket:read" },
  { prefix: "/reporting", permission: "report:read" },
  { prefix: "/api/reporting", permission: "report:read" },
  { prefix: "/ola", permission: "ola:read" },
  { prefix: "/api/ola", permission: "ola:read" },
  { prefix: "/wfm", permission: "wfm:read" },
  { prefix: "/api/wfm", permission: "wfm:read" },
  { prefix: "/noc", permission: "noc:read" },
];

export const DEMO_PASSWORD = "edc123";
