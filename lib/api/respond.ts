import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function todo(endpoint: string, details: Record<string, unknown> = {}, status = 501) {
  return ok(
    {
      ok: false,
      message: "Not implemented",
      endpoint,
      ...details,
    },
    status,
  );
}
