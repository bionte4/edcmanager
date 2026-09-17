"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, Ticket, X } from "lucide-react";
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
  TICKET_STATUS_LABELS,
  type WorkflowTicketStatus,
} from "@/config/noc.config";
import {
  DEFAULT_PROCESS_BY_TYPE,
  ITSM_TYPE_LABELS,
  PROCESS_LABELS,
  type ItsmType,
  type OperationalProcess,
} from "@/config/itsm.config";
import { DEMO_AS_OF, LOCATION_LABELS, CATEGORY_LABELS, SLA_LABELS } from "@/data/dashboard";
import {
  assignTicket,
  createTicket,
  enrichOpsTicket,
  linkIncidentToProblem,
  nextStatuses,
  transitionTicket,
  type NocUser,
  type OpsTicket,
} from "@/lib/ticketing";
import { AiInsightPanel } from "@/components/ai/ai-insight-panel";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";
import { formatDateTime } from "@/lib/utils";
import { OLA_STATUS_LABELS, type OlaPolicy } from "@/ola";

const FALLBACK_USERS: NocUser[] = [
  {
    id: "u-noc-1",
    name: "Andi Pratama",
    email: "andi.noc@edc.local",
    role: "NOC",
    isActive: true,
  },
  {
    id: "u-noc-2",
    name: "Siti Rahma",
    email: "siti.noc@edc.local",
    role: "NOC",
    isActive: true,
  },
  {
    id: "u-sup-1",
    name: "Dewi Lestari",
    email: "dewi.supervisor@edc.local",
    role: "SUPERVISOR",
    isActive: true,
  },
];

function slaVariant(status: string): "safe" | "warning" | "breached" | "secondary" {
  if (status === "ON_TRACK" || status === "ACHIEVED") return "safe";
  if (status === "WARNING") return "warning";
  if (status === "BREACHED") return "breached";
  return "secondary";
}

const ITSM_FILTERS: Array<ItsmType | "ALL"> = [
  "ALL",
  "INCIDENT",
  "REQUEST",
  "PROBLEM",
  "CHANGE",
];

