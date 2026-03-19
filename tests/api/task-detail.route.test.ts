import { afterEach, describe, expect, it, vi } from "vitest";

const taskDetailsMock = vi.hoisted(() => ({
  getTaskDetailById: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/task-details", () => taskDetailsMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("task detail route", () => {
  it("returns enriched task detail", async () => {
    taskDetailsMock.getTaskDetailById.mockResolvedValue({
      id: "task-1",
      title: "Build research brief",
      task_type: "memory.research",
      status: "queued",
      priority: "high",
      workflow_run_id: "run-1",
      contract: {
        instructions: "Create a reusable brief.",
        output_requirements: ["Include angles"],
        completion_criteria: ["Create an artifact"],
        artifact_kind: "research_brief",
      },
    });

    const route = await import("@/app/api/v1/tasks/[taskId]/route");
    const response = await route.GET(new Request("http://localhost/api/v1/tasks/task-1"), {
      params: Promise.resolve({ taskId: "task-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(taskDetailsMock.getTaskDetailById).toHaveBeenCalledWith("task-1");
    expect(body.contract.artifact_kind).toBe("research_brief");
  });
});
