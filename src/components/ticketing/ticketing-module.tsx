"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Ticket } from "lucide-react";
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
import { MOCK_OPS_TICKETS, MOCK_USERS } from "@/data/noc";
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
  const [tickets, setTickets] = useState<OpsTicket[]>(MOCK_OPS_TICKETS);
  const [olaPolicies, setOlaPolicies] = useState<OlaPolicy[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_OPS_TICKETS[0]?.id ?? null);
  const [typeFilter, setTypeFilter] = useState<ItsmType | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [itsmType, setItsmType] = useState<ItsmType>("INCIDENT");
  const [process, setProcess] = useState<OperationalProcess>("CM");
  const [merchantId, setMerchantId] = useState("");
  const [location, setLocation] = useState<TicketLocation>("DALAM_KOTA");
  const [category, setCategory] = useState<TicketCategory>("VIP");
  const [vendorName, setVendorName] = useState("Vendor 1");
  const [description, setDescription] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [assignToId, setAssignToId] = useState("u-noc-1");
  const [linkProblemId, setLinkProblemId] = useState("t-prb-1");

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

  useEffect(() => {
    void loadOla();
  }, [loadOla]);

  const actor: NocUser | null = user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      }
    : null;
  const nocCandidates = MOCK_USERS.filter(
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
    const owner = MOCK_USERS.find((u) => u.id === selected.nocOwnerId);
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
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi title="Aktif" value={String(openCount)} />
        <Kpi title="Eskalasi SLA" value={String(escalateCount)} tone="warn" />
        <Kpi title="Eskalasi OLA" value={String(olaEscalateCount)} tone="warn" />
        <Kpi title="Incident" value={String(counts.INCIDENT)} />
        <Kpi title="Request / Problem / Change" value={`${counts.REQUEST}/${counts.PROBLEM}/${counts.CHANGE}`} />
        <Kpi title="Total" value={String(tickets.length)} />
      </div>

      <div className="flex flex-wrap gap-1">
        {ITSM_FILTERS.map((value) => (
          <Button
            key={value}
            type="button"
            size="xs"
            variant={typeFilter === value ? "default" : "outline"}
            onClick={() => setTypeFilter(value)}
          >
            {value === "ALL" ? "Semua ITSM" : ITSM_TYPE_LABELS[value]}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Plus className="h-4 w-4" />
              Buat Tiket ITSM
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
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
                <option>Vendor 1</option>
                <option>Vendor 2</option>
              </select>
            </Field>
            <Field label="Lokasi">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value as TicketLocation)}
              >
                <option value="DALAM_KOTA">Dalam Kota</option>
                <option value="LUAR_KOTA">Luar Kota</option>
                <option value="LUAR_PULAU">Luar Pulau</option>
              </select>
            </Field>
            <Field label="Prioritas">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
              >
                <option value="VIP">VIP</option>
                <option value="NON_VIP">Non-VIP</option>
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
              <Button type="button" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
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
            <Field label="Assign NOC Owner">
              <div className="flex gap-2">
                <select
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
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
                <Button type="button" variant="outline" disabled={!selected} onClick={handleAssign}>
                  Assign
                </Button>
              </div>
            </Field>

            <Field label="Nama teknisi (saat Dispatch)">
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
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
                    disabled={!selected || problems.length === 0}
                    onClick={handleLinkProblem}
                  >
                    Link
                  </Button>
                </div>
              </Field>
            )}

            <div className="flex flex-wrap gap-1">
              {(selected ? nextStatuses(selected.status) : []).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => handleTransition(status)}
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
            Incident (CM), Request, Problem, Change — SLA kontrak + OLA internal (Ack / Dispatch)
          </p>
        </div>
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
                    <Badge variant={slaVariant(ticket.olaAckStatus)} title={ticket.ola.acknowledge?.policyName}>
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
      </section>

      {selected && (
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-sm font-semibold tracking-wide">
              Activity Log · {selected.ticketNumber}
            </h2>
            <p className="text-xs text-muted-foreground">
              {ITSM_TYPE_LABELS[selected.itsmType]} · {PROCESS_LABELS[selected.process]} ·{" "}
              {LOCATION_LABELS[selected.location]} · {CATEGORY_LABELS[selected.category]}
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
