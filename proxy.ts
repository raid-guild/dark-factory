import { NextResponse, type NextRequest } from "next/server";
import type { ApiKeyRole } from "@/lib/auth/api-keys";
import { findApiKeyRecord, loadApiKeyRecords } from "@/lib/auth/api-keys";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALL_AUTH_ROLES: ApiKeyRole[] = ["admin", "human", "agent"];

function requiredRolesForPath(pathname: string): ApiKeyRole[] {
  if (pathname === "/api/v1/agents/register") return ["admin"];
  if (pathname === "/api/v1/agents/register-self") return ["agent", "admin"];
  if (/^\/api\/v1\/agents\/[^/]+$/.test(pathname)) return ["admin"];
  if (/^\/api\/v1\/agents\/[^/]+\/(heartbeat|events)$/.test(pathname)) return ["agent", "admin"];
  if (/^\/api\/v1\/approvals(\/|$)/.test(pathname)) return ["human", "admin"];
  if (/^\/api\/v1\/artifacts\/[^/]+\/mark-approved$/.test(pathname)) return ["human", "admin"];
  if (/^\/api\/v1\/workflow-runs(\/|$)/.test(pathname)) return ["human", "admin"];
  if (/^\/api\/v1\/tasks(\/|$)/.test(pathname)) return ALL_AUTH_ROLES;
  if (pathname === "/api/v1/artifacts") return ALL_AUTH_ROLES;
  if (/^\/api\/v1\/handoffs(\/|$)/.test(pathname)) return ALL_AUTH_ROLES;
  return ["admin"];
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  if (!WRITE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const configuredRecords = loadApiKeyRecords();
  if (!configuredRecords.length) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "API writes are disabled: configure DARK_FACTORY_API_KEYS_JSON or DARK_FACTORY_API_KEY",
      },
      { status: 503 },
    );
  }

  const providedKey = request.headers.get("x-df-api-key");
  const matched = findApiKeyRecord(providedKey);

  if (!matched) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const allowedRoles = requiredRolesForPath(pathname);
  if (!allowedRoles.includes(matched.role)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Forbidden for this key role",
        required_roles: allowedRoles,
      },
      { status: 403 },
    );
  }

  if (matched.role === "agent") {
    const agentPathMatch =
      pathname === "/api/v1/agents/register-self"
        ? null
        : pathname.match(/^\/api\/v1\/agents\/([^/]+)(?:\/|$)/);
    if (agentPathMatch) {
      if (!matched.agent_id) {
        return NextResponse.json(
          {
            ok: false,
            message: "Agent key missing agent_id binding",
          },
          { status: 403 },
        );
      }

      const requestedAgentId = decodeURIComponent(agentPathMatch[1]);
      if (requestedAgentId !== matched.agent_id) {
        return NextResponse.json(
          {
            ok: false,
            message: "Agent key cannot write for another agent_id",
          },
          { status: 403 },
        );
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-df-auth-role", matched.role);
  if (matched.agent_id) requestHeaders.set("x-df-auth-agent-id", matched.agent_id);
  if (matched.label) requestHeaders.set("x-df-auth-label", matched.label);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
