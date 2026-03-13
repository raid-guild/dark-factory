import { afterEach, describe, expect, it, vi } from "vitest";

const taskMutationsMock = vi.hoisted(() => ({
  claimTask: vi.fn(),
}));

const agentMailMock = vi.hoisted(() => ({
  mirrorTaskTransitionToAgentMail: vi.fn().mockResolvedValue(undefined),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/task-mutations", () => taskMutationsMock);
vi.mock("@/lib/integrations/agent-mail/service", () => agentMailMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("task lifecycle routes", () => {
  it("returns 409 for an invalid claim transition", async () => {
    taskMutationsMock.claimTask.mockResolvedValue({
      kind: "invalid_transition",
      currentStatus: "blocked",
      nextStatus: "claimed",
    });

    const route = await import("@/app/api/v1/tasks/[taskId]/claim/route");
    const response = await route.POST(
      new Request("http://localhost/api/v1/tasks/task-1/claim", {
        method: "POST",
        headers: { "content-type": "application/json", "x-df-auth-agent-id": "agent-memory" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.current_status).toBe("blocked");
    expect(agentMailMock.mirrorTaskTransitionToAgentMail).not.toHaveBeenCalled();
  });

  it("mirrors a successful claim to Agent Mail", async () => {
    taskMutationsMock.claimTask.mockResolvedValue({
      kind: "ok",
      task: {
        id: "task-1",
        workflow_run_id: "run-123",
        title: "Draft post variants",
        status: "claimed",
      },
    });

    const route = await import("@/app/api/v1/tasks/[taskId]/claim/route");
    const response = await route.POST(
      new Request("http://localhost/api/v1/tasks/task-1/claim", {
        method: "POST",
        headers: { "content-type": "application/json", "x-df-auth-agent-id": "agent-memory" },
        body: JSON.stringify({ file_paths: ["content/draft.md"] }),
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("claimed");
    expect(agentMailMock.mirrorTaskTransitionToAgentMail).toHaveBeenCalledWith({
      taskId: "task-1",
      workflowRunId: "run-123",
      senderName: "agent-memory",
      taskTitle: "Draft post variants",
      nextStatus: "claimed",
      blockedReason: null,
      reservationPaths: ["content/draft.md"],
    });
  });
});
