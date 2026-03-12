import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getHandoffById } from "@/lib/db/handoffs";

type Context = { params: Promise<{ handoffId: string }> };

export async function GET(_request: Request, context: Context) {
  const { handoffId } = await context.params;
  try {
    const item = await getHandoffById(handoffId);
    if (!item) return fail("Handoff not found", 404, { handoffId });
    return ok(item);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load handoff", 500, { handoffId });
  }
}
