"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEMO_PASSWORD,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type AppRole,
} from "@/config/rbac.config";
import { useAuth } from "@/components/auth/auth-provider";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
}

const ROLES: AppRole[] = ["ADMIN", "OPS_MANAGER", "SUPERVISOR", "NOC", "VENDOR_TECH"];

export function AdminUsersModule() {
  const { can } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("NOC");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = (await res.json()) as { users?: AdminUserRow[]; error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal memuat users");
      return;
    }
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPhone("");
    setRole("NOC");
    setPassword(DEMO_PASSWORD);
    setIsActive(true);
  }

  function startEdit(user: AdminUserRow) {
    setEditingId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setRole(user.role);
    setPassword("");
    setIsActive(user.isActive);
    setMessage(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const payload = {
      id: editingId ?? undefined,
      name,
      email,
      phone,
      role,
      isActive,
      ...(password ? { password } : {}),
    };

    const res = await fetch("/api/admin/users", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    setMessage(editingId ? "User diperbarui." : "User dibuat.");
    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!confirm("Soft-delete user ini?")) return;
    setError(null);
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menghapus");
      return;
    }
    setMessage("User di-nonaktifkan (soft delete).");
    if (editingId === id) resetForm();
    await load();
  }

  if (!can("user:manage")) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Anda tidak punya permission <span className="font-mono">user:manage</span>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Edit User" : "Create User"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={onSubmit}>
              <Field label="Nama">
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email">
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Telepon">
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Role">
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={editingId ? "Password baru (opsional)" : "Password"}>
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingId ? "Kosongkan jika tidak diubah" : DEMO_PASSWORD}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Aktif
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">{editingId ? "Update" : "Create"}</Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Batal
                  </Button>
                )}
              </div>
              {message && <p className="text-xs text-sla-safe">{message}</p>}
              {error && <p className="text-xs text-sla-breached">{error}</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-4 w-4" />
              Role → Permissions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Matrix default dari config RBAC (nanti bisa dari tabel RolePermission)
            </p>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-3 overflow-auto">
            {ROLES.map((r) => (
              <div key={r} className="rounded-md border border-border p-2.5">
                <p className="mb-1.5 text-xs font-semibold">{ROLE_LABELS[r]}</p>
                <div className="flex flex-wrap gap-1">
                  {ROLE_PERMISSIONS[r].map((p) => (
                    <Badge key={p} variant="secondary" className="font-mono text-[10px]">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold tracking-wide">User Directory</h2>
          <p className="text-xs text-muted-foreground">CRUD + soft delete · guarded by user:manage</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="font-mono text-xs">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "safe" : "breached"}>
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(user)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onDelete(user.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
