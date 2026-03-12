type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: string;
  result: T;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: string;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type AgentMailConfig = {
  baseUrl: string;
  bearerToken: string | null;
};

export type AgentMailToolName =
  | "health_check"
  | "ensure_project"
  | "register_agent"
  | "send_message"
  | "file_reservation_paths"
  | "release_file_reservations";

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function getAgentMailConfig(): AgentMailConfig | null {
  const baseUrl = process.env.AGENT_MAIL_URL?.trim();
  if (!baseUrl) return null;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    bearerToken: process.env.AGENT_MAIL_BEARER_TOKEN?.trim() || null,
  };
}

export async function callAgentMailTool<T>(name: AgentMailToolName, arguments_: Record<string, unknown>): Promise<T> {
  const config = getAgentMailConfig();
  if (!config) {
    throw new Error("AGENT_MAIL_URL is not configured");
  }

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.bearerToken ? { authorization: `Bearer ${config.bearerToken}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${name}-${Date.now()}`,
      method: "tools/call",
      params: {
        name,
        arguments: arguments_,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Agent Mail HTTP ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcSuccess<T> | JsonRpcFailure;
  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  return payload.result;
}
