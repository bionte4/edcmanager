"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiInsightResult } from "@/ai/insight";
import type { EnrichedTicket } from "@/data/dashboard";
import { MOCK_OPS_TICKETS } from "@/data/noc";
import { enrichOpsTicket } from "@/lib/ticketing";
import { DEMO_AS_OF } from "@/data/dashboard";

export function DashboardAiBriefing({
  dashboardTickets,
}: {
  dashboardTickets: EnrichedTicket[];
}) {
  const [insight, setInsight] = useState<AiInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const ops = MOCK_OPS_TICKETS.map((t) => enrichOpsTicket(t, DEMO_AS_OF));
      const payload = [
        ...ops.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          itsmType: t.itsmType,
          process: t.process,
          merchantId: t.merchantId,
          location: t.location,
          category: t.category,
          status: t.status,
          description: t.description,
          slaStatus: t.slaStatus,
          elapsedLabel: t.elapsedLabel,
          remainingMs: t.remainingMs,
          needsEscalation: t.needsEscalation,
          vendorName: t.vendorName,
          problemId: t.problemId,
        })),
        ...dashboardTickets.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          itsmType: "INCIDENT" as const,
          process: "CM",
          merchantId: t.merchantId,
          location: t.location,
          category: t.category,
          status: t.closedAt ? "CLOSED" : "OPEN",
          description: `Dashboard ticket ${t.ticketNumber}`,
          slaStatus: t.slaStatus,
          elapsedLabel: t.elapsedLabel,
          needsEscalation: t.slaStatus === "WARNING" || t.slaStatus === "BREACHED",
          vendorName: t.vendorName,
        })),
      ];

      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "briefing", tickets: payload }),
      });
      const data = (await res.json()) as { insight?: AiInsightResult; error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal generate briefing");
      setInsight(data.insight ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5 text-foreground">
          <Brain className="h-3.5 w-3.5" />
          AI Shift Briefing
        </CardTitle>
        <Button type="button" size="xs" variant="outline" disabled={loading} onClick={() => void generate()}>
          {loading ? "Generating…" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {!insight && (
          <p className="text-[11px] text-muted-foreground">
            Ringkasan prioritas NOC berdasarkan antrian aktif & risiko SLA.
          </p>
        )}
        {insight && (
          <div className="space-y-1.5">
            <Badge
              variant={
                insight.riskLevel === "LOW"
                  ? "safe"
                  : insight.riskLevel === "MEDIUM"
                    ? "warning"
                    : "breached"
              }
            >
              Top risk {insight.riskScore} · {insight.riskLevel}
            </Badge>
            <p className="text-xs">{insight.summary}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
              {insight.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="mt-1.5 text-[11px] text-sla-breached">{error}</p>}
      </CardContent>
    </Card>
  );
}
