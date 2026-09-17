"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { Permission } from "@/config/rbac.config";
import type { AuthUser } from "@/lib/rbac";
import { can as rbacCan } from "@/lib/rbac";

interface AuthContextValue {
  user: AuthUser | null;
  permissions: Permission[];
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        setPermissions([]);
        return;
      }
      const data = (await res.json()) as {
        user: AuthUser;
        permissions: Permission[];
      };
      setUser(data.user);
      setPermissions(data.permissions ?? []);
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const logout = useCallback(async () => {
    setUser(null);
    setPermissions([]);
    // Full navigation clears cookie server-side (more reliable than fetch-only).
    window.location.assign("/api/auth/logout");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      loading,
      refresh,
      logout,
      can: (permission) => {
        if (permissions.length > 0) return permissions.includes(permission);
        return rbacCan(user, permission);
      },
    }),
    [user, permissions, loading, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
