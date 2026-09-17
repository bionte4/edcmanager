"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
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
import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  PERIPHERAL_CATEGORIES,
  PERIPHERAL_CATEGORY_LABELS,
  PERIPHERAL_UNITS,
  STOCK_MUTATION_LABELS,
  STOCK_MUTATION_TYPES,
  type PeripheralCategory,
  type PeripheralUnit,
  type StockMutationType,
} from "@/config/peripherals.config";
import type {
  PeripheralSku,
  StockAlertRow,
  StockBalance,
  StockMutation,
} from "@/data/peripherals-store";

interface Kpis {
  skuCount: number;
  totalQuantity: number;
  alertCount: number;
  roCount: number;
}

const inputClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs";

export function PeripheralsModule() {
  const { can } = useAuth();
  const canMutate = can("inventory:mutate");

  const [skus, setSkus] = useState<PeripheralSku[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [alerts, setAlerts] = useState<StockAlertRow[]>([]);
  const [mutations, setMutations] = useState<StockMutation[]>([]);
  const [kpis, setKpis] = useState<Kpis>({
    skuCount: 0,
    totalQuantity: 0,
    alertCount: 0,
    roCount: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<
    PeripheralCategory | "ALL"
  >("ALL");
  const [q, setQ] = useState("");

  const [skuCode, setSkuCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PeripheralCategory>("CABLE");
  const [unit, setUnit] = useState<PeripheralUnit>("pcs");
  const [minStock, setMinStock] = useState(20);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [mutType, setMutType] = useState<StockMutationType>("IN");
  const [mutQty, setMutQty] = useState(1);
  const [mutRo, setMutRo] = useState<string>(REGIONAL_OFFICES[0]);
  const [mutFrom, setMutFrom] = useState<string>(REGIONAL_OFFICES[0]);
  const [mutTo, setMutTo] = useState<string>(REGIONAL_OFFICES[1]);
  const [mutNotes, setMutNotes] = useState("");

  const selected = useMemo(
    () => skus.find((s) => s.id === selectedId) ?? null,
    [skus, selectedId]
  );

  const selectedBalances = useMemo(
    () => balances.filter((b) => b.skuId === selectedId),
    [balances, selectedId]
  );

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/peripherals?${params.toString()}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      skus?: PeripheralSku[];
      balances?: StockBalance[];
      alerts?: StockAlertRow[];
      mutations?: StockMutation[];
      kpis?: Kpis;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat peripheral");
      return;
    }
    setSkus(data.skus ?? []);
    setBalances(data.balances ?? []);
    setAlerts(data.alerts ?? []);
    setMutations(data.mutations ?? []);
    if (data.kpis) setKpis(data.kpis);
  }, [categoryFilter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setSkuCode("");
    setName("");
    setCategory("CABLE");
    setUnit("pcs");
    setMinStock(20);
    setNotes("");
    setIsActive(true);
  }

  function startEdit(s: PeripheralSku) {
    setEditingId(s.id);
    setSelectedId(s.id);
    setSkuCode(s.skuCode);
    setName(s.name);
    setCategory(s.category);
    setUnit(s.unit);
    setMinStock(s.minStock);
    setNotes(s.notes ?? "");
    setIsActive(s.isActive);
  }

  async function onSubmitSku(e: FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setError(null);
    setMessage(null);
    const payload = {
      skuCode,
      name,
      category,
      unit,
      minStock: Number(minStock),
      notes: notes || undefined,
      isActive,
    };
    const res = editingId
      ? await fetch("/api/peripherals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await fetch("/api/peripherals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const data = (await res.json()) as { error?: string; sku?: PeripheralSku };
    if (!res.ok) {
      setError(data.error || "Gagal simpan SKU");
      return;
    }
    setMessage(editingId ? "SKU diperbarui." : "SKU ditambahkan.");
    resetForm();
    if (data.sku) setSelectedId(data.sku.id);
    await load();
  }

  async function onDelete(id: string) {
    if (!canMutate) return;
    if (!window.confirm("Hapus SKU ini beserta stoknya?")) return;
    const res = await fetch(`/api/peripherals?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage("SKU dihapus.");
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) resetForm();
    await load();
  }

  async function onMutate(e: FormEvent) {
    e.preventDefault();
    if (!canMutate || !selectedId) return;
    setError(null);
    setMessage(null);
    const payload =
      mutType === "TRANSFER"
        ? {
            action: "mutate" as const,
            skuId: selectedId,
            type: mutType,
            quantity: Number(mutQty),
            fromRo: mutFrom,
            toRo: mutTo,
            notes: mutNotes || undefined,
          }
        : {
            action: "mutate" as const,
            skuId: selectedId,
            type: mutType,
            quantity: Number(mutQty),
            regionalOffice: mutRo,
            notes: mutNotes || undefined,
          };
    const res = await fetch("/api/peripherals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal mutasi stok");
      return;
    }
    setMessage("Mutasi stok berhasil.");
    setMutNotes("");
    await load();
  }

  async function onReset() {
    if (!canMutate) return;
    if (!window.confirm("Reset peripheral ke data seed?")) return;
    const res = await fetch("/api/peripherals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Gagal reset");
      return;
    }
    setMessage("Peripheral di-reset.");
    resetForm();
    await load();
  }

  if (!can("inventory:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses inventory.
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

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">SKU aktif</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {kpis.skuCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Total qty (semua RO)</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {kpis.totalQuantity.toLocaleString("id-ID")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Alert min-stock</CardTitle>
          </CardHeader>
          <CardContent
            className={`font-mono text-xl font-semibold ${
              kpis.alertCount > 0 ? "text-sla-breached" : "text-sla-safe"
            }`}
          >
            {kpis.alertCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Regional Office</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xl font-semibold">
            {kpis.roCount}
          </CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-md border border-sla-breached/30 bg-sla-breached/5 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-sla-breached">
            <AlertTriangle className="h-3.5 w-3.5" />
            Stok di bawah minimum ({alerts.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {alerts.slice(0, 8).map((a) => (
              <Badge key={`${a.skuId}-${a.regionalOffice}`} variant="breached">
                {a.skuCode} · {a.regionalOffice}: {a.quantity}/{a.minStock}
              </Badge>
            ))}
            {alerts.length > 8 && (
              <Badge variant="secondary">+{alerts.length - 8} lagi</Badge>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          className={inputClass + " w-auto"}
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as PeripheralCategory | "ALL")
          }
        >
          <option value="ALL">Semua kategori</option>
          {PERIPHERAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PERIPHERAL_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          className={inputClass + " max-w-[200px]"}
          placeholder="Cari SKU / nama"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canMutate && (
          <Button type="button" size="sm" variant="outline" onClick={() => void onReset()}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reset seed
          </Button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Status</TableHead>
                {canMutate && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((s) => (
                <TableRow
                  key={s.id}
                  className={
                    selectedId === s.id ? "bg-muted/50" : "cursor-pointer"
                  }
                  onClick={() => setSelectedId(s.id)}
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {s.skuCode}
                  </TableCell>
                  <TableCell className="text-xs">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {PERIPHERAL_CATEGORY_LABELS[s.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.minStock} {s.unit}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "safe" : "secondary"}>
                      {s.isActive ? "Aktif" : "Off"}
                    </Badge>
                  </TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(s)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => void onDelete(s.id)}
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
        </div>

        <div className="flex flex-col gap-3">
          {canMutate && (
            <form
              onSubmit={onSubmitSku}
              className="grid gap-2 rounded-md border border-border bg-card p-3"
            >
              <p className="text-xs font-semibold">
                {editingId ? "Edit SKU" : "Tambah SKU"}
              </p>
              <input
                className={inputClass}
                placeholder="SKU code"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="Nama"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={inputClass}
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as PeripheralCategory)
                  }
                >
                  {PERIPHERAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {PERIPHERAL_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as PeripheralUnit)}
                >
                  {PERIPHERAL_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                className={inputClass}
                placeholder="Min stock / RO"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                min={0}
              />
              <input
                className={inputClass}
                placeholder="Catatan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Aktif
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  {editingId ? (
                    <>
                      <Pencil className="mr-1 h-3 w-3" /> Simpan
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-3 w-3" /> Tambah
                    </>
                  )}
                </Button>
                {editingId && (
                  <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                    Batal
                  </Button>
                )}
              </div>
            </form>
          )}

          {selected && (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold">
                Stok · {selected.skuCode}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RO</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Min</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REGIONAL_OFFICES.map((ro) => {
                    const bal = selectedBalances.find(
                      (b) => b.regionalOffice === ro
                    );
                    const qty = bal?.quantity ?? 0;
                    const low = qty < selected.minStock;
                    return (
                      <TableRow key={ro}>
                        <TableCell className="text-xs">{ro}</TableCell>
                        <TableCell
                          className={`font-mono text-xs ${
                            low ? "text-sla-breached" : ""
                          }`}
                        >
                          {qty} {selected.unit}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {selected.minStock}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {canMutate && (
                <form onSubmit={onMutate} className="mt-3 grid gap-2 border-t border-border pt-3">
                  <p className="flex items-center gap-1 text-xs font-semibold">
                    <ArrowLeftRight className="h-3 w-3" /> Mutasi stok
                  </p>
                  <select
                    className={inputClass}
                    value={mutType}
                    onChange={(e) =>
                      setMutType(e.target.value as StockMutationType)
                    }
                  >
                    {STOCK_MUTATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {STOCK_MUTATION_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={inputClass}
                    min={1}
                    value={mutQty}
                    onChange={(e) => setMutQty(Number(e.target.value))}
                    required
                  />
                  {mutType === "TRANSFER" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className={inputClass}
                        value={mutFrom}
                        onChange={(e) => setMutFrom(e.target.value)}
                      >
                        {REGIONAL_OFFICES.map((ro) => (
                          <option key={ro} value={ro}>
                            Dari {ro}
                          </option>
                        ))}
                      </select>
                      <select
                        className={inputClass}
                        value={mutTo}
                        onChange={(e) => setMutTo(e.target.value)}
                      >
                        {REGIONAL_OFFICES.map((ro) => (
                          <option key={ro} value={ro}>
                            Ke {ro}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <select
                      className={inputClass}
                      value={mutRo}
                      onChange={(e) => setMutRo(e.target.value)}
                    >
                      {REGIONAL_OFFICES.map((ro) => (
                        <option key={ro} value={ro}>
                          {ro}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    className={inputClass}
                    placeholder="Catatan mutasi"
                    value={mutNotes}
                    onChange={(e) => setMutNotes(e.target.value)}
                  />
                  <Button type="submit" size="sm">
                    Terapkan mutasi
                  </Button>
                </form>
              )}

              {mutations.filter((m) => m.skuId === selected.id).length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                    Riwayat mutasi
                  </p>
                  <ul className="max-h-28 space-y-1 overflow-auto text-[11px] text-muted-foreground">
                    {mutations
                      .filter((m) => m.skuId === selected.id)
                      .slice(0, 8)
                      .map((m) => (
                        <li key={m.id}>
                          {STOCK_MUTATION_LABELS[m.type]} · {m.quantity}
                          {m.fromRo ? ` · ${m.fromRo}` : ""}
                          {m.toRo ? ` → ${m.toRo}` : ""}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
