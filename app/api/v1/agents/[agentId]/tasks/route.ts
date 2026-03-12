import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { listTasks } from "@/lib/db/tasks";

type Context = { params: Promise<{ agentId: string }> };

export async function GET(request: Request, context: Context) {
  const { agentId } = await context.params;
  const { searchParams } = new URL(request.url);
  try {
    const items = await listTasks({
      agentId,
      status: searchParams.get("status"),
    });

    return ok({ items });
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to load agent tasks", 500, { agentId });
  }
}
