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
  | "summarize_thread"
  | "file_reservation_paths"
  | "release_file_reservations";

type JsonRpcResourceSuccess = {
  jsonrpc: "2.0";
  id: string;
  result: {
    contents?: Array<{
      uri?: string;
      mimeType?: string;
      text?: string;
    }>;
  };
};

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getAgentMailConfig(): AgentMailConfig | null {
  const baseUrl = process.env.AGENT_MAIL_URL?.trim();
  if (!baseUrl) return null;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    bearerToken: process.env.AGENT_MAIL_BEARER_TOKEN?.trim() || null,
  };
}

export function getAgentMailWebBaseUrl(): string | null {
  const configured = process.env.AGENT_MAIL_WEB_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  const config = getAgentMailConfig();
  if (!config) return null;

  return stripTrailingSlash(config.baseUrl.replace(/\/mcp\/?$/, ""));
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

  const payload = (await response.json()) as
    | (JsonRpcSuccess<T> & { result?: T & { structuredContent?: unknown; isError?: boolean } })
    | JsonRpcFailure;
  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  const structuredContent =
    payload.result &&
    typeof payload.result === "object" &&
    "structuredContent" in payload.result &&
    payload.result.structuredContent !== undefined
      ? (payload.result.structuredContent as T)
      : null;

  return structuredContent ?? payload.result;
}

export async function readAgentMailResource<T>(uri: string): Promise<T> {
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
      id: `resource-${Date.now()}`,
      method: "resources/read",
      params: {
        uri,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Agent Mail HTTP ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcResourceSuccess | JsonRpcFailure;
  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  const text = payload.result.contents?.[0]?.text;
  if (!text) {
    throw new Error(`Agent Mail resource returned no text for ${uri}`);
  }

  return JSON.parse(text) as T;
}
