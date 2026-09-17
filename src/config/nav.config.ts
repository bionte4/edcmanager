/**
 * Navigation IA — hubs + primary-per-role.
 * Item visibility still gated by RBAC permissions (AppShell + middleware).
 */

import type { AppRole, Permission } from "@/config/rbac.config";

export type NavIcon =
  | "dashboard"
  | "executive"
  | "ticket"
  | "workforce"
  | "inventory"
  | "reporting"
  | "vendor"
  | "config"
  | "integration"
  | "admin"
  | "bell"
  | "noc"
  | "wfm"
  | "ola"
  | "category"
  | "boxes"
  | "plug"
  | "package";

export type NavPlacement = "primary" | "secondary" | "header";

export interface NavItemDef {
  id: string;
  href: string;
  label: string;
  shortLabel?: string;
  icon: NavIcon;
  /** Single permission, or any-of for hubs. */
  permission?: Permission;
  anyOf?: readonly Permission[];
  placement: NavPlacement;
  /** Section label in drawer / Lainnya */
  group: "ops" | "logistik" | "laporan" | "sistem";
}

/** Desktop strip + mobile drawer (notifications live in header bell). */
export const NAV_ITEMS: readonly NavItemDef[] = [
  {
    id: "dashboard",
    href: "/",
    label: "Dasbor",
    shortLabel: "Home",
    icon: "dashboard",
    permission: "dashboard:read",
    placement: "primary",
    group: "ops",
  },
  {
    id: "executive",
    href: "/executive",
    label: "Executive",
    shortLabel: "Exec",
    icon: "executive",
    permission: "executive:read",
    placement: "primary",
    group: "laporan",
  },
  {
    id: "ticketing",
    href: "/ticketing",
    label: "Tiket",
    shortLabel: "Tiket",
    icon: "ticket",
    permission: "ticket:read",
    placement: "primary",
    group: "ops",
  },
  {
    id: "workforce",
    href: "/workforce",
    label: "Workforce",
    shortLabel: "WFM",
    icon: "workforce",
    anyOf: ["noc:read", "wfm:read"],
    placement: "primary",
    group: "ops",
  },
  {
    id: "inventory",
    href: "/inventory",
    label: "Inventori",
    shortLabel: "Stock",
    icon: "inventory",
    permission: "inventory:read",
    placement: "primary",
    group: "logistik",
  },
  {
    id: "reporting",
    href: "/reporting",
    label: "Pelaporan",
    shortLabel: "Report",
    icon: "reporting",
    permission: "report:read",
    placement: "primary",
    group: "laporan",
  },
  {
    id: "vendor",
    href: "/evaluasi-vendor",
    label: "Vendor",
    shortLabel: "Vendor",
    icon: "vendor",
    permission: "vendor:read",
    placement: "secondary",
    group: "logistik",
  },
  {
    id: "config",
    href: "/config",
    label: "Konfigurasi",
    shortLabel: "Config",
    icon: "config",
    anyOf: ["ola:read", "category:read"],
    placement: "secondary",
    group: "sistem",
  },
  {
    id: "integration",
    href: "/integration",
    label: "Integrasi",
    shortLabel: "API",
    icon: "integration",
    permission: "integration:read",
    placement: "secondary",
    group: "sistem",
  },
  {
    id: "admin",
    href: "/admin/users",
    label: "Admin Users",
    shortLabel: "Admin",
    icon: "admin",
    permission: "admin:access",
    placement: "secondary",
    group: "sistem",
  },
  {
    id: "notifications",
    href: "/notifications",
    label: "Notifikasi",
    shortLabel: "Notif",
    icon: "bell",
    permission: "notification:read",
    placement: "header",
    group: "sistem",
  },
] as const;

export const NAV_GROUP_LABELS: Record<NavItemDef["group"], string> = {
  ops: "Operasi",
  logistik: "Logistik",
  laporan: "Laporan",
  sistem: "Sistem",
};

/**
 * Bottom-bar / compact primary order per role.
 * Falls back to first allowed primary items.
 */
export const ROLE_PRIMARY_HREFS: Record<AppRole, readonly string[]> = {
  NOC: ["/", "/ticketing", "/workforce"],
  SUPERVISOR: ["/", "/ticketing", "/workforce", "/inventory"],
  OPS_MANAGER: ["/", "/ticketing", "/inventory", "/reporting"],
  VENDOR_TECH: ["/", "/ticketing", "/inventory"],
  GM: ["/", "/executive", "/reporting", "/evaluasi-vendor"],
  ADMIN: ["/", "/ticketing", "/workforce", "/inventory"],
};

export function canAccessNavItem(
  item: NavItemDef,
  can: (p: Permission) => boolean
): boolean {
  if (item.anyOf?.length) return item.anyOf.some((p) => can(p));
  if (item.permission) return can(item.permission);
  return false;
}
