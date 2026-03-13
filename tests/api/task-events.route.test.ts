import { afterEach, describe, expect, it, vi } from "vitest";

const taskEventsMock = vi.hoisted(() => ({
  listTaskEvents: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn((error: unknown) => error instanceof Error && error.message === "db"),
}));

vi.mock("@/lib/db/task-events", () => taskEventsMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("task events route", () => {
  it("lists task events", async () => {
    taskEventsMock.listTaskEvents.mockResolvedValue([
      { id: "evt-1", event_type: "handoff.created" },
      { id: "evt-2", event_type: "task.blocked" },
    ]);

    const route = await import("@/app/api/v1/tasks/[taskId]/events/route");
    const response = await route.GET(new Request("http://localhost/api/v1/tasks/task-1/events"), {
      params: Promise.resolve({ taskId: "task-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
  });

  it("returns 503 when database config is missing", async () => {
    taskEventsMock.listTaskEvents.mockRejectedValue(new Error("db"));

    const route = await import("@/app/api/v1/tasks/[taskId]/events/route");
    const response = await route.GET(new Request("http://localhost/api/v1/tasks/task-1/events"), {
      params: Promise.resolve({ taskId: "task-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toBe("Database is not configured");
  });
});
