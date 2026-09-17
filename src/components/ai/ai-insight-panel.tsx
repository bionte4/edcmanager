"use client";

import { useState } from "react";
import { Brain, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiInsightResult } from "@/ai/insight";

interface TicketInsightPayload {
  id: string;
  ticketNumber: string;
  itsmType: string;
  process: string;
  merchantId: string;
  location: string;
  category: string;
  status: string;
  description: string;
  slaStatus?: string;
  elapsedLabel?: string;
  remainingMs?: number;
  needsEscalation?: boolean;
  vendorName?: string;
  problemId?: string | null;
  nocOwnerName?: string | null;
  activities?: Array<{ type: string; note: string; at: string }>;
}

function riskVariant(
  level: AiInsightResult["riskLevel"]
): "safe" | "warning" | "breached" | "secondary" {
  if (level === "LOW") return "safe";
  if (level === "MEDIUM") return "warning";
  return "breached";
}

export function AiInsightPanel({
  ticket,
  onNotifyAssign,
  onNotifySla,
}: {
  ticket: TicketInsightPayload | null;
  onNotifyAssign?: () => Promise<void>;
  onNotifySla?: (level: "WARNING" | "BREACHED") => Promise<void>;
}) {
  const [insight, setInsight] = useState<AiInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!ticket) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ticket", ticket }),
      });
      const data = (await res.json()) as {
        insight?: AiInsightResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Gagal generate insight");
      setInsight(data.insight ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function runNotify(kind: "assign" | "warning" | "breached") {
    setNotifyMsg(null);
    try {
      if (kind === "assign") await onNotifyAssign?.();
      if (kind === "warning") await onNotifySla?.("WARNING");
      if (kind === "breached") await onNotifySla?.("BREACHED");
      setNotifyMsg(
        kind === "assign"
          ? "Email assign dikirim/disimulasikan."
          : `Email SLA ${kind.toUpperCase()} dikirim/disimulasikan.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notify gagal");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Brain className="h-4 w-4" />
            AI Insight & Alerts
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Advisory only — SLA tetap dihitung oleh rules engine
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ticket || loading}
          onClick={() => void generate()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Generate
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ticket && (
          <p className="text-xs text-muted-foreground">Pilih tiket untuk insight.</p>
        )}

        {insight && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={riskVariant(insight.riskLevel)}>
                Risk {insight.riskScore} · {insight.riskLevel}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                {insight.provider}
              </Badge>
            </div>
            <p className="text-sm">{insight.summary}</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {insight.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!ticket}
            onClick={() => void runNotify("assign")}
          >
            <Mail className="h-3.5 w-3.5" />
            Email Assign
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!ticket}
            onClick={() => void runNotify("warning")}
          >
            <Mail className="h-3.5 w-3.5" />
            Email SLA Warning
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!ticket}
            onClick={() => void runNotify("breached")}
          >
            <Mail className="h-3.5 w-3.5" />
            Email SLA Breach
          </Button>
        </div>

        {notifyMsg && <p className="text-xs text-sla-safe">{notifyMsg}</p>}
        {error && <p className="text-xs text-sla-breached">{error}</p>}
      </CardContent>
    </Card>
  );
}
