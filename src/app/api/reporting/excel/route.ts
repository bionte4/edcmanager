import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_AS_OF } from "@/data/dashboard";
import { buildOpsReportWorkbook } from "@/data/reporting";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, type AuthUser } from "@/lib/rbac";

async function requireUser(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  return sessionToAuthUser(session);
}

function statusFor(e: unknown): number {
  const message = e instanceof Error ? e.message : "Error";
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 400;
}

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "report:export");
    const buffer = buildOpsReportWorkbook(DEMO_AS_OF);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="edc-ops-report-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export gagal" },
      { status: statusFor(e) }
    );
  }
}
