import { parseJson, todo } from "@/lib/api/respond";

export async function POST(request: Request) {
  const body = await parseJson(request);
  return todo("POST /api/v1/tasks", { body });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return todo("GET /api/v1/tasks", {
    status: searchParams.get("status"),
    owner_agent_id: searchParams.get("owner_agent_id"),
    workflow_run_id: searchParams.get("workflow_run_id"),
  });
}
