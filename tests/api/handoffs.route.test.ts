import { afterEach, describe, expect, it, vi } from "vitest";

const handoffsMock = vi.hoisted(() => ({
  createHandoff: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/handoffs", () => handoffsMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("handoffs route", () => {
  it("requires from_task_id and to_task_id", async () => {
    const route = await import("@/app/api/v1/handoffs/route");
    const response = await route.POST(
      new Request("http://localhost/api/v1/handoffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "missing ids" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("from_task_id and to_task_id are required");
  });

  it("creates a handoff within a run", async () => {
    handoffsMock.createHandoff.mockResolvedValue({
      kind: "ok",
      handoff: {
        id: "handoff-1",
        from_task_id: "task-a",
        to_task_id: "task-b",
        note: "Take over drafting",
      },
    });

    const route = await import("@/app/api/v1/handoffs/route");
    const response = await route.POST(
      new Request("http://localhost/api/v1/handoffs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-df-auth-agent-id": "agent-content" },
        body: JSON.stringify({ from_task_id: "task-a", to_task_id: "task-b", note: "Take over drafting" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(handoffsMock.createHandoff).toHaveBeenCalledWith({
      fromTaskId: "task-a",
      toTaskId: "task-b",
      note: "Take over drafting",
      actorAgentKey: "agent-content",
    });
    expect(body.id).toBe("handoff-1");
  });
});
