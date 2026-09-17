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
  "inventory:read",
  "inventory:mutate",
  "vendor:read",
  "vendor:manage",
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

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: ALL,
  OPS_MANAGER: [
    "dashboard:read",
    "ticket:read",
    "ticket:create",
    "ticket:update",
    "ticket:assign",
    "ticket:close",
    "noc:read",
    "noc:manage_shift",
    "inventory:read",
    "inventory:mutate",
    "vendor:read",
    "vendor:manage",
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
    "inventory:read",
    "inventory:mutate",
    "vendor:read",
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
    "inventory:read",
    "inventory:mutate",
    "vendor:read",
  ],
  VENDOR_TECH: [
    "dashboard:read",
    "ticket:read",
    "ticket:update",
    "inventory:read",
    "vendor:read",
  ],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  NOC: "NOC",
  SUPERVISOR: "Supervisor",
  VENDOR_TECH: "Vendor Tech",
  OPS_MANAGER: "Ops Manager",
};

export const DEMO_PASSWORD = "edc123";
