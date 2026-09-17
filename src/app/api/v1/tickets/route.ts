import { NextResponse } from "next/server";
import type { ItsmType } from "@/config/itsm.config";
import type { OperationalProcess } from "@/config/itsm.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";
import type { WorkflowTicketStatus } from "@/config/noc.config";
import { requireIntegrationClient } from "@/lib/integration/auth";
import {
  createIntegrationTicket,
  listIntegrationTickets,
  toIntegrationDto,
} from "@/data/tickets-store";

function errorResponse(e: unknown) {
  const err = e as { message?: string; status?: number; existing?: unknown };
  const status = err.status ?? 400;
  return NextResponse.json(
    {
      error: err.message ?? "Bad request",
      ...(err.existing
        ? { existing: toIntegrationDto(err.existing as never) }
        : {}),
    },
    { status }
  );
}

export async function GET(request: Request) {
  try {
    await requireIntegrationClient(request, "tickets:read");
    const { searchParams } = new URL(request.url);
    const tickets = await listIntegrationTickets({
      itsmType: (searchParams.get("itsmType") as ItsmType) || undefined,
      status: (searchParams.get("status") as WorkflowTicketStatus) || undefined,
      externalSystem: searchParams.get("externalSystem") || undefined,
      updatedSince: searchParams.get("updatedSince") || undefined,
    });
    return NextResponse.json({
      data: tickets.map((t) => toIntegrationDto(t)),
      count: tickets.length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const client = await requireIntegrationClient(request, "tickets:write");
    const body = (await request.json()) as {
      merchantId?: string;
      location?: TicketLocation;
      category?: TicketCategory;
      description?: string;
      vendorName?: string;
      itsmType?: ItsmType;
      process?: OperationalProcess;
      externalTicketId?: string;
      externalSystem?: string;
      openedAt?: string;
    };

    const ticket = await createIntegrationTicket({
      merchantId: body.merchantId ?? "",
      location: body.location ?? "DALAM_KOTA",
      category: body.category ?? "NON_VIP",
      description: body.description ?? "",
      vendorName: body.vendorName,
      itsmType: body.itsmType,
      process: body.process,
      externalTicketId: body.externalTicketId ?? "",
      externalSystem: body.externalSystem ?? client.externalSystem,
      openedAt: body.openedAt,
    });

    return NextResponse.json({ data: toIntegrationDto(ticket) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
