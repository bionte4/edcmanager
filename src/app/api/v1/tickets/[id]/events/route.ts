import { NextResponse } from "next/server";
import { requireIntegrationClient } from "@/lib/integration/auth";
import { addTicketEvent, toIntegrationDto } from "@/data/tickets-store";

function errorResponse(e: unknown) {
  const err = e as { message?: string; status?: number };
  return NextResponse.json(
    { error: err.message ?? "Bad request" },
    { status: err.status ?? 400 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    requireIntegrationClient(request, "tickets:events");
    const { id } = await context.params;
    const body = (await request.json()) as { note?: string };
    const ticket = addTicketEvent(id, body.note ?? "");
    return NextResponse.json({ data: toIntegrationDto(ticket) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
