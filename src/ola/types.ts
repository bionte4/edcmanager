import type { ItsmType, OperationalProcess } from "@/config/itsm.config";
import type { OlaStage } from "@/config/ola.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";

export type OlaEvaluationStatus =
  | "ON_TRACK"
  | "WARNING"
  | "BREACHED"
  | "ACHIEVED";

export interface OlaPolicy {
  id: string;
  name: string;
  stage: OlaStage;
  limitMinutes: number;
  warningThreshold: number;
  itsmType: ItsmType | "*";
  location: TicketLocation | "*";
  category: TicketCategory | "*";
  process: OperationalProcess | "*";
  isActive: boolean;
  priority: number;
  updatedAt: string;
}

export interface OlaTicketInput {
  itsmType: ItsmType;
  process: OperationalProcess;
  location: TicketLocation;
  category: TicketCategory;
  openedAt: Date;
  acknowledgedAt?: Date | null;
  dispatchedAt?: Date | null;
  closedAt?: Date | null;
}

export interface OlaStageEvaluation {
  stage: OlaStage;
  status: OlaEvaluationStatus;
  policyId: string;
  policyName: string;
  limitMinutes: number;
  limitMs: number;
  warningAtMs: number;
  elapsedMs: number;
  elapsedRatio: number;
  remainingMs: number;
  deadlineAt: Date;
  startedAt: Date;
  completedAt: Date | null;
  evaluatedAt: Date;
}

export interface TicketOlaBundle {
  acknowledge: OlaStageEvaluation | null;
  dispatch: OlaStageEvaluation | null;
  needsEscalation: boolean;
}
