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
  VENDOR_TYPE_LABELS,
  VENDOR_TYPES,
  type VendorDef,
  type VendorType,
} from "@/config/vendor.config";

const emptyForm = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  type: "FMS" as VendorType,
  allocationQuota: 0,
  isActive: true,
};

export function VendorsModule() {
  const { can } = useAuth();
  const canManage = can("vendor:manage");
  const [vendors, setVendors] = useState<VendorDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/vendors", { cache: "no-store" });
    const data = (await res.json()) as {
      vendors?: VendorDef[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat vendor");
      return;
    }
    setVendors(data.vendors ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(v: VendorDef) {
    setEditingId(v.id);
    setForm({
      name: v.name,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      type: v.type,
      allocationQuota: v.allocationQuota,
      isActive: v.isActive,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setMessage(null);

    const payload = {
      name: form.name,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      type: form.type,
      allocationQuota: Number(form.allocationQuota),
      isActive: form.isActive,
    };

    const res = editingId
      ? await fetch("/api/vendors", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    setMessage(editingId ? "Vendor diperbarui." : "Vendor ditambahkan.");
    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!canManage) return;
    if (
      !window.confirm(
        "Hapus vendor? Jika masih punya unit/tiket/metrik, akan dinonaktifkan saja."
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/vendors?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage(data.message || "Vendor dihapus.");
    if (editingId === id) resetForm();
    await load();
  }

  async function onResetDefaults() {
    if (!canManage) return;
    if (
      !window.confirm(
        "Reset Vendor 1 & Vendor 2 ke default seed (kontak, kuota, tipe)?"
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal reset");
      return;
    }
    setMessage("Vendor seed di-reset ke default.");
    resetForm();
    await load();
  }

  if (!can("vendor:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses membaca master vendor.
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
        Master vendor untuk alokasi kuota deployment, kontak operasional, dan tipe
        (Distributor / FMS). Nama aktif dipakai di form inventori &amp; tiket.
      </p>

      {canManage && (
        <form
          onSubmit={onSubmit}
          className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="flex flex-col gap-1 text-xs">
            Nama
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Vendor 3"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Tipe
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as VendorType }))
              }
            >
              {VENDOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {VENDOR_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Alokasi kuota (unit)
            <input
              type="number"
              min={0}
              step={1}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
              value={form.allocationQuota}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  allocationQuota: Number(e.target.value),
                }))
              }
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Nama kontak
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.contactName}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactName: e.target.value }))
              }
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Email kontak
            <input
              type="email"
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.contactEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactEmail: e.target.value }))
              }
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Telepon kontak
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.contactPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPhone: e.target.value }))
              }
              required
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
            Aktif (muncul di dropdown inventori / tiket)
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
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset seed v1/v2
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Kuota</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-[100px]">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Belum ada vendor.
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{VENDOR_TYPE_LABELS[v.type]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {v.allocationQuota.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{v.contactName}</div>
                    <div className="text-muted-foreground">{v.contactEmail}</div>
                    <div className="text-muted-foreground">{v.contactPhone}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.isActive ? "safe" : "secondary"}>
                      {v.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(v)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => void onDelete(v.id)}
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
