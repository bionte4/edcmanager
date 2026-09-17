"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SLA_PROFILE_LABELS,
  type SlaProfile,
  type TicketCategoryDef,
} from "@/config/ticket-category.config";

const emptyForm = {
  code: "",
  label: "",
  slaProfile: "NON_VIP" as SlaProfile,
  description: "",
  sortOrder: 100,
  isActive: true,
};

export function TicketCategoriesModule() {
  const { can } = useAuth();
  const canManage = can("category:manage");
  const [categories, setCategories] = useState<TicketCategoryDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/categories", { cache: "no-store" });
    const data = (await res.json()) as {
      categories?: TicketCategoryDef[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat kategori");
      return;
    }
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(c: TicketCategoryDef) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      label: c.label,
      slaProfile: c.slaProfile,
      description: c.description ?? "",
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setMessage(null);

    const payload = {
      code: form.code,
      label: form.label,
      slaProfile: form.slaProfile,
      description: form.description || undefined,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    };

    const res = editingId
      ? await fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    setMessage(editingId ? "Kategori diperbarui." : "Kategori ditambahkan.");
    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!canManage) return;
    if (!window.confirm("Hapus kategori ini?")) return;
    setError(null);
    const res = await fetch(`/api/categories?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage("Kategori dihapus.");
    if (editingId === id) resetForm();
    await load();
  }

  async function onResetDefaults() {
    if (!canManage) return;
    if (!window.confirm("Reset semua kategori ke default (VIP / Non-VIP)?")) return;
    setError(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal reset");
      return;
    }
    setMessage("Kategori di-reset ke default.");
    resetForm();
    await load();
  }

  if (!can("category:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses membaca kategori tiket.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Setiap kategori memetakan ke profil SLA <strong>VIP</strong> (ketat, peak
        Dalam Kota 2 jam) atau <strong>NON_VIP</strong> (standar). Kode disimpan di
        tiket; ubah label/profil tanpa mengubah kode yang sudah dipakai.
      </p>

      {canManage && (
        <form
          onSubmit={onSubmit}
          className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="flex flex-col gap-1 text-xs">
            Kode
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono uppercase"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="GOLD"
              required
              disabled={!!editingId && (form.code === "VIP" || form.code === "NON_VIP")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Label
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Gold Merchant"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Profil SLA
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.slaProfile}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slaProfile: e.target.value as SlaProfile,
                }))
              }
            >
              {(Object.keys(SLA_PROFILE_LABELS) as SlaProfile[]).map((p) => (
                <option key={p} value={p}>
                  {SLA_PROFILE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            Deskripsi
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Opsional"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Urutan
            <input
              type="number"
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-xs self-end pb-1.5">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            Aktif (muncul di form tiket)
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" size="sm">
              {editingId ? (
                <>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Simpan
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
                </>
              )}
            </Button>
            {editingId && (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onResetDefaults()}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset default
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Profil SLA</TableHead>
              <TableHead>Urutan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deskripsi</TableHead>
              {canManage && <TableHead className="w-[100px]">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Belum ada kategori.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {c.code}
                  </TableCell>
                  <TableCell>{c.label}</TableCell>
                  <TableCell>
                    <Badge variant={c.slaProfile === "VIP" ? "default" : "secondary"}>
                      {c.slaProfile}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "safe" : "secondary"}>
                      {c.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {c.description || "—"}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={c.code === "VIP" || c.code === "NON_VIP"}
                          onClick={() => void onDelete(c.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
