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
import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  SLA_ZONE_LABELS,
  SLA_ZONES,
  isZoneAlias,
  type LocationDef,
  type SlaZone,
} from "@/config/location.config";

const emptyForm = {
  code: "",
  label: "",
  slaZone: "DALAM_KOTA" as SlaZone,
  regionalOffice: "",
  description: "",
  sortOrder: 100,
  isActive: true,
  isTicketSelectable: true,
};

export function LocationsModule() {
  const { can } = useAuth();
  const canManage = can("location:manage");
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/locations", { cache: "no-store" });
    const data = (await res.json()) as {
      locations?: LocationDef[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat lokasi");
      return;
    }
    setLocations(data.locations ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(c: LocationDef) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      label: c.label,
      slaZone: c.slaZone,
      regionalOffice: c.regionalOffice ?? "",
      description: c.description ?? "",
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      isTicketSelectable: c.isTicketSelectable,
    });
  }

  const editingAlias =
    !!editingId &&
    isZoneAlias({
      code: form.code,
      slaZone: form.slaZone,
      isTicketSelectable: form.isTicketSelectable,
    });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setMessage(null);

    const payload = {
      code: form.code,
      label: form.label,
      slaZone: form.slaZone,
      regionalOffice: form.regionalOffice || null,
      description: form.description || undefined,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
      isTicketSelectable: form.isTicketSelectable,
    };

    const res = editingId
      ? await fetch("/api/locations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    setMessage(editingId ? "Lokasi diperbarui." : "Lokasi ditambahkan.");
    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!canManage) return;
    if (
      !window.confirm(
        "Hapus lokasi? Jika masih dipakai tiket, akan dinonaktifkan saja."
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/locations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage(data.message || "Lokasi dihapus.");
    if (editingId === id) resetForm();
    await load();
  }

  async function onResetDefaults() {
    if (!canManage) return;
    if (
      !window.confirm(
        "Reset semua lokasi ke default (3 zona + contoh kota)?"
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal reset");
      return;
    }
    setMessage("Lokasi di-reset ke default.");
    resetForm();
    await load();
  }

  if (!can("location:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses membaca master lokasi.
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
        <strong>Site operasional</strong> (kota/area + RO) dipilih di form tiket.
        Alias zona (DALAM_KOTA / …) hanya untuk OLA/legacy — tidak muncul di picker
        tiket. Matrix SLA tetap keyed by zona Dalam/Luar kota/pulau.
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
              placeholder="JKT_SELATAN"
              required
              disabled={editingAlias}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Label
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Jakarta Selatan"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Zona SLA
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.slaZone}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slaZone: e.target.value as SlaZone,
                }))
              }
            >
              {SLA_ZONES.map((z) => (
                <option key={z} value={z}>
                  {SLA_ZONE_LABELS[z]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Regional Office (opsional)
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={form.regionalOffice}
              onChange={(e) =>
                setForm((f) => ({ ...f, regionalOffice: e.target.value }))
              }
            >
              <option value="">—</option>
              {REGIONAL_OFFICES.map((ro) => (
                <option key={ro} value={ro}>
                  {ro}
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
            Aktif
          </label>
          <label className="flex items-center gap-2 text-xs self-end pb-1.5">
            <input
              type="checkbox"
              checked={form.isTicketSelectable}
              disabled={editingAlias}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  isTicketSelectable: e.target.checked,
                }))
              }
            />
            Tampil di form tiket
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
              <TableHead>Jenis</TableHead>
              <TableHead>Zona SLA</TableHead>
              <TableHead>RO</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-[100px]">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Belum ada lokasi.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {c.code}
                  </TableCell>
                  <TableCell>{c.label}</TableCell>
                  <TableCell>
                    <Badge variant={isZoneAlias(c) ? "outline" : "secondary"}>
                      {isZoneAlias(c) ? "Alias zona" : "Site"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{SLA_ZONE_LABELS[c.slaZone]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.regionalOffice || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "safe" : "secondary"}>
                      {c.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
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
                          disabled={isZoneAlias(c)}
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
