import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildShiftBriefing,
  generateTicketInsight,
  type InsightTicketInput,
} from "@/ai/insight";
import { isLlmConfigured } from "@/config/ai.config";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

async function requireSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const session = await verifySessionToken(token);
  if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return session;
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = (await request.json()) as {
      mode?: "ticket" | "briefing";
      ticket?: InsightTicketInput;
      tickets?: InsightTicketInput[];
    };

    if (body.mode === "briefing") {
      const insight = buildShiftBriefing(body.tickets ?? []);
      return NextResponse.json({ insight, llmConfigured: isLlmConfigured() });
    }

    if (!body.ticket) {
      return NextResponse.json({ error: "ticket required" }, { status: 400 });
    }

    const insight = await generateTicketInsight(body.ticket);
    return NextResponse.json({ insight, llmConfigured: isLlmConfigured() });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    return NextResponse.json(
      { error: err.message ?? "Error" },
      { status: err.status ?? 500 }
    );
  }
}
