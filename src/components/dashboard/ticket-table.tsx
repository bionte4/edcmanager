"use client";

import { useMemo, useState } from "react";
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
  type EnrichedTicket,
  type TicketCategory,
  type TicketLocation,
} from "@/data/dashboard";
import { formatDateTime } from "@/lib/utils";
import type { SlaEvaluationStatus } from "@/sla";

type LocationFilter = TicketLocation | "ALL";
type CategoryFilter = TicketCategory | "ALL";

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

const LOCATIONS: LocationFilter[] = ["ALL", "DALAM_KOTA", "LUAR_KOTA", "LUAR_PULAU"];
const CATEGORIES: CategoryFilter[] = ["ALL", "VIP", "NON_VIP"];

export function TicketTable({ tickets }: { tickets: EnrichedTicket[] }) {
  const [location, setLocation] = useState<LocationFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");

  const filtered = useMemo(() => {
    return tickets.filter((ticket) => {
      if (location !== "ALL" && ticket.location !== location) return false;
      if (category !== "ALL" && ticket.category !== category) return false;
      return true;
    });
  }, [tickets, location, category]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">Tiket Corrective Maintenance</h2>
          <p className="text-xs text-muted-foreground">
            Filter lokasi & kategori · badge SLA dari engine Annex 3
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {LOCATIONS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={location === value ? "default" : "outline"}
              onClick={() => setLocation(value)}
            >
              {value === "ALL" ? "Semua Lokasi" : LOCATION_LABELS[value]}
            </Button>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
          {CATEGORIES.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={category === value ? "default" : "outline"}
              onClick={() => setCategory(value)}
            >
              {value === "ALL" ? "Semua Kategori" : CATEGORY_LABELS[value]}
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
              <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
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
                <TableCell>{LOCATION_LABELS[ticket.location]}</TableCell>
                <TableCell>
                  <Badge variant={ticket.category === "VIP" ? "default" : "secondary"}>
                    {CATEGORY_LABELS[ticket.category]}
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
