import { afterEach, describe, expect, it, vi } from "vitest";

const workflowRunsMock = vi.hoisted(() => ({
  createWorkflowRun: vi.fn(),
  listWorkflowRuns: vi.fn(),
  getWorkflowRunById: vi.fn(),
  updateWorkflowRun: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/workflow-runs", () => workflowRunsMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("workflow-runs routes", () => {
  it("rejects workflow creation without a template id", async () => {
    const route = await import("@/app/api/v1/workflow-runs/route");
    const response = await route.POST(new Request("http://localhost/api/v1/workflow-runs", { method: "POST", body: "{}" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, message: "workflow_template_id is required" });
  });

  it("creates a workflow run from a template", async () => {
    workflowRunsMock.createWorkflowRun.mockResolvedValue({
      kind: "ok",
      run: {
        id: "run-123",
        workflow_template_id: "content_pipeline:v1",
        status: "running",
        context_json: { topic: "alpha" },
      },
      tasks_created: 5,
    });

    const route = await import("@/app/api/v1/workflow-runs/route");
    const response = await route.POST(
      new Request("http://localhost/api/v1/workflow-runs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-df-auth-agent-id": "agent-memory" },
        body: JSON.stringify({ workflow_template_id: "content_pipeline:v1", status: "running", context_json: { topic: "alpha" } }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(workflowRunsMock.createWorkflowRun).toHaveBeenCalledWith({
      workflowTemplateId: "content_pipeline:v1",
      status: "running",
      contextJson: { topic: "alpha" },
      requestedByAgentKey: "agent-memory",
    });
    expect(body.tasks_created).toBe(5);
    expect(body.run.id).toBe("run-123");
  });

  it("updates a workflow run status and context", async () => {
    workflowRunsMock.updateWorkflowRun.mockResolvedValue({
      id: "run-123",
      workflow_template_id: "content_pipeline:v1",
      status: "blocked",
      context_json: { topic: "alpha", note: "paused" },
    });

    const route = await import("@/app/api/v1/workflow-runs/[runId]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/v1/workflow-runs/run-123", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "blocked", context_json: { topic: "alpha", note: "paused" } }),
      }),
      { params: Promise.resolve({ runId: "run-123" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(workflowRunsMock.updateWorkflowRun).toHaveBeenCalledWith({
      runId: "run-123",
      status: "blocked",
      contextJson: { topic: "alpha", note: "paused" },
    });
    expect(body.status).toBe("blocked");
  });
});
