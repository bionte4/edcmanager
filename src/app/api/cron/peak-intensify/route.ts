import { NextResponse } from "next/server";
import {
  getPeakSeasonSnapshot,
  runPeakIntensify,
} from "@/data/pm-campaign-store";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

/** Peak intensification for seasons in lead window or ACTIVE. */
export async function POST(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const snapshot = await getPeakSeasonSnapshot();
    const due = snapshot.intensifyDue;
    if (due.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: "no_peak_in_lead_window",
        seasons: snapshot.seasons.map((s) => ({
          id: s.window.id,
          kind: s.window.kind,
          state: s.state,
          intensifyDue: s.intensifyDue,
        })),
      });
    }

    const results = [];
    for (const s of due) {
      results.push(
        await runPeakIntensify({
          windowId: s.window.id,
          force,
          notify: true,
        })
      );
    }
    return NextResponse.json({ count: results.length, results });
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
