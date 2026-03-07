import { parseJson, todo } from "@/lib/api/respond";

export async function POST(request: Request) {
  const body = await parseJson(request);
  return todo("POST /api/v1/workflow-runs", { body });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return todo("GET /api/v1/workflow-runs", {
    status: searchParams.get("status"),
    workflow_template_id: searchParams.get("workflow_template_id"),
  });
}
