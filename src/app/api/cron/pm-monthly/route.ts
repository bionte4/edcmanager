import { NextResponse } from "next/server";
import { generateMonthlyPm } from "@/data/pm-campaign-store";
import { jakartaPeriodKey } from "@/config/pm-calendar.config";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

/** Monthly PM batch — typically day 1 of month Asia/Jakarta. */
export async function POST(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const periodKey =
      url.searchParams.get("periodKey") ?? jakartaPeriodKey();
    const result = await generateMonthlyPm({ periodKey, force });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
