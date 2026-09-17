import { OLA_WARNING_THRESHOLD, type OlaStage } from "@/config/ola.config";
import { selectPolicyForStage } from "./match";
import type {
  OlaEvaluationStatus,
  OlaPolicy,
  OlaStageEvaluation,
  OlaTicketInput,
  TicketOlaBundle,
} from "./types";

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function stageWindow(
  stage: OlaStage,
  ticket: OlaTicketInput
): { startedAt: Date; completedAt: Date | null } | null {
  if (stage === "ACKNOWLEDGE") {
    return {
      startedAt: ticket.openedAt,
      completedAt: ticket.acknowledgedAt ?? null,
    };
  }

  const startedAt = ticket.acknowledgedAt ?? ticket.openedAt;
  return {
    startedAt,
    completedAt: ticket.dispatchedAt ?? null,
  };
}

function resolveStatus(args: {
  elapsedMs: number;
  limitMs: number;
  warningAtMs: number;
  completedAt: Date | null;
  closedAt?: Date | null;
}): OlaEvaluationStatus {
  const { elapsedMs, limitMs, warningAtMs, completedAt, closedAt } = args;

  if (elapsedMs >= limitMs) return "BREACHED";
  if (completedAt) return "ACHIEVED";
  if (closedAt && !completedAt) return "BREACHED";
  if (elapsedMs >= warningAtMs) return "WARNING";
  return "ON_TRACK";
}

export function evaluateOlaStage(
  stage: OlaStage,
  ticket: OlaTicketInput,
  policies: OlaPolicy[],
  asOf: Date = new Date()
): OlaStageEvaluation | null {
  const policy = selectPolicyForStage(stage, ticket, policies);
  if (!policy) return null;

  const window = stageWindow(stage, ticket);
  if (!window) return null;

  const { startedAt, completedAt } = window;
  const endAt = completedAt ?? ticket.closedAt ?? asOf;
  const elapsedMs = Math.max(0, endAt.getTime() - startedAt.getTime());
  const limitMs = policy.limitMinutes * 60_000;
  const threshold = policy.warningThreshold ?? OLA_WARNING_THRESHOLD;
  const warningAtMs = limitMs * threshold;
  const deadlineAt = new Date(startedAt.getTime() + limitMs);

  const status = resolveStatus({
    elapsedMs,
    limitMs,
    warningAtMs,
    completedAt,
    closedAt: ticket.closedAt,
  });

  return {
    stage,
    status,
    policyId: policy.id,
    policyName: policy.name,
    limitMinutes: policy.limitMinutes,
    limitMs,
    warningAtMs,
    elapsedMs,
    elapsedRatio: limitMs > 0 ? elapsedMs / limitMs : 0,
    remainingMs: limitMs - elapsedMs,
    deadlineAt,
    startedAt,
    completedAt,
    evaluatedAt: asOf,
  };
}

export function evaluateTicketOla(
  ticket: OlaTicketInput,
  policies: OlaPolicy[],
  asOf: Date = new Date()
): TicketOlaBundle {
  const acknowledge = evaluateOlaStage("ACKNOWLEDGE", ticket, policies, asOf);
  const dispatch = evaluateOlaStage("DISPATCH", ticket, policies, asOf);
  const needsEscalation = [acknowledge, dispatch].some(
    (e) => e?.status === "WARNING" || e?.status === "BREACHED"
  );

  return { acknowledge, dispatch, needsEscalation };
}

export function formatOlaElapsed(evaluation: OlaStageEvaluation): string {
  return formatElapsed(evaluation.elapsedMs);
}

export const OLA_STATUS_LABELS: Record<OlaEvaluationStatus, string> = {
  ON_TRACK: "Aman",
  WARNING: "Warning",
  BREACHED: "Breached",
  ACHIEVED: "Achieved",
};
