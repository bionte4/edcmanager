import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  publicAiView,
  publicEmailView,
  publicSmtpView,
} from "@/data/connector-settings-store";
import { countActiveIntegrationClients } from "@/data/integration-clients-store";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

export async function GET() {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      email: publicEmailView(),
      smtp: publicSmtpView(),
      ai: publicAiView(),
      api: {
        id: "rest-api",
        configured: true,
        activeClients: await countActiveIntegrationClients(),
        basePath: "/api/v1",
      },
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Error" }, { status: 500 });
  }
}
