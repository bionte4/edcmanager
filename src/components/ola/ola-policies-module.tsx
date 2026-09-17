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
  OLA_STAGE_LABELS,
  type OlaStage,
} from "@/config/ola.config";
import { ITSM_TYPE_LABELS, PROCESS_LABELS } from "@/config/itsm.config";
import type { OlaPolicy } from "@/ola/types";
import { CATEGORY_LABELS, LOCATION_LABELS } from "@/data/dashboard";

const STAGES: OlaStage[] = ["ACKNOWLEDGE", "DISPATCH"];
const ITSM_OPTS = ["*", "INCIDENT", "REQUEST", "PROBLEM", "CHANGE"] as const;
const LOC_OPTS = ["*", "DALAM_KOTA", "LUAR_KOTA", "LUAR_PULAU"] as const;
const CAT_OPTS = ["*", "VIP", "NON_VIP"] as const;
const PROC_OPTS = [
  "*",
  "CM",
  "PM",
  "INSTALL",
  "RELOCATE",
  "INVESTIGATION",
  "STANDARD_CHANGE",
  "NORMAL_CHANGE",
  "EMERGENCY_CHANGE",
] as const;

function matchLabel(value: string): string {
  if (value === "*") return "Semua";
  if (value in ITSM_TYPE_LABELS) return ITSM_TYPE_LABELS[value as keyof typeof ITSM_TYPE_LABELS];
  if (value in LOCATION_LABELS) return LOCATION_LABELS[value as keyof typeof LOCATION_LABELS];
  if (value in CATEGORY_LABELS) return CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS];
  if (value in PROCESS_LABELS) return PROCESS_LABELS[value as keyof typeof PROCESS_LABELS];
  return value;
}

const emptyForm = {
  name: "",
  stage: "ACKNOWLEDGE" as OlaStage,
  limitMinutes: 30,
  warningThreshold: 0.8,
  itsmType: "*" as string,
  location: "*" as string,
  category: "*" as string,
  process: "*" as string,
  priority: 50,
  isActive: true,
};

export function OlaPoliciesModule() {
  const { can } = useAuth();
  const canManage = can("ola:manage");
  const [policies, setPolicies] = useState<OlaPolicy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/ola", { cache: "no-store" });
    const data = (await res.json()) as { policies?: OlaPolicy[]; error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal memuat OLA policies");
      return;
    }
    setPolicies(data.policies ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(p: OlaPolicy) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      stage: p.stage,
      limitMinutes: p.limitMinutes,
      warningThreshold: p.warningThreshold,
      itsmType: p.itsmType,
      location: p.location,
      category: p.category,
      process: p.process,
      priority: p.priority,
      isActive: p.isActive,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setMessage(null);

    const payload = {
      name: form.name,
      stage: form.stage,
      limitMinutes: Number(form.limitMinutes),
      warningThreshold: Number(form.warningThreshold),
      itsmType: form.itsmType,
      location: form.location,
      category: form.category,
      process: form.process,
      priority: Number(form.priority),
      isActive: form.isActive,
    };

    const res = editingId
      ? await fetch("/api/ola", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await fetch("/api/ola", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    setMessage(editingId ? "Policy diperbarui." : "Policy ditambahkan.");
    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!canManage) return;
    if (!window.confirm("Hapus policy OLA ini?")) return;
    setError(null);
    const res = await fetch(`/api/ola?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage("Policy dihapus.");
    if (editingId === id) resetForm();
    await load();
  }

  async function onResetDefaults() {
    if (!canManage) return;
    if (!window.confirm("Reset semua policy ke default config?")) return;
    setError(null);
    const res = await fetch("/api/ola", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal reset");
      return;
    }
    setMessage("Policy di-reset ke default.");
    resetForm();
    await load();
  }

  if (!can("ola:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses membaca OLA policies.
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

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div>
            <h2 className="text-sm font-semibold tracking-wide">OLA Policies</h2>
            <p className="text-xs text-muted-foreground">
              Jam internal Acknowledge &amp; Dispatch — terpisah dari SLA kontrak. Match paling
              spesifik + priority tertinggi yang menang.
            </p>
          </div>
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={() => void onResetDefaults()}>
              <RotateCcw className="h-3 w-3" />
              Reset default
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Prio</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-[90px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{OLA_STAGE_LABELS[p.stage]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {p.limitMinutes}m · warn {(p.warningThreshold * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {matchLabel(p.itsmType)} · {matchLabel(p.location)} ·{" "}
                  {matchLabel(p.category)} · {matchLabel(p.process)}
                </TableCell>
                <TableCell className="font-mono text-xs">{p.priority}</TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "safe" : "secondary"}>
                    {p.isActive ? "Aktif" : "Off"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onDelete(p.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {canManage && (
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-sm font-semibold tracking-wide">
              {editingId ? "Edit policy" : "Tambah policy"}
            </h2>
          </div>
          <form onSubmit={onSubmit} className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              Nama
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Stage
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.stage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stage: e.target.value as OlaStage }))
                }
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {OLA_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Limit (menit)
              <input
                type="number"
                min={1}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.limitMinutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, limitMinutes: Number(e.target.value) }))
                }
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Warning threshold (0–1)
              <input
                type="number"
                step="0.05"
                min={0.05}
                max={0.95}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.warningThreshold}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    warningThreshold: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Priority
              <input
                type="number"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              ITSM type
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.itsmType}
                onChange={(e) => setForm((f) => ({ ...f, itsmType: e.target.value }))}
              >
                {ITSM_OPTS.map((v) => (
                  <option key={v} value={v}>
                    {matchLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Lokasi
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              >
                {LOC_OPTS.map((v) => (
                  <option key={v} value={v}>
                    {matchLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Kategori
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CAT_OPTS.map((v) => (
                  <option key={v} value={v}>
                    {matchLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Process
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.process}
                onChange={(e) => setForm((f) => ({ ...f, process: e.target.value }))}
              >
                {PROC_OPTS.map((v) => (
                  <option key={v} value={v}>
                    {matchLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Aktif
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm">
                <Plus className="h-3 w-3" />
                {editingId ? "Simpan" : "Tambah"}
              </Button>
              {editingId && (
                <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              )}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
