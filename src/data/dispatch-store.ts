import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  DISPATCH_CONFIG,
  homeRosForTech,
  isTechStandby,
} from "@/config/dispatch.config";
import { listAssets } from "@/data/assets-store";
import { findLocationByCode, listLocations } from "@/data/locations-store";
import { listOpsTickets } from "@/data/tickets-store";
import { listUsers } from "@/data/users-store";
import type { OpsTicket } from "@/lib/ticketing";

export interface RoCapacityRow {
  regionalOffice: string;
  merchantCount: number;
  techCount: number;
  targetTechs: number;
  ratio: number | null;
  /** merchants per tech; null if no tech */
  actualRatio: number | null;
  overloaded: boolean;
  understaffed: boolean;
}

export interface DispatchCandidate {
  userId: string;
  name: string;
  email: string;
  openTickets: number;
  homeRos: string[];
  roMatch: boolean;
  standby: boolean;
  score: number;
  reasons: string[];
}

export interface DispatchSuggestResult {
  ticketId?: string;
  ticketNumber?: string;
  regionalOffice: string | null;
  locationCode?: string;
  merchantsInRo: number;
  techCountInRo: number;
  targetRatio: number;
  targetTechsForRo: number;
  capacityOk: boolean;
  candidates: DispatchCandidate[];
}

function isOpenTicket(t: OpsTicket): boolean {
  return t.status !== "CLOSED" && t.status !== "RESOLVED";
}

async function merchantsByRo(): Promise<Map<string, number>> {
  const assets = await listAssets();
  const map = new Map<string, Set<string>>();
  for (const a of assets) {
    if (a.status !== "DEPLOYED" || !a.merchantId?.trim()) continue;
    const set = map.get(a.regionalOffice) ?? new Set<string>();
    set.add(a.merchantId.trim().toUpperCase());
    map.set(a.regionalOffice, set);
  }
  const counts = new Map<string, number>();
  for (const ro of REGIONAL_OFFICES) {
    counts.set(ro, map.get(ro)?.size ?? 0);
  }
  for (const [ro, set] of map) {
    if (!counts.has(ro)) counts.set(ro, set.size);
  }
  return counts;
}

async function resolveTicketRo(
  ticket: OpsTicket
): Promise<{ regionalOffice: string | null; locationCode: string }> {
  await listLocations({ activeOnly: true });
  const loc = findLocationByCode(ticket.location);
  return {
    regionalOffice: loc?.regionalOffice ?? null,
    locationCode: ticket.location,
  };
}

function scoreCandidate(input: {
  openTickets: number;
  roMatch: boolean;
  standby: boolean;
}): { score: number; reasons: string[] } {
  const { weights, openTicketSoftCap } = DISPATCH_CONFIG;
  const reasons: string[] = [];

  const loadFactor = Math.max(
    0,
    1 - input.openTickets / Math.max(openTicketSoftCap, 1)
  );
  const loadScore = loadFactor * weights.openLoad;
  reasons.push(
    input.openTickets === 0
      ? "beban 0 tiket terbuka"
      : `beban ${input.openTickets} tiket terbuka`
  );

  const roScore = input.roMatch ? weights.roMatch : 0;
  if (input.roMatch) reasons.push("home RO cocok");
  else reasons.push("di luar home RO");

  const standbyScore = input.standby ? weights.standby : 0;
  if (input.standby) reasons.push("standby");

  return {
    score: Number((loadScore + roScore + standbyScore).toFixed(4)),
    reasons,
  };
}

export async function getRoCapacityBoard(): Promise<RoCapacityRow[]> {
  const [merchantCounts, users] = await Promise.all([
    merchantsByRo(),
    listUsers(false),
  ]);
  const techs = users.filter(
    (u) => u.role === "VENDOR_TECH" && u.isActive && !u.deletedAt
  );

  return REGIONAL_OFFICES.map((ro) => {
    const merchantCount = merchantCounts.get(ro) ?? 0;
    const techCount = techs.filter((t) =>
      homeRosForTech(t.email, t.name).includes(ro)
    ).length;
    const targetTechs = Math.max(
      1,
      Math.ceil(merchantCount / DISPATCH_CONFIG.targetTechMerchantRatio)
    );
    const actualRatio =
      techCount > 0 ? merchantCount / techCount : merchantCount > 0 ? null : 0;
    const understaffed = techCount < targetTechs;
    const overloaded =
      actualRatio != null &&
      actualRatio > DISPATCH_CONFIG.targetTechMerchantRatio;
    return {
      regionalOffice: ro,
      merchantCount,
      techCount,
      targetTechs,
      ratio: DISPATCH_CONFIG.targetTechMerchantRatio,
      actualRatio:
        actualRatio === null
          ? null
          : Number(actualRatio.toFixed(1)),
      overloaded,
      understaffed,
    };
  });
}

export async function suggestDispatch(input: {
  ticketId?: string;
  regionalOffice?: string;
  locationCode?: string;
  limit?: number;
}): Promise<DispatchSuggestResult> {
  const [tickets, users, merchantCounts] = await Promise.all([
    listOpsTickets(),
    listUsers(false),
    merchantsByRo(),
  ]);

  let ticket: OpsTicket | undefined;
  let regionalOffice = input.regionalOffice?.trim() || null;
  let locationCode = input.locationCode?.trim();

  if (input.ticketId) {
    ticket = tickets.find(
      (t) => t.id === input.ticketId || t.ticketNumber === input.ticketId
    );
    if (!ticket) {
      throw Object.assign(new Error("Ticket not found"), { status: 404 });
    }
    const resolved = await resolveTicketRo(ticket);
    regionalOffice = regionalOffice ?? resolved.regionalOffice;
    locationCode = locationCode ?? resolved.locationCode;
  }

  const openByTech = new Map<string, number>();
  for (const t of tickets.filter(isOpenTicket)) {
    const name = t.technicianName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    openByTech.set(key, (openByTech.get(key) ?? 0) + 1);
  }

  const techs = users.filter(
    (u) => u.role === "VENDOR_TECH" && u.isActive && !u.deletedAt
  );

  const merchantsInRo = regionalOffice
    ? merchantCounts.get(regionalOffice) ?? 0
    : 0;
  const techCountInRo = regionalOffice
    ? techs.filter((t) =>
        homeRosForTech(t.email, t.name).includes(regionalOffice!)
      ).length
    : techs.length;
  const targetTechsForRo = Math.max(
    1,
    Math.ceil(merchantsInRo / DISPATCH_CONFIG.targetTechMerchantRatio)
  );

  const candidates: DispatchCandidate[] = techs.map((u) => {
    const homeRos = homeRosForTech(u.email, u.name);
    const roMatch = regionalOffice
      ? homeRos.includes(regionalOffice)
      : false;
    const openTickets = openByTech.get(u.name.toLowerCase()) ?? 0;
    const standby = isTechStandby(u.email);
    const { score, reasons } = scoreCandidate({
      openTickets,
      roMatch,
      standby,
    });
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      openTickets,
      homeRos,
      roMatch,
      standby,
      score,
      reasons,
    };
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.openTickets - b.openTickets || a.name.localeCompare(b.name);
  });

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);

  return {
    ticketId: ticket?.id,
    ticketNumber: ticket?.ticketNumber,
    regionalOffice,
    locationCode,
    merchantsInRo,
    techCountInRo,
    targetRatio: DISPATCH_CONFIG.targetTechMerchantRatio,
    targetTechsForRo,
    capacityOk: techCountInRo >= targetTechsForRo || merchantsInRo === 0,
    candidates: candidates.slice(0, limit),
  };
}
