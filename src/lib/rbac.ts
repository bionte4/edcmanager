import {
  ROLE_PERMISSIONS,
  type AppRole,
  type Permission,
} from "@/config/rbac.config";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  isActive: boolean;
}

export function permissionsForRole(role: AppRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function can(
  user: Pick<AuthUser, "role" | "isActive"> | null | undefined,
  permission: Permission
): boolean {
  if (!user || !user.isActive) return false;
  return permissionsForRole(user.role).includes(permission);
}

export function canAny(
  user: Pick<AuthUser, "role" | "isActive"> | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => can(user, p));
}

export function assertCan(
  user: Pick<AuthUser, "role" | "isActive"> | null | undefined,
  permission: Permission
): void {
  if (!can(user, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
