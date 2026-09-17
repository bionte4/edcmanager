"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
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
import { useAuth } from "@/components/auth/auth-provider";
import {
  ASSET_VENDORS,
  EDC_BRANDS,
  EDC_MUTATION_LABELS,
  EDC_STATUS_LABELS,
  EDC_UNIT_STATUSES,
  REGIONAL_OFFICES,
  type EdcMutationType,
  type EdcUnitStatus,
} from "@/config/assets.config";
import type { EdcAsset } from "@/data/assets-store";
import { formatDateTime } from "@/lib/utils";

interface Kpis {
  total: number;
  buffer: number;
  deployed: number;
  idle: number;
}

const inputClass =
  "h-7 w-full rounded-md border border-input bg-background px-2 text-xs";

function statusVariant(status: EdcUnitStatus): "safe" | "warning" | "secondary" {
  if (status === "BUFFER") return "safe";
  if (status === "IDLE") return "warning";
  return "secondary";
}

export function AssetManagementModule() {
  const { user, can } = useAuth();
  const canMutate = can("inventory:mutate");

  const [assets, setAssets] = useState<EdcAsset[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ total: 0, buffer: 0, deployed: 0, idle: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<EdcUnitStatus | "ALL">("ALL");
  const [roFilter, setRoFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const [serialNumber, setSerialNumber] = useState("");
  const [brand, setBrand] = useState<string>(EDC_BRANDS[0]);
  const [regionalOffice, setRegionalOffice] = useState<string>(REGIONAL_OFFICES[0]);
  const [vendorName, setVendorName] = useState<string>(ASSET_VENDORS[0]);
  const [status, setStatus] = useState<EdcUnitStatus>("BUFFER");
  const [merchantId, setMerchantId] = useState("");
  const [notes, setNotes] = useState("");

  const [mutationType, setMutationType] = useState<EdcMutationType>("DEPLOY");
  const [mutateRo, setMutateRo] = useState<string>(REGIONAL_OFFICES[1]);
  const [mutateMerchant, setMutateMerchant] = useState("");
  const [mutateNotes, setMutateNotes] = useState("");
  const [excelBusy, setExcelBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId]
  );

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (roFilter !== "ALL") params.set("ro", roFilter);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/assets?${params.toString()}`, { cache: "no-store" });
    const data = (await res.json()) as {
      assets?: EdcAsset[];
      kpis?: Kpis;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat assets");
      return;
    }
    setAssets(data.assets ?? []);
    if (data.kpis) setKpis(data.kpis);
  }, [statusFilter, roFilter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setSerialNumber("");
    setBrand(EDC_BRANDS[0]);
    setRegionalOffice(REGIONAL_OFFICES[0]);
    setVendorName(ASSET_VENDORS[0]);
    setStatus("BUFFER");
    setMerchantId("");
    setNotes("");
  }

  function startEdit(asset: EdcAsset) {
    setEditingId(asset.id);
    setSelectedId(asset.id);
    setSerialNumber(asset.serialNumber);
    setBrand(asset.brand);
    setRegionalOffice(asset.regionalOffice);
    setVendorName(asset.vendorName);
    setStatus(asset.status);
    setMerchantId(asset.merchantId ?? "");
    setNotes(asset.notes ?? "");
    setMessage(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setError(null);
    setMessage(null);

    if (editingId) {
      const res = await fetch("/api/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          serialNumber,
          brand,
          regionalOffice,
          vendorName,
          notes,
          merchantId: merchantId || null,
        }),
      });
      const data = (await res.json()) as { error?: string; asset?: EdcAsset };
      if (!res.ok) {
        setError(data.error || "Gagal update");
        return;
      }
      setMessage(`Asset ${data.asset?.serialNumber} diperbarui.`);
      resetForm();
      await load();
      return;
    }

    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serialNumber,
        brand,
        regionalOffice,
        vendorName,
        status,
        merchantId: merchantId || null,
        notes,
      }),
    });
    const data = (await res.json()) as { error?: string; asset?: EdcAsset };
    if (!res.ok) {
      setError(data.error || "Gagal create");
      return;
    }
    setMessage(`Asset ${data.asset?.serialNumber} dibuat.`);
    if (data.asset) setSelectedId(data.asset.id);
    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!canMutate || !confirm("Hapus asset ini?")) return;
    const res = await fetch(`/api/assets?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage("Asset dihapus.");
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) resetForm();
    await load();
  }

  async function onMutate() {
    if (!canMutate || !selected) return;
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mutate",
        id: selected.id,
        mutationType,
        toRegionalOffice: mutateRo,
        merchantId: mutateMerchant || null,
        notes: mutateNotes || null,
      }),
    });
    const data = (await res.json()) as { error?: string; asset?: EdcAsset };
    if (!res.ok) {
      setError(data.error || "Mutasi gagal");
      return;
    }
    setMessage(`${EDC_MUTATION_LABELS[mutationType]} · ${data.asset?.serialNumber}`);
    setMutateNotes("");
    setMutateMerchant("");
    await load();
  }

  async function downloadExcel(mode: "export" | "template") {
    setExcelBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/excel?mode=${mode}`, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Download gagal");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ??
        (mode === "template" ? "edc-assets-template.xlsx" : "edc-assets-export.xlsx");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(mode === "template" ? "Template Excel diunduh." : "Export Excel diunduh.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download gagal");
    } finally {
      setExcelBusy(false);
    }
  }

  async function onImportFile(file: File | null) {
    if (!file || !canMutate) return;
    setExcelBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/assets/excel", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        result?: {
          created: number;
          updated: number;
          skipped: number;
          errors: string[];
          totalRows: number;
        };
      };
      if (!res.ok) throw new Error(data.error || "Import gagal");
      const r = data.result!;
      const warn =
        r.errors.length > 0
          ? ` · ${r.errors.slice(0, 3).join(" | ")}${r.errors.length > 3 ? "…" : ""}`
          : "";
      setMessage(
        `Import selesai: ${r.created} baru, ${r.updated} update, ${r.skipped} skip / ${r.totalRows} baris.${warn}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import gagal");
    } finally {
      setExcelBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Total Asset" value={String(kpis.total)} />
        <Kpi title="Buffer" value={String(kpis.buffer)} />
        <Kpi title="Deployed" value={String(kpis.deployed)} />
        <Kpi title="Idle" value={String(kpis.idle)} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="xs"
          variant={statusFilter === "ALL" ? "default" : "outline"}
          onClick={() => setStatusFilter("ALL")}
        >
          Semua Status
        </Button>
        {EDC_UNIT_STATUSES.map((s) => (
          <Button
            key={s}
            type="button"
            size="xs"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {EDC_STATUS_LABELS[s]}
          </Button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
        <select
          className="h-6 rounded-md border border-input bg-background px-2 text-[11px]"
          value={roFilter}
          onChange={(e) => setRoFilter(e.target.value)}
        >
          <option value="ALL">Semua RO</option>
          {REGIONAL_OFFICES.map((ro) => (
            <option key={ro} value={ro}>
              {ro}
            </option>
          ))}
        </select>
        <input
          className="h-6 w-40 rounded-md border border-input bg-background px-2 text-[11px]"
          placeholder="Cari SN / merchant…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="button" size="xs" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
        <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={excelBusy}
          onClick={() => void downloadExcel("export")}
        >
          <Download className="h-3 w-3" />
          Export Excel
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={excelBusy}
          onClick={() => void downloadExcel("template")}
        >
          <FileSpreadsheet className="h-3 w-3" />
          Template
        </Button>
        {canMutate && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={excelBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              {excelBusy ? "Import…" : "Import Excel"}
            </Button>
          </>
        )}
      </div>

      {(error || message) && (
        <p className={`text-xs ${error ? "text-sla-breached" : "text-sla-safe"}`}>
          {error || message}
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        {canMutate && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-foreground">
                {editingId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingId ? "Edit Asset" : "Register Asset"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
                <Field label="Serial Number">
                  <input
                    className={`${inputClass} font-mono`}
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Merek">
                  <select
                    className={inputClass}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  >
                    {EDC_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Regional Office">
                  <select
                    className={inputClass}
                    value={regionalOffice}
                    onChange={(e) => setRegionalOffice(e.target.value)}
                  >
                    {REGIONAL_OFFICES.map((ro) => (
                      <option key={ro} value={ro}>
                        {ro}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Vendor">
                  <select
                    className={inputClass}
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  >
                    {ASSET_VENDORS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                {!editingId && (
                  <Field label="Status awal">
                    <select
                      className={inputClass}
                      value={status}
                      onChange={(e) => setStatus(e.target.value as EdcUnitStatus)}
                    >
                      {EDC_UNIT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {EDC_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Merchant ID">
                  <input
                    className={`${inputClass} font-mono`}
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="wajib jika Deployed"
                  />
                </Field>
                <Field label="Catatan">
                  <input
                    className={inputClass}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
                <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                  <Button type="submit" size="xs">
                    {editingId ? "Update" : "Create"}
                  </Button>
                  {editingId && (
                    <Button type="button" size="xs" variant="outline" onClick={resetForm}>
                      Batal
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className={canMutate ? undefined : "xl:col-span-2"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-foreground">
              <Boxes className="h-3.5 w-3.5" />
              Mutasi Unit
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {!selected ? (
              <p className="text-[11px] text-muted-foreground">
                Pilih asset di tabel untuk deploy / recall / transfer / pooling.
              </p>
            ) : (
              <>
                <p className="text-xs">
                  <span className="font-mono font-medium">{selected.serialNumber}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {EDC_STATUS_LABELS[selected.status]} · {selected.regionalOffice}
                  </span>
                </p>
                {canMutate ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Tipe mutasi">
                      <select
                        className={inputClass}
                        value={mutationType}
                        onChange={(e) =>
                          setMutationType(e.target.value as EdcMutationType)
                        }
                      >
                        {(
                          [
                            "DEPLOY",
                            "RECALL",
                            "TRANSFER",
                            "POOLING",
                            "BUFFER_TO_IDLE",
                            "IDLE_TO_BUFFER",
                          ] as EdcMutationType[]
                        ).map((t) => (
                          <option key={t} value={t}>
                            {EDC_MUTATION_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {(mutationType === "TRANSFER" || mutationType === "POOLING") && (
                      <Field label="RO tujuan">
                        <select
                          className={inputClass}
                          value={mutateRo}
                          onChange={(e) => setMutateRo(e.target.value)}
                        >
                          {REGIONAL_OFFICES.map((ro) => (
                            <option key={ro} value={ro}>
                              {ro}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    {mutationType === "DEPLOY" && (
                      <Field label="Merchant ID">
                        <input
                          className={`${inputClass} font-mono`}
                          value={mutateMerchant}
                          onChange={(e) => setMutateMerchant(e.target.value)}
                          required
                        />
                      </Field>
                    )}
                    <Field label="Catatan mutasi">
                      <input
                        className={inputClass}
                        value={mutateNotes}
                        onChange={(e) => setMutateNotes(e.target.value)}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Button type="button" size="xs" onClick={() => void onMutate()}>
                        Jalankan mutasi
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Role Anda read-only untuk mutasi inventaris.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">
            Inventaris EDC ({assets.length})
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Serial · status Buffer/Deployed/Idle · mutasi deploy/recall/transfer/pooling
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial</TableHead>
              <TableHead>Merek</TableHead>
              <TableHead>RO</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Update</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-4 text-center text-xs text-muted-foreground">
                  Tidak ada asset untuk filter ini.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className={selectedId === asset.id ? "bg-muted/50" : undefined}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {asset.serialNumber}
                  </TableCell>
                  <TableCell className="text-xs">{asset.brand}</TableCell>
                  <TableCell className="text-xs">{asset.regionalOffice}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(asset.status)}>
                      {EDC_STATUS_LABELS[asset.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {asset.merchantId || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{asset.vendorName}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {formatDateTime(asset.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      {canMutate && (
                        <>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(asset);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDelete(asset.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">
              Riwayat mutasi · {selected.serialNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {selected.mutations.length === 0 ? (
              <p className="px-3 pb-3 text-[11px] text-muted-foreground">Belum ada mutasi.</p>
            ) : (
              <ul className="divide-y divide-border">
                {selected.mutations.map((m) => (
                  <li key={m.id} className="flex flex-col gap-0.5 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{EDC_MUTATION_LABELS[m.mutationType]}</Badge>
                      <span className="text-muted-foreground">
                        {m.fromStatus ?? "—"} → {m.toStatus ?? "—"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {m.fromRegionalOffice ?? "—"} → {m.toRegionalOffice ?? "—"}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {formatDateTime(m.mutatedAt)} · {m.mutatedBy}
                      </span>
                    </div>
                    {m.notes && (
                      <p className="text-[11px] text-muted-foreground">{m.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {!user && (
        <p className="text-xs text-muted-foreground">Memuat sesi…</p>
      )}
    </div>
  );
}

function Kpi({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`font-mono text-xl font-semibold tabular-nums ${
            tone === "warn" ? "text-sla-warning" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
