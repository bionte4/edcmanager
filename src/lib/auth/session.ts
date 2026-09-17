import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "@/config/rbac.config";
import type { AuthUser } from "@/lib/rbac";

export const SESSION_COOKIE = "edc_session";

export interface SessionPayload {
  sub: string;
  name: string;
  email: string;
  role: AppRole;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? "edc-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ""),
      email: payload.email,
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}

export function sessionToAuthUser(session: SessionPayload): AuthUser {
  return {
    id: session.sub,
    name: session.name,
    email: session.email,
    role: session.role,
    isActive: true,
  };
}
