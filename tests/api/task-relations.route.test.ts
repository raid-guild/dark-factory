import { afterEach, describe, expect, it, vi } from "vitest";

const relationsMock = vi.hoisted(() => ({
  getTaskRelations: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/task-relations", () => relationsMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("task relations route", () => {
  it("returns dependency and dependent task summaries", async () => {
    relationsMock.getTaskRelations.mockResolvedValue({
      depends_on: [{ id: "task-a", title: "Brief", task_type: "knowledge.synthesis", status: "completed" }],
      dependents: [{ id: "task-c", title: "Approval", task_type: "human.approval", status: "queued" }],
    });

    const route = await import("@/app/api/v1/tasks/[taskId]/relations/route");
    const response = await route.GET(new Request("http://localhost/api/v1/tasks/task-b/relations"), {
      params: Promise.resolve({ taskId: "task-b" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.depends_on).toHaveLength(1);
    expect(body.dependents).toHaveLength(1);
  });
});
