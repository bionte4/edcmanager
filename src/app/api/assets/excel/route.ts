import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAssetsExportBuffer,
  buildAssetsTemplateBuffer,
  importAssetRows,
  parseAssetsWorkbook,
} from "@/lib/assets-excel";
import { assetKpis } from "@/data/assets-store";
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

/** GET ?mode=export|template — download Excel */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "inventory:read");
    const mode = new URL(request.url).searchParams.get("mode") ?? "export";
    const stamp = new Date().toISOString().slice(0, 10);

    if (mode === "template") {
      return excelResponse(
        buildAssetsTemplateBuffer(),
        `edc-assets-template.xlsx`
      );
    }

    return excelResponse(
      buildAssetsExportBuffer(),
      `edc-assets-export-${stamp}.xlsx`
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export gagal" },
      { status: statusFor(e) }
    );
  }
}

/** POST multipart file field `file` — import Excel */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "inventory:mutate");

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseAssetsWorkbook(buffer);
    const result = importAssetRows(rows, { actorName: user.name });

    return NextResponse.json({
      result,
      kpis: assetKpis(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import gagal" },
      { status: statusFor(e) }
    );
  }
}
