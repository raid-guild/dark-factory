import { parseJson, todo } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";

export async function POST(request: Request) {
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);

  return todo(
    "POST /api/v1/agents/register-self",
    {
      body,
      auth,
      notes: [
        "Identity must be derived from the authenticated key, not request body",
        "Admin may supply explicit target identity later, but agent self-register must upsert only its bound agent_id",
      ],
    },
    501,
  );
}
