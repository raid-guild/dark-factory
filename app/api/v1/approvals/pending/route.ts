import { todo } from "@/lib/api/respond";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return todo("GET /api/v1/approvals/pending", {
    requested_from_actor_id: searchParams.get("requested_from_actor_id"),
  });
}
