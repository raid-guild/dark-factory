import { parseJson, todo } from "@/lib/api/respond";

type Context = { params: Promise<{ artifactId: string }> };

export async function POST(request: Request, context: Context) {
  const { artifactId } = await context.params;
  const body = await parseJson(request);
  return todo("POST /api/v1/artifacts/:artifactId/mark-approved", { artifactId, body });
}
