import type { OlaPolicy, OlaTicketInput } from "./types";
import type { OlaStage } from "@/config/ola.config";

function fieldScore(policyValue: string, ticketValue: string): number | null {
  if (policyValue === "*") return 0;
  if (policyValue === ticketValue) return 10;
  return null;
}

/** Higher score = more specific match. null = no match. */
export function policyMatchScore(
  policy: OlaPolicy,
  ticket: OlaTicketInput
): number | null {
  if (!policy.isActive) return null;

  const parts = [
    fieldScore(policy.itsmType, ticket.itsmType),
    fieldScore(policy.location, ticket.location),
    fieldScore(policy.category, ticket.category),
    fieldScore(policy.process, ticket.process),
  ];

  if (parts.some((p) => p === null)) return null;
  const specificity = parts.reduce<number>((sum, p) => sum + (p ?? 0), 0);
  return specificity * 1000 + policy.priority;
}

export function selectPolicyForStage(
  stage: OlaStage,
  ticket: OlaTicketInput,
  policies: OlaPolicy[]
): OlaPolicy | null {
  let best: OlaPolicy | null = null;
  let bestScore = -1;

  for (const policy of policies) {
    if (policy.stage !== stage) continue;
    const score = policyMatchScore(policy, ticket);
    if (score == null) continue;
    if (score > bestScore) {
      bestScore = score;
      best = policy;
    }
  }

  return best;
}