export function TicketingModule() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<OpsTicket[]>([]);
  const [olaPolicies, setOlaPolicies] = useState<OlaPolicy[] | null>(null);
  const [categories, setCategories] = useState<
    Array<{ code: string; label: string; slaProfile: string }>
  >([
    { code: "VIP", label: "VIP", slaProfile: "VIP" },
    { code: "NON_VIP", label: "Non-VIP", slaProfile: "NON_VIP" },
  ]);
  const [locations, setLocations] = useState<
    Array<{ code: string; label: string; slaZone: string }>
  >([
    { code: "JKT_PUSAT", label: "Jakarta Pusat", slaZone: "DALAM_KOTA" },
    { code: "BDG_KOTA", label: "Bandung Kota", slaZone: "LUAR_KOTA" },
    { code: "DPS_BALI", label: "Denpasar Bali", slaZone: "LUAR_PULAU" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItsmType | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [itsmType, setItsmType] = useState<ItsmType>("INCIDENT");
  const [process, setProcess] = useState<OperationalProcess>("CM");
  const [merchantId, setMerchantId] = useState("");
  const [location, setLocation] = useState<TicketLocation>("JKT_PUSAT");
  const [category, setCategory] = useState<TicketCategory>("VIP");
  const [vendorName, setVendorName] = useState("Vendor 1");
  const [vendorOptions, setVendorOptions] = useState<string[]>([
    "Vendor 1",
    "Vendor 2",
  ]);
  const [description, setDescription] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [assignToId, setAssignToId] = useState("u-noc-1");
  const [linkProblemId, setLinkProblemId] = useState("");

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { tickets?: OpsTicket[] };
      const list = data.tickets ?? [];
      setTickets(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch {
      /* empty */
    }
  }, []);

  const loadOla = useCallback(async () => {
    try {
      const res = await fetch("/api/ola?activeOnly=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { policies?: OlaPolicy[] };
      setOlaPolicies(data.policies ?? []);
    } catch {
      /* keep defaults via enrichOpsTicket */
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories?activeOnly=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        categories?: Array<{ code: string; label: string; slaProfile: string }>;
      };
      if (data.categories?.length) {
        setCategories(data.categories);
        setCategory((prev) =>
          data.categories!.some((c) => c.code === prev)
            ? prev
            : data.categories![0]!.code
        );
      }
    } catch {
      /* keep VIP/NON_VIP fallback */
    }
  }, []);

  const loadVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/vendors?activeOnly=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { vendors?: Array<{ name: string }> };
      const names = (data.vendors ?? []).map((v) => v.name);
      if (names.length > 0) {
        setVendorOptions(names);
        setVendorName((prev) => (names.includes(prev) ? prev : names[0]));
      }
    } catch {
      /* keep Vendor 1/2 fallback */
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/locations?activeOnly=1&ticketSelectable=1",
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        locations?: Array<{ code: string; label: string; slaZone: string }>;
      };
      if (data.locations?.length) {
        setLocations(data.locations);
        setLocation((prev) =>
          data.locations!.some((l) => l.code === prev)
            ? prev
            : data.locations![0]!.code
        );
      }
    } catch {
      /* keep zone aliases */
    }
  }, []);

  useEffect(() => {
    void loadTickets();
    void loadOla();
    void loadCategories();
    void loadVendors();
    void loadLocations();
  }, [loadTickets, loadOla, loadCategories, loadVendors, loadLocations]);

  const actor: NocUser | null = user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      }
    : null;
  const nocCandidates = FALLBACK_USERS.filter(
    (u) => u.role === "NOC" || u.role === "SUPERVISOR"
  );

  const problems = useMemo(
    () => tickets.filter((t) => t.itsmType === "PROBLEM"),
    [tickets]
  );

  const enriched = useMemo(
    () =>
      tickets.map((t) =>
        olaPolicies
          ? enrichOpsTicket(t, DEMO_AS_OF, olaPolicies)
          : enrichOpsTicket(t, DEMO_AS_OF)
      ),
    [tickets, olaPolicies]
  );

  const visible = useMemo(
    () =>
      typeFilter === "ALL"
        ? enriched
        : enriched.filter((t) => t.itsmType === typeFilter),
    [enriched, typeFilter]
  );

  const selected = enriched.find((t) => t.id === selectedId) ?? null;
  const openCount = enriched.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED").length;
  const escalateCount = enriched.filter((t) => t.needsEscalation && t.status !== "CLOSED").length;
  const olaEscalateCount = enriched.filter(
    (t) => t.olaNeedsEscalation && t.status !== "CLOSED" && t.status !== "RESOLVED"
  ).length;
  const counts = useMemo(() => {
    const base = { INCIDENT: 0, REQUEST: 0, PROBLEM: 0, CHANGE: 0 };
    for (const t of enriched) base[t.itsmType] += 1;
    return base;
  }, [enriched]);

  function withFeedback(fn: () => void) {
    try {
      setError(null);
      fn();
    } catch (e) {
      setMessage(null);
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
  }

  function requireActor(): NocUser {
    if (!actor) throw new Error("Sesi login tidak valid.");
    return actor;
  }

  function handleCreate() {
    withFeedback(() => {
      const ticket = createTicket({
        merchantId,
        location,
        category,
        description,
        vendorName,
        actor: requireActor(),
        itsmType,
        process,
        openedAt: DEMO_AS_OF,
      });
      setTickets((prev) => [ticket, ...prev]);
      setSelectedId(ticket.id);
      setMerchantId("");
      setDescription("");
      setMessage(`${ITSM_TYPE_LABELS[ticket.itsmType]} ${ticket.ticketNumber} dibuat.`);
    });
  }

  function handleAssign() {
    if (!selected) return;
    const noc = nocCandidates.find((u) => u.id === assignToId);
    if (!noc) return;
    withFeedback(() => {
      const updated = assignTicket(selected, noc, requireActor());
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setMessage(`Tiket di-assign ke ${noc.name}.`);
    });
  }

  function handleTransition(toStatus: WorkflowTicketStatus) {
    if (!selected) return;
    withFeedback(() => {
      const updated = transitionTicket(selected, toStatus, requireActor(), {
        technicianName,
      });
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setMessage(`Status → ${TICKET_STATUS_LABELS[toStatus]}`);
    });
  }

  function handleLinkProblem() {
    if (!selected) return;
    withFeedback(() => {
      const updated = linkIncidentToProblem(selected, linkProblemId, requireActor());
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setMessage(`Incident di-link ke ${linkProblemId}.`);
    });
  }

  async function dispatchNotification(
    action: "assign" | "sla",
    level?: "WARNING" | "BREACHED"
  ) {
    if (!selected) return;
    const owner = FALLBACK_USERS.find((u) => u.id === selected.nocOwnerId);
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        level,
        ticket: {
          id: selected.id,
          ticketNumber: selected.ticketNumber,
          itsmType: selected.itsmType,
          merchantId: selected.merchantId,
          description: selected.description,
          slaStatus: selected.slaStatus,
          nocOwnerName: selected.nocOwnerName,
          nocOwnerEmail: owner?.email,
          location: selected.location,
          category: selected.category,
        },
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || "Gagal kirim notifikasi");
  }

  return (
    <div className="flex flex-col gap-3 pb-16 md:pb-0">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi title="Aktif" value={String(openCount)} />
        <Kpi title="Eskalasi SLA" value={String(escalateCount)} tone="warn" />
        <Kpi title="Eskalasi OLA" value={String(olaEscalateCount)} tone="warn" />
        <Kpi title="Incident" value={String(counts.INCIDENT)} />
        <Kpi title="Req / PRB / CHG" value={`${counts.REQUEST}/${counts.PROBLEM}/${counts.CHANGE}`} />
        <Kpi title="Total" value={String(tickets.length)} />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITSM_FILTERS.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            className="h-10 shrink-0 md:h-6"
            variant={typeFilter === value ? "default" : "outline"}
            onClick={() => setTypeFilter(value)}
          >
            {value === "ALL" ? "Semua" : ITSM_TYPE_LABELS[value]}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Plus className="h-4 w-4" />
              Buat Tiket ITSM
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 md:hidden"
              onClick={() => setShowCreate((v) => !v)}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showCreate ? "rotate-180" : ""}`}
              />
              {showCreate ? "Tutup" : "Buka"}
            </Button>
          </CardHeader>
          <CardContent
            className={`grid gap-3 sm:grid-cols-2 ${showCreate ? "" : "hidden md:grid"}`}
          >
            <Field label="ITSM Type">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={itsmType}
                onChange={(e) => {
                  const next = e.target.value as ItsmType;
                  setItsmType(next);
                  setProcess(DEFAULT_PROCESS_BY_TYPE[next]);
                }}
              >
                {(Object.keys(ITSM_TYPE_LABELS) as ItsmType[]).map((t) => (
                  <option key={t} value={t}>
                    {ITSM_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Process">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={process}
                onChange={(e) => setProcess(e.target.value as OperationalProcess)}
              >
                {(Object.keys(PROCESS_LABELS) as OperationalProcess[]).map((p) => (
                  <option key={p} value={p}>
                    {PROCESS_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Merchant ID">
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="MID-xxxxxx"
              />
            </Field>
            <Field label="Vendor">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              >
                {vendorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lokasi">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value as TicketLocation)}
              >
                {locations.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label} · {loc.slaZone === "DALAM_KOTA" ? "Dalam Kota" : loc.slaZone === "LUAR_KOTA" ? "Luar Kota" : "Luar Pulau"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioritas">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Deskripsi">
                <textarea
                  className="min-h-[56px] w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail incident / request / problem / change"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="button" className="h-11 w-full sm:h-8 sm:w-auto" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Ticket className="h-4 w-4" />
              Aksi Tiket Terpilih
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {selected
                ? `${selected.ticketNumber} · ${ITSM_TYPE_LABELS[selected.itsmType]} · ${TICKET_STATUS_LABELS[selected.status]}`
                : "Pilih tiket di tabel"}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <TicketActions
              selected={selected}
              assignToId={assignToId}
              setAssignToId={setAssignToId}
              technicianName={technicianName}
              setTechnicianName={setTechnicianName}
              linkProblemId={linkProblemId}
              setLinkProblemId={setLinkProblemId}
              nocCandidates={nocCandidates}
              problems={problems}
              onAssign={handleAssign}
              onLinkProblem={handleLinkProblem}
              onTransition={handleTransition}
              message={message}
              error={error}
            />
          </CardContent>
        </Card>
      </div>

      <AiInsightPanel
        ticket={
          selected
            ? {
                id: selected.id,
                ticketNumber: selected.ticketNumber,
                itsmType: selected.itsmType,
                process: selected.process,
                merchantId: selected.merchantId,
                location: selected.location,
                category: selected.category,
                status: selected.status,
                description: selected.description,
                slaStatus: selected.slaStatus,
                elapsedLabel: selected.elapsedLabel,
                remainingMs: selected.remainingMs,
                needsEscalation: selected.needsEscalation,
                vendorName: selected.vendorName,
                problemId: selected.problemId,
                nocOwnerName: selected.nocOwnerName,
                activities: selected.activities,
              }
            : null
        }
        onNotifyAssign={async () => {
          await dispatchNotification("assign");
        }}
        onNotifySla={async (level) => {
          await dispatchNotification("sla", level);
        }}
      />

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold tracking-wide">Antrian ITSM</h2>
          <p className="text-xs text-muted-foreground">
            SLA kontrak + OLA Ack / Dispatch
          </p>
        </div>

        {/* Mobile card queue */}
        <ul className="divide-y divide-border md:hidden">
          {visible.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Tidak ada tiket.
            </li>
          ) : (
            visible.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors ${
                    selectedId === ticket.id ? "bg-muted/60" : "active:bg-muted/40"
                  }`}
                  onClick={() => {
                    setSelectedId(ticket.id);
                    setMobileDetailOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {ticket.ticketNumber}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary">{ITSM_TYPE_LABELS[ticket.itsmType]}</Badge>
                    <Badge variant={slaVariant(ticket.slaStatus)}>
                      SLA {SLA_LABELS[ticket.slaStatus]}
                    </Badge>
                    {ticket.olaAckStatus && (
                      <Badge variant={slaVariant(ticket.olaAckStatus)}>
                        Ack {OLA_STATUS_LABELS[ticket.olaAckStatus]}
                      </Badge>
                    )}
                    {ticket.olaDispatchStatus && (
                      <Badge variant={slaVariant(ticket.olaDispatchStatus)}>
                        Disp {OLA_STATUS_LABELS[ticket.olaDispatchStatus]}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {ticket.merchantId} · {ticket.nocOwnerName || "Unassigned"}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {ticket.description}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiket</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Process</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>OLA Ack</TableHead>
                <TableHead>OLA Disp</TableHead>
                <TableHead>Links</TableHead>
                <TableHead>NOC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className={selectedId === ticket.id ? "bg-muted/50" : "cursor-pointer"}
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {ticket.ticketNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ITSM_TYPE_LABELS[ticket.itsmType]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{PROCESS_LABELS[ticket.process]}</TableCell>
                  <TableCell className="font-mono text-xs">{ticket.merchantId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={slaVariant(ticket.slaStatus)}>
                      {SLA_LABELS[ticket.slaStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ticket.olaAckStatus ? (
                      <Badge
                        variant={slaVariant(ticket.olaAckStatus)}
                        title={ticket.ola.acknowledge?.policyName}
                      >
                        {OLA_STATUS_LABELS[ticket.olaAckStatus]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ticket.olaDispatchStatus ? (
                      <Badge
                        variant={slaVariant(ticket.olaDispatchStatus)}
                        title={ticket.ola.dispatch?.policyName}
                      >
                        {OLA_STATUS_LABELS[ticket.olaDispatchStatus]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {ticket.problemId ? `PRB:${ticket.problemId}` : ""}
                    {ticket.relatedChangeId ? ` CHG:${ticket.relatedChangeId}` : ""}
                    {!ticket.problemId && !ticket.relatedChangeId ? "—" : ""}
                  </TableCell>
                  <TableCell>{ticket.nocOwnerName || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {selected && (
        <section className="hidden rounded-lg border border-border bg-card md:block">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-sm font-semibold tracking-wide">
              Activity Log · {selected.ticketNumber}
            </h2>
            <p className="text-xs text-muted-foreground">
              {ITSM_TYPE_LABELS[selected.itsmType]} · {PROCESS_LABELS[selected.process]} ·{" "}
              {LOCATION_LABELS[selected.location] ??
                locations.find((l) => l.code === selected.location)?.label ??
                selected.location}{" "}
              ·{" "}
              {categories.find((c) => c.code === selected.category)?.label ??
                CATEGORY_LABELS[selected.category] ??
                selected.category}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              Masuk {formatDateTime(selected.openedAt)} · elapsed {selected.elapsedLabel}
              {selected.ola.acknowledge
                ? ` · OLA Ack ${OLA_STATUS_LABELS[selected.ola.acknowledge.status]} (${selected.olaAckLabel})`
                : ""}
              {selected.ola.dispatch
                ? ` · OLA Disp ${OLA_STATUS_LABELS[selected.ola.dispatch.status]} (${selected.olaDispatchLabel})`
                : ""}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {selected.activities.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-0.5 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{activity.type}</Badge>
                  <span className="font-medium">{activity.actorName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(activity.at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{activity.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mobile detail sheet */}
      {selected && mobileDetailOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Tutup detail"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-xl border border-border bg-background pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold">
                  {selected.ticketNumber}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {ITSM_TYPE_LABELS[selected.itsmType]} ·{" "}
                  {TICKET_STATUS_LABELS[selected.status]}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setMobileDetailOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 p-3">
              <p className="text-xs text-muted-foreground">{selected.description}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant={slaVariant(selected.slaStatus)}>
                  SLA {SLA_LABELS[selected.slaStatus]}
                </Badge>
                {selected.olaAckStatus && (
                  <Badge variant={slaVariant(selected.olaAckStatus)}>
                    Ack {OLA_STATUS_LABELS[selected.olaAckStatus]}
                  </Badge>
                )}
                {selected.olaDispatchStatus && (
                  <Badge variant={slaVariant(selected.olaDispatchStatus)}>
                    Disp {OLA_STATUS_LABELS[selected.olaDispatchStatus]}
                  </Badge>
                )}
              </div>
              <TicketActions
                selected={selected}
                assignToId={assignToId}
                setAssignToId={setAssignToId}
                technicianName={technicianName}
                setTechnicianName={setTechnicianName}
                linkProblemId={linkProblemId}
                setLinkProblemId={setLinkProblemId}
                nocCandidates={nocCandidates}
                problems={problems}
                onAssign={handleAssign}
                onLinkProblem={handleLinkProblem}
                onTransition={handleTransition}
                message={message}
                error={error}
                touch
              />
              <div>
                <p className="mb-1 text-xs font-semibold">Activity</p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {selected.activities.slice(0, 8).map((activity) => (
                    <li key={activity.id} className="px-2.5 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{activity.type}</Badge>
                        <span className="font-medium">{activity.actorName}</span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{activity.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketActions({
  selected,
  assignToId,
  setAssignToId,
  technicianName,
  setTechnicianName,
  linkProblemId,
  setLinkProblemId,
  nocCandidates,
  problems,
  onAssign,
  onLinkProblem,
  onTransition,
  message,
  error,
  touch,
}: {
  selected: ReturnType<typeof enrichOpsTicket> | null;
  assignToId: string;
  setAssignToId: (v: string) => void;
  technicianName: string;
  setTechnicianName: (v: string) => void;
  linkProblemId: string;
  setLinkProblemId: (v: string) => void;
  nocCandidates: NocUser[];
  problems: OpsTicket[];
  onAssign: () => void;
  onLinkProblem: () => void;
  onTransition: (s: WorkflowTicketStatus) => void;
  message: string | null;
  error: string | null;
  touch?: boolean;
}) {
  const ctrl = touch ? "h-11 text-sm" : "h-9 text-sm";
  return (
    <>
      <Field label="Assign NOC Owner">
        <div className="flex gap-2">
          <select
            className={`${ctrl} flex-1 rounded-md border border-input bg-background px-2`}
            value={assignToId}
            onChange={(e) => setAssignToId(e.target.value)}
            disabled={!selected}
          >
            {nocCandidates.map((u: NocUser) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            className={touch ? "h-11" : undefined}
            disabled={!selected}
            onClick={onAssign}
          >
            Assign
          </Button>
        </div>
      </Field>

      <Field label="Nama teknisi (saat Dispatch)">
        <input
          className={`${ctrl} w-full rounded-md border border-input bg-background px-2`}
          value={technicianName}
          onChange={(e) => setTechnicianName(e.target.value)}
          placeholder="Teknisi lapangan"
          disabled={!selected}
        />
      </Field>

      {selected?.itsmType === "INCIDENT" && (
        <Field label="Link ke Problem">
          <div className="flex gap-2">
            <select
              className={`${ctrl} flex-1 rounded-md border border-input bg-background px-2`}
              value={linkProblemId}
              onChange={(e) => setLinkProblemId(e.target.value)}
            >
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ticketNumber}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className={touch ? "h-11" : undefined}
              disabled={!selected || problems.length === 0}
              onClick={onLinkProblem}
            >
              Link
            </Button>
          </div>
        </Field>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(selected ? nextStatuses(selected.status) : []).map((status) => (
          <Button
            key={status}
            type="button"
            size={touch ? "default" : "xs"}
            className={touch ? "h-11" : undefined}
            variant="outline"
            onClick={() => onTransition(status)}
          >
            → {TICKET_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      {selected?.needsEscalation && (
        <p className="inline-flex items-center gap-1.5 rounded-md border border-sla-warning/40 bg-sla-warning/10 px-2 py-1.5 text-xs text-sla-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          SLA {SLA_LABELS[selected.slaStatus]} — eskalasi ke Supervisor
        </p>
      )}

      {message && <p className="text-xs text-sla-safe">{message}</p>}
      {error && <p className="text-xs text-sla-breached">{error}</p>}
    </>
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
        <CardTitle className="text-[11px] sm:text-xs">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`font-mono text-lg font-semibold tabular-nums sm:text-xl ${
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
