"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import type { CampaignRunRow } from "@/data/pm-campaign-store";
import type { PmSettingsRow } from "@/data/pm-settings-store";
import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  PEAK_SEASON_KINDS,
  PEAK_SEASON_KIND_LABELS,
  type PeakSeasonKind,
  type PeakSeasonStatus,
  type PeakSeasonWindow,
} from "@/config/peak-season.config";
import { formatDateTime } from "@/lib/utils";

type PmSnap = {
  periodKey: string;
  generateDayOfMonth: number;
  warningDaysBeforeMonthEnd?: number;
  activeRos?: string[];
  tickets: Array<{
    id: string;
    ticketNumber: string;
    merchantId: string;
    location: string;
    status: string;
    description: string;
  }>;
  monthlyRun: CampaignRunRow | null;
  regionalOffices: string[];
  settings?: PmSettingsRow;
};

type PeakSnap = {
  asOf: string;
  seasons: PeakSeasonStatus[];
  active: PeakSeasonStatus[];
  intensifyDue: PeakSeasonStatus[];
};

type PeakForm = {
  kind: PeakSeasonKind;
  name: string;
  startDate: string;
  endDate: string;
  alertLeadDays: number;
  bufferFloorPercent: number;
  checklistText: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyForm = (): PeakForm => ({
  kind: "LEBARAN",
  name: "",
  startDate: "",
  endDate: "",
  alertLeadDays: 14,
  bufferFloorPercent: 15,
  checklistText: "",
  sortOrder: 100,
  isActive: true,
});

export function CampaignsModule() {
  const { can } = useAuth();
  const canGenerate = can("ticket:create");
  const canManage = can("ticket:create");
  const [pm, setPm] = useState<PmSnap | null>(null);
  const [peak, setPeak] = useState<PeakSnap | null>(null);
  const [windows, setWindows] = useState<PeakSeasonWindow[]>([]);
  const [runs, setRuns] = useState<CampaignRunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PeakForm>(emptyForm);
  const [pmDay, setPmDay] = useState(1);
  const [pmWarn, setPmWarn] = useState(5);
  const [pmRos, setPmRos] = useState<string[]>([...REGIONAL_OFFICES]);

  const load = useCallback(async () => {
    setError(null);
    const [campRes, winRes] = await Promise.all([
      fetch("/api/ops/campaigns", { cache: "no-store" }),
      fetch("/api/ops/peak-seasons", { cache: "no-store" }),
    ]);
    const data = (await campRes.json()) as {
      pm?: PmSnap;
      peak?: PeakSnap;
      runs?: CampaignRunRow[];
      error?: string;
    };
    const winData = (await winRes.json()) as {
      windows?: PeakSeasonWindow[];
      error?: string;
    };
    if (!campRes.ok) {
      setError(data.error || "Gagal memuat kampanye");
      return;
    }
    setPm(data.pm ?? null);
    setPeak(data.peak ?? null);
    setRuns(data.runs ?? []);
    if (winRes.ok) setWindows(winData.windows ?? []);
    const s = data.pm?.settings ?? data.pm;
    if (s) {
      setPmDay(s.generateDayOfMonth ?? 1);
      setPmWarn(
        ("warningDaysBeforeMonthEnd" in s
          ? s.warningDaysBeforeMonthEnd
          : 5) ?? 5
      );
      setPmRos(
        ("activeRos" in s && s.activeRos?.length
          ? s.activeRos
          : [...REGIONAL_OFFICES]) as string[]
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(w: PeakSeasonWindow) {
    setEditingId(w.id);
    setForm({
      kind: w.kind,
      name: w.name,
      startDate: w.startDate,
      endDate: w.endDate,
      alertLeadDays: w.alertLeadDays,
      bufferFloorPercent: w.bufferFloorPercent,
      checklistText: w.checklist.join("\n"),
      sortOrder: w.sortOrder,
      isActive: w.isActive,
    });
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        created?: unknown[];
        skipped?: number;
        periodKey?: string;
        notified?: boolean;
        season?: PeakSeasonStatus;
      };
      if (!res.ok) {
        setError(data.error || "Gagal");
        return;
      }
      if (body.action === "generate_pm") {
        setMessage(
          `PM ${data.periodKey}: ${(data.created as unknown[])?.length ?? 0} dibuat, ${data.skipped ?? 0} skip (sudah ada).`
        );
      } else {
        setMessage(
          `Intensifikasi ${data.season?.window.name ?? ""} dicatat${data.notified ? " + notifikasi dikirim" : ""}.`
        );
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveWindow(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const payload = {
      kind: form.kind,
      name: form.name.trim() || PEAK_SEASON_KIND_LABELS[form.kind],
      startDate: form.startDate,
      endDate: form.endDate,
      alertLeadDays: form.alertLeadDays,
      bufferFloorPercent: form.bufferFloorPercent,
      checklist: form.checklistText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };
    try {
      const res = await fetch("/api/ops/peak-seasons", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { id: editingId, ...payload } : payload
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal simpan window");
        return;
      }
      setMessage(editingId ? "Window diperbarui." : "Window ditambahkan.");
      resetForm();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeWindow(id: string) {
    if (!canManage) return;
    if (!confirm("Hapus window peak season ini?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/peak-seasons?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal hapus");
        return;
      }
      setMessage("Window dihapus.");
      if (editingId === id) resetForm();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/peak-seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_defaults" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal seed");
        return;
      }
      setMessage("Default 2026 di-upsert ke database.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function savePmSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/pm-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generateDayOfMonth: pmDay,
          warningDaysBeforeMonthEnd: pmWarn,
          activeRos: pmRos,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        settings?: PmSettingsRow;
      };
      if (!res.ok) {
        setError(data.error || "Gagal simpan settings PM");
        return;
      }
      setMessage(
        `Settings PM disimpan · generate tgl ${data.settings?.generateDayOfMonth} · ${data.settings?.activeRos.length ?? 0} RO.`
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function togglePmRo(ro: string) {
    setPmRos((prev) =>
      prev.includes(ro) ? prev.filter((x) => x !== ro) : [...prev, ro]
    );
  }

  if (!can("ticket:read")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak punya akses kalender PM / peak season.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(error || message) && (
        <p className={`text-xs ${error ? "text-destructive" : "text-emerald-600"}`}>
          {error || message}
        </p>
      )}

      {/* Peak season status cards */}
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">
            Peak season playbook
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Status dari master DB — Natal · Tahun Baru · Lebaran (multi-tahun)
          </p>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-3">
          {(peak?.seasons ?? []).length === 0 ? (
            <p className="col-span-full text-xs text-muted-foreground">
              Belum ada window aktif. Tambah di master di bawah atau seed default.
            </p>
          ) : (
            (peak?.seasons ?? []).map((s) => (
              <div
                key={s.window.id}
                className={`rounded-md border p-3 text-xs ${
                  s.state === "ACTIVE"
                    ? "border-sla-warning/40 bg-sla-warning/10"
                    : s.intensifyDue
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.window.name}</span>
                  <Badge
                    variant={
                      s.state === "ACTIVE"
                        ? "warning"
                        : s.state === "UPCOMING"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {s.state}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {s.window.startDate} → {s.window.endDate}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Buffer floor ≥{s.window.bufferFloorPercent}%
                  {s.state === "UPCOMING" && s.daysUntilStart > 0
                    ? ` · H-${s.daysUntilStart}`
                    : ""}
                </p>
                <ul className="mt-2 list-inside list-disc text-[11px] text-muted-foreground">
                  {s.window.checklist.slice(0, 3).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {canGenerate && s.intensifyDue && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="mt-2"
                    disabled={busy}
                    onClick={() =>
                      void post({
                        action: "peak_intensify",
                        windowId: s.window.id,
                      })
                    }
                  >
                    Jalankan intensifikasi
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Master CRUD */}
      <section className="rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">
              Master kalender peak (2026–2031+)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Tambah / edit tanggal di database — tidak hardcode di kode
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void seedDefaults()}
            >
              Seed default 2026
            </Button>
          )}
        </div>

        {canManage && (
          <form
            onSubmit={(e) => void saveWindow(e)}
            className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="flex flex-col gap-1 text-xs">
              Jenis
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as PeakSeasonKind,
                    name: f.name || PEAK_SEASON_KIND_LABELS[e.target.value as PeakSeasonKind],
                  }))
                }
              >
                {PEAK_SEASON_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PEAK_SEASON_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Nama tampilan
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={PEAK_SEASON_KIND_LABELS[form.kind]}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Mulai
              <input
                type="date"
                required
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Selesai
              <input
                type="date"
                required
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Lead alert (hari)
              <input
                type="number"
                min={0}
                max={90}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.alertLeadDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    alertLeadDays: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Buffer floor %
              <input
                type="number"
                min={0}
                max={100}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.bufferFloorPercent}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bufferFloorPercent: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              Checklist (satu baris = satu item)
              <textarea
                rows={3}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={form.checklistText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, checklistText: e.target.value }))
                }
                placeholder={"Item 1\nItem 2"}
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
            <label className="flex items-center gap-2 self-end pb-1.5 text-xs">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              Aktif
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" disabled={busy}>
                {editingId ? (
                  <>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Simpan
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Tambah window
                  </>
                )}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetForm}
                >
                  Batal
                </Button>
              )}
            </div>
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Selesai</TableHead>
              <TableHead>Buffer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {windows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Belum ada data. Klik Seed default 2026 atau Tambah window
                  (mis. Lebaran 2028–2031).
                </TableCell>
              </TableRow>
            ) : (
              windows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.kind}</TableCell>
                  <TableCell className="text-xs">{w.name}</TableCell>
                  <TableCell className="font-mono text-xs">{w.startDate}</TableCell>
                  <TableCell className="font-mono text-xs">{w.endDate}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {w.bufferFloorPercent}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={w.isActive ? "safe" : "secondary"}>
                      {w.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => startEdit(w)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void removeWindow(w.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* PM calendar */}
      <section className="rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">
              Kalender PM bulanan
            </h2>
            <p className="text-[11px] text-muted-foreground">
              REQUEST + PM · periode{" "}
              <span className="font-mono">{pm?.periodKey ?? "…"}</span> · cron tgl{" "}
              <span className="font-mono">{pm?.generateDayOfMonth ?? "…"}</span> ·{" "}
              {pm?.activeRos?.length ?? "…"} RO aktif
            </p>
          </div>
          <div className="flex gap-1">
            {pm?.monthlyRun && (
              <Badge variant="safe">
                Run {pm.monthlyRun.status} · {pm.monthlyRun.ticketCount} tiket
              </Badge>
            )}
            {canGenerate && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void post({
                    action: "generate_pm",
                    periodKey: pm?.periodKey,
                  })
                }
              >
                Generate PM bulan ini
              </Button>
            )}
          </div>
        </div>

        {canManage && (
          <form
            onSubmit={(e) => void savePmSettings(e)}
            className="space-y-2 border-b border-border p-3"
          >
            <p className="text-xs font-semibold tracking-wide">
              Settings PM (ringan)
            </p>
            <p className="text-[11px] text-muted-foreground">
              Hari generate cron (1–28) + RO yang mendapat tiket PM bulanan
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs">
                Hari generate
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm font-mono"
                  value={pmDay}
                  onChange={(e) => setPmDay(Number(e.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Warning H−
                <input
                  type="number"
                  min={0}
                  max={14}
                  className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm font-mono"
                  value={pmWarn}
                  onChange={(e) => setPmWarn(Number(e.target.value))}
                />
              </label>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setPmRos([...REGIONAL_OFFICES])}
                >
                  Semua RO
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setPmRos([])}
                >
                  Kosongkan
                </Button>
              </div>
            </div>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
              {REGIONAL_OFFICES.map((ro) => (
                <label key={ro} className="flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={pmRos.includes(ro)}
                    onChange={() => togglePmRo(ro)}
                  />
                  <span className="truncate">{ro}</span>
                </label>
              ))}
            </div>
            <Button type="submit" size="sm" disabled={busy || pmRos.length === 0}>
              Simpan settings PM
            </Button>
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Tiket</TableHead>
              <TableHead>Merchant / RO key</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deskripsi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pm?.tickets.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Belum ada tiket PM untuk periode ini. Klik Generate atau jadwalkan
                  cron `/api/cron/pm-monthly`.
                </TableCell>
              </TableRow>
            ) : (
              pm!.tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {t.ticketNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.merchantId}</TableCell>
                  <TableCell className="text-xs">{t.location}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-[11px] text-muted-foreground">
                    {t.description}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* Run log */}
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide">Log kampanye</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Belum ada run.
                </TableCell>
              </TableRow>
            ) : (
              runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-[11px]">
                    {formatDateTime(r.generatedAt)}
                  </TableCell>
                  <TableCell className="text-xs">{r.kind}</TableCell>
                  <TableCell className="font-mono text-xs">{r.periodKey}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.ticketCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
