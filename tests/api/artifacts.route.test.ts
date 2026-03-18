import { afterEach, describe, expect, it, vi } from "vitest";

const artifactsMock = vi.hoisted(() => ({
  createArtifact: vi.fn(),
  listTaskArtifacts: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/artifacts", () => artifactsMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("artifacts routes", () => {
  it("creates an artifact", async () => {
    artifactsMock.createArtifact.mockResolvedValue({
      id: "artifact-1",
      task_id: "task-1",
      workflow_run_id: "run-1",
      kind: "research_brief",
      title: "Research brief",
      uri: "outputs/brief.md",
      metadata_json: { format: "markdown" },
      approved_status: "unreviewed",
      created_at: "2026-03-18T00:00:00.000Z",
    });

    const route = await import("@/app/api/v1/artifacts/route");
    const response = await route.POST(
      new Request("http://localhost/api/v1/artifacts", {
        method: "POST",
        headers: { "content-type": "application/json", "x-df-auth-agent-id": "agent-content" },
        body: JSON.stringify({
          task_id: "task-1",
          workflow_run_id: "run-1",
          kind: "research_brief",
          title: "Research brief",
          uri: "outputs/brief.md",
          metadata_json: { format: "markdown" },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(artifactsMock.createArtifact).toHaveBeenCalledWith({
      taskId: "task-1",
      workflowRunId: "run-1",
      kind: "research_brief",
      title: "Research brief",
      uri: "outputs/brief.md",
      metadataJson: { format: "markdown" },
      actorAgentKey: "agent-content",
    });
    expect(body.id).toBe("artifact-1");
  });

  it("lists task artifacts", async () => {
    artifactsMock.listTaskArtifacts.mockResolvedValue([
      {
        id: "artifact-1",
        task_id: "task-1",
        workflow_run_id: "run-1",
        kind: "draft",
        title: "Draft output",
        uri: "outputs/draft.md",
        metadata_json: {},
        approved_status: "unreviewed",
        created_at: "2026-03-18T00:00:00.000Z",
      },
    ]);

    const route = await import("@/app/api/v1/tasks/[taskId]/artifacts/route");
    const response = await route.GET(new Request("http://localhost/api/v1/tasks/task-1/artifacts"), {
      params: Promise.resolve({ taskId: "task-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(artifactsMock.listTaskArtifacts).toHaveBeenCalledWith("task-1");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Draft output");
  });
});
