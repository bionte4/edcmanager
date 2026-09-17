import { AI_CONFIG, isLlmConfigured } from "@/config/ai.config";
import { getAiSettings } from "@/data/connector-settings-store";
import { getCategorySlaProfile } from "@/data/ticket-categories-store";
import type { ItsmType } from "@/config/itsm.config";

export interface InsightTicketInput {
  id: string;
  ticketNumber: string;
  itsmType: ItsmType;
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
  activities?: Array<{ type: string; note: string; at: string }>;
}

export interface AiInsightResult {
  title: string;
  summary: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
  provider: "heuristic" | "llm";
  generatedAt: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Deterministic SLA risk score 0–100 (advisory only). */
export function computeSlaRiskScore(ticket: InsightTicketInput): number {
  let score = 20;

  if (ticket.itsmType === "INCIDENT") score += 15;
  if (getCategorySlaProfile(ticket.category) === "VIP") score += 20;
  if (ticket.location === "DALAM_KOTA") score += 5;
  if (ticket.needsEscalation) score += 25;
  if (ticket.slaStatus === "WARNING") score += 20;
  if (ticket.slaStatus === "BREACHED") score += 40;
  if (ticket.status === "OPEN") score += 10;
  if (ticket.status === "IN_PROGRESS") score += 5;
  if (ticket.problemId) score += 8;
  if ((ticket.activities?.length ?? 0) === 0) score += 5;

  if (typeof ticket.remainingMs === "number") {
    const hoursLeft = ticket.remainingMs / (60 * 60 * 1000);
    if (hoursLeft < 0) score += 30;
    else if (hoursLeft < 0.5) score += 20;
    else if (hoursLeft < 2) score += 10;
  }

  return clamp(Math.round(score), 0, 100);
}

function riskLevel(score: number): AiInsightResult["riskLevel"] {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function heuristicInsight(ticket: InsightTicketInput): AiInsightResult {
  const riskScore = computeSlaRiskScore(ticket);
  const recommendations: string[] = [];

  if (ticket.slaStatus === "BREACHED" || riskScore >= 85) {
    recommendations.push("Eskalasi segera ke Supervisor dan update stakeholder merchant.");
  } else if (ticket.slaStatus === "WARNING" || riskScore >= 65) {
    recommendations.push("Dispatch teknisi sekarang dan pantau sisa SLA setiap 15 menit.");
  } else {
    recommendations.push("Lanjutkan proses normal; pastikan acknowledge < 15 menit.");
  }

  if (
    ticket.itsmType === "INCIDENT" &&
    !ticket.problemId &&
    getCategorySlaProfile(ticket.category) === "VIP"
  ) {
    recommendations.push("Pertimbangkan link ke Problem jika pola berulang di RO yang sama.");
  }
  if (ticket.itsmType === "REQUEST") {
    recommendations.push("Validasi kelengkapan request (lokasi, unit, jadwal install) sebelum fulfill.");
  }
  if (ticket.itsmType === "CHANGE") {
    recommendations.push("Pastikan window Change dan rollback plan sudah disetujui Ops.");
  }
  if (ticket.itsmType === "PROBLEM") {
    recommendations.push("Kumpulkan incident terkait dan buat known-error / Change mitigasi.");
  }

  const summary = [
    `${ticket.ticketNumber} adalah ${ticket.itsmType} (${ticket.process}) untuk ${ticket.merchantId}.`,
    `Status ${ticket.status}, prioritas ${ticket.category}, lokasi ${ticket.location}.`,
    ticket.slaStatus
      ? `SLA saat ini ${ticket.slaStatus}${ticket.elapsedLabel ? ` setelah ${ticket.elapsedLabel}` : ""}.`
      : null,
    ticket.description ? `Konteks: ${ticket.description.slice(0, 160)}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `Insight · ${ticket.ticketNumber}`,
    summary,
    riskScore,
    riskLevel: riskLevel(riskScore),
    recommendations,
    provider: "heuristic",
    generatedAt: new Date().toISOString(),
  };
}

async function llmPolish(base: AiInsightResult, ticket: InsightTicketInput): Promise<AiInsightResult> {
  if (!isLlmConfigured()) return base;

  const cfg = getAiSettings();

  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are an EDC operations assistant. Return concise JSON with keys summary (string) and recommendations (string[]). Do not invent SLA deadlines. Advisory only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              ticket,
              heuristic: base,
            }),
          },
        ],
      }),
    });

    if (!res.ok) return base;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return base;

    const parsed = JSON.parse(content) as {
      summary?: string;
      recommendations?: string[];
    };

    return {
      ...base,
      summary: parsed.summary?.trim() || base.summary,
      recommendations:
        parsed.recommendations?.filter(Boolean).length
          ? parsed.recommendations
          : base.recommendations,
      provider: "llm",
    };
  } catch {
    return base;
  }
}

export async function generateTicketInsight(
  ticket: InsightTicketInput
): Promise<AiInsightResult> {
  if (!AI_CONFIG.enabled) {
    throw new Error("AI insights are disabled");
  }
  const base = heuristicInsight(ticket);
  return llmPolish(base, ticket);
}

export function buildShiftBriefing(
  tickets: InsightTicketInput[]
): AiInsightResult {
  const open = tickets.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED");
  const atRisk = open.filter(
    (t) => t.needsEscalation || t.slaStatus === "WARNING" || t.slaStatus === "BREACHED"
  );
  const incidents = open.filter((t) => t.itsmType === "INCIDENT").length;

  const top = [...open]
    .map((t) => ({ t, score: computeSlaRiskScore(t) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const summary = `Shift briefing: ${open.length} tiket aktif (${incidents} incident), ${atRisk.length} mendekati/breach SLA. Fokus utama: ${
    top.map((x) => x.t.ticketNumber).join(", ") || "antrian kosong"
  }.`;

  return {
    title: "NOC Shift Briefing",
    summary,
    riskScore: top[0]?.score ?? 0,
    riskLevel: riskLevel(top[0]?.score ?? 0),
    recommendations: [
      atRisk.length
        ? `Prioritaskan ${atRisk.length} tiket at-risk sebelum tiket Request/Change.`
        : "Tidak ada tiket at-risk — lanjut triage Request/Change.",
      "Konfirmasi NOC on-duty dan handover catatan shift sebelumnya.",
      "Cek buffer stock RO deficit sebelum dispatch massal.",
    ],
    provider: "heuristic",
    generatedAt: new Date().toISOString(),
  };
}
