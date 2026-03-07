import { parseJson, todo } from "@/lib/api/respond";

export async function POST(request: Request) {
  const body = await parseJson(request);
  return todo("POST /api/v1/artifacts", { body });
}
