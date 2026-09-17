import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateMonthlyPm,
  getPeakSeasonSnapshot,
  getPmCalendarSnapshot,
  listCampaignRuns,
  runPeakIntensify,
} from "@/data/pm-campaign-store";
import type { PeakSeasonId } from "@/config/peak-season.config";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, can, type AuthUser } from "@/lib/rbac";
import type { NocUser } from "@/lib/ticketing";

async function requireUser(): Promise<{ auth: AuthUser; noc: NocUser }> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  const auth = sessionToAuthUser(session);
  return {
    auth,
    noc: {
      id: stored.id,
      name: stored.name,
      email: stored.email,
      phone: stored.phone ?? undefined,
      role: stored.role,
      isActive: stored.isActive,
    },
  };
}

function statusFor(e: unknown): number {
  const message = e instanceof Error ? e.message : "Error";
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 400;
}

export async function GET() {
  try {
    const { auth } = await requireUser();
    assertCan(auth, "ticket:read");
    const [pm, peak, runs] = await Promise.all([
      getPmCalendarSnapshot(),
      Promise.resolve(getPeakSeasonSnapshot()),
      listCampaignRuns(30),
    ]);
    return NextResponse.json({
      pm,
      peak,
      runs,
      canGenerate: can(auth, "ticket:create"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: statusFor(e) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { auth, noc } = await requireUser();
    const body = (await request.json()) as {
      action?: string;
      periodKey?: string;
      peakId?: PeakSeasonId;
      force?: boolean;
      notify?: boolean;
    };

    if (body.action === "generate_pm") {
      assertCan(auth, "ticket:create");
      const result = await generateMonthlyPm({
        periodKey: body.periodKey,
        actor: noc,
        force: !!body.force,
      });
      return NextResponse.json(result);
    }

    if (body.action === "peak_intensify") {
      assertCan(auth, "ticket:create");
      if (!body.peakId) throw new Error("peakId wajib.");
      const result = await runPeakIntensify({
        peakId: body.peakId,
        actor: noc,
        force: !!body.force,
        notify: body.notify !== false,
      });
      return NextResponse.json(result);
    }

    throw new Error("action: generate_pm | peak_intensify");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
