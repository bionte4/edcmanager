import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  dateInJakarta,
  resolveRosterPeriod,
  type RosterPeriodMode,
} from "@/config/wfm.config";
import { listWfmShifts, wfmKpis } from "@/data/wfm-store";
import { findUserById } from "@/data/users-store";
import {
  buildRosterExportBuffer,
  buildRosterTemplateBuffer,
  importRosterRows,
  parseRosterWorkbook,
} from "@/lib/roster-excel";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, can, type AuthUser } from "@/lib/rbac";

async function requireUser(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  return sessionToAuthUser(session);
}

function statusFor(e: unknown): number {
  const message = e instanceof Error ? e.message : "Error";
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 400;
}

function excelResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function periodFromRequest(url: URL) {
  const mode = (url.searchParams.get("mode") as RosterPeriodMode | null) ?? "week";
  const anchor = url.searchParams.get("anchor") ?? dateInJakarta();
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  return resolveRosterPeriod({
    mode: mode === "month" || mode === "range" || mode === "week" ? mode : "week",
    anchor,
    from,
    to,
  });
}

/** GET ?action=export|template&mode=week|month|range&anchor=YYYY-MM-DD */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "wfm:read");
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "export";
    const period = periodFromRequest(url);

    if (action === "template") {
      return excelResponse(
        await buildRosterTemplateBuffer({
          mode: (url.searchParams.get("mode") as RosterPeriodMode) ?? "week",
          anchor: url.searchParams.get("anchor") ?? undefined,
          from: url.searchParams.get("from") ?? undefined,
          to: url.searchParams.get("to") ?? undefined,
        }),
        `edc-roster-template-${period.from}_${period.to}.xlsx`
      );
    }

    return excelResponse(
      await buildRosterExportBuffer(period.from, period.to),
      `edc-roster-${period.from}_${period.to}.xlsx`
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export gagal" },
      { status: statusFor(e) }
    );
  }
}

/** POST multipart: file + optional importMode=merge|replace */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!can(user, "noc:manage_shift") && !can(user, "wfm:approve")) {
      throw new Error("Forbidden: missing permission noc:manage_shift or wfm:approve");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload file Excel (.xlsx) pada field `file`." },
        { status: 400 }
      );
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Format harus .xlsx atau .xls" },
        { status: 400 }
      );
    }

    const importMode =
      String(form.get("importMode") ?? "merge") === "replace"
        ? "replace"
        : "merge";

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseRosterWorkbook(buffer);
    const result = await importRosterRows(rows, { mode: importMode });

    return NextResponse.json({
      result,
      kpis: await wfmKpis(),
      shifts: await listWfmShifts({ from: result.from, to: result.to }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import gagal" },
      { status: statusFor(e) }
    );
  }
}
