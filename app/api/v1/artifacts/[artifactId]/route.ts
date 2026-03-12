import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ artifactId: string }> };

export async function GET(_request: Request, context: Context) {
  const { artifactId } = await context.params;
  return todo("GET /api/v1/artifacts/:artifactId", { artifactId });
}
