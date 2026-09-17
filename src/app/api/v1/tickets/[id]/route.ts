import { NextResponse } from "next/server";
import type { WorkflowTicketStatus } from "@/config/noc.config";
import { requireIntegrationClient } from "@/lib/integration/auth";
import {
  getTicketById,
  patchIntegrationTicket,
  toIntegrationDto,
} from "@/data/tickets-store";

function errorResponse(e: unknown) {
  const err = e as { message?: string; status?: number };
  return NextResponse.json(
    { error: err.message ?? "Bad request" },
    { status: err.status ?? 400 }
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    requireIntegrationClient(request, "tickets:read");
    const { id } = await context.params;
    const ticket = getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ data: toIntegrationDto(ticket) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    requireIntegrationClient(request, "tickets:write");
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: WorkflowTicketStatus;
      description?: string;
      technicianName?: string;
      problemId?: string;
      relatedChangeId?: string;
    };
    const ticket = patchIntegrationTicket(id, body);
    return NextResponse.json({ data: toIntegrationDto(ticket) });
  } catch (e) {
    return errorResponse(e);
  }
}
