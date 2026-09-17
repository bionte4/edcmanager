import { NextResponse } from "next/server";
import { requireIntegrationClient } from "@/lib/integration/auth";
import {
  processMonitoringEvent,
  type MonitoringEventInput,
} from "@/data/monitoring-ingest-store";

function errorResponse(e: unknown) {
  const err = e as {
    message?: string;
    status?: number;
    ingest?: unknown;
  };
  return NextResponse.json(
    {
      error: err.message ?? "Bad request",
      ...(err.ingest ? { ingest: err.ingest } : {}),
    },
    { status: err.status ?? 400 }
  );
}

/**
 * Predictive tahap 1 — monitoring webhook → optional auto INCIDENT.
 * Auth: Bearer / X-Api-Key with scope `monitoring:ingest`.
 */
export async function POST(request: Request) {
  try {
    const client = await requireIntegrationClient(request, "monitoring:ingest");
    const body = (await request.json()) as MonitoringEventInput & {
      events?: MonitoringEventInput[];
    };

    // Batch support
    if (Array.isArray(body.events) && body.events.length > 0) {
      const results = [];
      for (const event of body.events.slice(0, 50)) {
        results.push(
          await processMonitoringEvent({
            sourceSystem: client.externalSystem,
            event,
          })
        );
      }
      const created = results.filter((r) => r.outcome === "TICKET_CREATED").length;
      return NextResponse.json(
        { data: results, count: results.length, created },
        { status: created > 0 ? 201 : 200 }
      );
    }

    const result = await processMonitoringEvent({
      sourceSystem: client.externalSystem,
      event: body,
    });

    const status =
      result.outcome === "TICKET_CREATED"
        ? 201
        : result.outcome === "ERROR"
          ? 400
          : 200;

    return NextResponse.json({ data: result }, { status });
  } catch (e) {
    return errorResponse(e);
  }
}
