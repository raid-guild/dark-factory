export type RequestAuthContext = {
  role: string | null;
  agentId: string | null;
  label: string | null;
};

export function getRequestAuthContext(request: Request): RequestAuthContext {
  return {
    role: request.headers.get("x-df-auth-role"),
    agentId: request.headers.get("x-df-auth-agent-id"),
    label: request.headers.get("x-df-auth-label"),
  };
}
