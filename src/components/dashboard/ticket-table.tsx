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
import { formatDateTime } from "@/lib/utils";
import type { SlaEvaluationStatus } from "@/sla";

type LocationFilter = string;
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

export function TicketTable({ tickets }: { tickets: EnrichedTicket[] }) {
  const [location, setLocation] = useState<LocationFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [categoryOptions, setCategoryOptions] = useState<
    Array<{ code: string; label: string; slaProfile: string }>
  >([
    { code: "VIP", label: "VIP", slaProfile: "VIP" },
    { code: "NON_VIP", label: "Non-VIP", slaProfile: "NON_VIP" },
  ]);
  const [locationOptions, setLocationOptions] = useState<
    Array<{ code: string; label: string }>
  >([
    { code: "DALAM_KOTA", label: "Dalam Kota" },
    { code: "LUAR_KOTA", label: "Luar Kota" },
    { code: "LUAR_PULAU", label: "Luar Pulau" },
  ]);

  const loadFilters = useCallback(async () => {
    try {
      const [catRes, locRes] = await Promise.all([
        fetch("/api/categories?activeOnly=1", { cache: "no-store" }),
        fetch("/api/locations?activeOnly=1", { cache: "no-store" }),
      ]);
      if (catRes.ok) {
        const data = (await catRes.json()) as {
          categories?: Array<{ code: string; label: string; slaProfile: string }>;
        };
        if (data.categories?.length) setCategoryOptions(data.categories);
      }
      if (locRes.ok) {
        const data = (await locRes.json()) as {
          locations?: Array<{ code: string; label: string }>;
        };
        if (data.locations?.length) setLocationOptions(data.locations);
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  const filtered = useMemo(() => {
    return tickets.filter((ticket) => {
      if (location !== "ALL" && ticket.location !== location) return false;
      if (category !== "ALL" && ticket.category !== category) return false;
      return true;
    });
  }, [tickets, location, category]);

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
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold tracking-wide">Tiket Operasional (ITSM)</h2>
          <p className="text-[11px] text-muted-foreground">
            Default Incident/CM · filter lokasi & kategori · badge SLA
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <Button
            type="button"
            size="xs"
            variant={location === "ALL" ? "default" : "outline"}
            onClick={() => setLocation("ALL")}
          >
            Semua Lokasi
          </Button>
          {locationOptions.map((opt) => (
            <Button
              key={opt.code}
              type="button"
              size="xs"
              variant={location === opt.code ? "default" : "outline"}
              onClick={() => setLocation(opt.code)}
            >
              {opt.label}
            </Button>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
          <Button
            type="button"
            size="xs"
            variant={category === "ALL" ? "default" : "outline"}
            onClick={() => setCategory("ALL")}
          >
            Semua Kategori
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
      </div>

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
              <TableCell colSpan={9} className="py-4 text-center text-xs text-muted-foreground">
                Tidak ada tiket untuk filter ini.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-mono text-xs font-medium">
                  {ticket.ticketNumber}
                </TableCell>
                <TableCell className="font-mono text-xs">{ticket.merchantId}</TableCell>
                <TableCell>{locLabel(ticket.location)}</TableCell>
                <TableCell>
                  <Badge variant={isVipProfile(ticket.category) ? "default" : "secondary"}>
                    {labelFor(ticket.category)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {formatDateTime(ticket.openedAt)}
                </TableCell>
                <TableCell className="font-mono text-xs">{ticket.elapsedLabel}</TableCell>
                <TableCell className="font-mono text-xs">{ticket.remainingLabel}</TableCell>
                <TableCell>{ticket.vendorName}</TableCell>
                <TableCell>
                  <Badge variant={slaBadgeVariant(ticket.slaStatus)}>
                    {SLA_LABELS[ticket.slaStatus]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
