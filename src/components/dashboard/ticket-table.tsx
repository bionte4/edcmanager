"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";
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
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
  SLA_LABELS,
  locationLabel,
  type EnrichedTicket,
} from "@/data/dashboard";
import {
  SLA_ZONE_LABELS,
  SLA_ZONES,
  type SlaZone,
} from "@/config/location.config";
import { cn, formatDateTime } from "@/lib/utils";
import type { SlaEvaluationStatus } from "@/sla";

type ZoneFilter = SlaZone | "ALL";
type CategoryFilter = string;

function slaBadgeVariant(
  status: SlaEvaluationStatus
): "safe" | "warning" | "breached" | "secondary" {
  switch (status) {
    case "ON_TRACK":
    case "ACHIEVED":
      return "safe";
    case "WARNING":
      return "warning";
    case "BREACHED":
      return "breached";
    default:
      return "secondary";
  }
}

function slaUrgencyRank(status: SlaEvaluationStatus): number {
  if (status === "BREACHED") return 0;
  if (status === "WARNING") return 1;
  if (status === "ON_TRACK") return 2;
  return 3;
}

type LocOpt = { code: string; label: string; slaZone: SlaZone };

export function TicketTable({ tickets }: { tickets: EnrichedTicket[] }) {
  const [zone, setZone] = useState<ZoneFilter>("ALL");
  const [site, setSite] = useState<string>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [categoryOptions, setCategoryOptions] = useState<
    Array<{ code: string; label: string; slaProfile: string }>
  >([
    { code: "VIP", label: "VIP", slaProfile: "VIP" },
    { code: "NON_VIP", label: "Non-VIP", slaProfile: "NON_VIP" },
  ]);
  const [locationOptions, setLocationOptions] = useState<LocOpt[]>([]);
  const [zoneByCode, setZoneByCode] = useState<Record<string, SlaZone>>({});

  const loadFilters = useCallback(async () => {
    try {
      const [catRes, locRes, allLocRes] = await Promise.all([
        fetch("/api/categories?activeOnly=1", { cache: "no-store" }),
        fetch("/api/locations?activeOnly=1&ticketSelectable=1", {
          cache: "no-store",
        }),
        fetch("/api/locations?activeOnly=1", { cache: "no-store" }),
      ]);
      if (catRes.ok) {
        const data = (await catRes.json()) as {
          categories?: Array<{ code: string; label: string; slaProfile: string }>;
        };
        if (data.categories?.length) setCategoryOptions(data.categories);
      }
      if (locRes.ok) {
        const data = (await locRes.json()) as { locations?: LocOpt[] };
        if (data.locations?.length) setLocationOptions(data.locations);
      }
      if (allLocRes.ok) {
        const data = (await allLocRes.json()) as {
          locations?: Array<{ code: string; slaZone: SlaZone }>;
        };
        const map: Record<string, SlaZone> = {};
        for (const l of data.locations ?? []) map[l.code] = l.slaZone;
        // legacy zone codes map to themselves
        for (const z of SLA_ZONES) map[z] = z;
        setZoneByCode(map);
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  const resolveZone = useCallback(
    (code: string): SlaZone => {
      return zoneByCode[code] ?? (SLA_ZONES.includes(code as SlaZone) ? (code as SlaZone) : "DALAM_KOTA");
    },
    [zoneByCode]
  );

  const filtered = useMemo(() => {
    const rows = tickets.filter((ticket) => {
      const ticketZone = resolveZone(ticket.location);
      if (zone !== "ALL" && ticketZone !== zone) return false;
      if (site !== "ALL" && ticket.location !== site) return false;
      if (category !== "ALL" && ticket.category !== category) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      const urg = slaUrgencyRank(a.slaStatus) - slaUrgencyRank(b.slaStatus);
      if (urg !== 0) return urg;
      return new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime();
    });
  }, [tickets, zone, site, category, resolveZone]);

  const sitesForZone = useMemo(() => {
    if (zone === "ALL") return locationOptions;
    return locationOptions.filter((l) => l.slaZone === zone);
  }, [locationOptions, zone]);

  function labelFor(code: string): string {
    return (
      categoryOptions.find((c) => c.code === code)?.label ??
      CATEGORY_LABELS[code] ??
      code
    );
  }

  function locLabel(code: string): string {
    return (
      locationOptions.find((l) => l.code === code)?.label ??
      LOCATION_LABELS[code] ??
      locationLabel(code)
    );
  }

  function isVipProfile(code: string): boolean {
    return (
      categoryOptions.find((c) => c.code === code)?.slaProfile === "VIP" ||
      code === "VIP"
    );
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xs font-semibold tracking-wide">
              Tiket Operasional (ITSM)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Urut prioritas SLA · filter zona (kontrak) lalu lokasi operasional
            </p>
          </div>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {filtered.length}/{tickets.length} tiket
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <Filter className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Zona
            </span>
            <Button
              type="button"
              size="xs"
              variant={zone === "ALL" ? "default" : "outline"}
              onClick={() => {
                setZone("ALL");
                setSite("ALL");
              }}
            >
              Semua
            </Button>
            {SLA_ZONES.map((z) => (
              <Button
                key={z}
                type="button"
                size="xs"
                variant={zone === z ? "default" : "outline"}
                onClick={() => {
                  setZone(z);
                  setSite("ALL");
                }}
              >
                {SLA_ZONE_LABELS[z]}
              </Button>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Kategori
            </span>
            <Button
              type="button"
              size="xs"
              variant={category === "ALL" ? "default" : "outline"}
              onClick={() => setCategory("ALL")}
            >
              Semua
            </Button>
            {categoryOptions.map((opt) => (
              <Button
                key={opt.code}
                type="button"
                size="xs"
                variant={category === opt.code ? "default" : "outline"}
                onClick={() => setCategory(opt.code)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <label className="flex max-w-sm items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0 font-medium uppercase tracking-wide">
              Lokasi
            </span>
            <select
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              <option value="ALL">Semua lokasi operasional</option>
              {sitesForZone.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Tiket</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Masuk</TableHead>
              <TableHead>Elapsed</TableHead>
              <TableHead>Sisa / Over</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>SLA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-4 text-center text-xs text-muted-foreground"
                >
                  Tidak ada tiket untuk filter ini.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ticket) => {
                const z = resolveZone(ticket.location);
                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {ticket.ticketNumber}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs">
                      {ticket.merchantId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium leading-tight">
                          {locLabel(ticket.location)}
                        </span>
                        <Badge
                          variant="secondary"
                          className="w-fit px-1.5 py-0 text-[10px] font-normal"
                        >
                          {SLA_ZONE_LABELS[z]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          isVipProfile(ticket.category) ? "default" : "secondary"
                        }
                      >
                        {labelFor(ticket.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatDateTime(ticket.openedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {ticket.elapsedLabel}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        ticket.slaStatus === "BREACHED" && "text-sla-breached font-semibold",
                        ticket.slaStatus === "WARNING" && "text-sla-warning font-medium"
                      )}
                    >
                      {ticket.remainingLabel}
                    </TableCell>
                    <TableCell className="text-xs">{ticket.vendorName}</TableCell>
                    <TableCell>
                      <Badge variant={slaBadgeVariant(ticket.slaStatus)}>
                        {SLA_LABELS[ticket.slaStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
