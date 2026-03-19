import { afterEach, describe, expect, it, vi } from "vitest";

const templatesMock = vi.hoisted(() => ({
  listWorkflowTemplates: vi.fn(),
  updateWorkflowTemplate: vi.fn(),
}));

const dbErrorsMock = vi.hoisted(() => ({
  isDatabaseConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/db/workflow-templates", () => templatesMock);
vi.mock("@/lib/db/errors", () => dbErrorsMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe("workflow templates routes", () => {
  it("lists workflow templates", async () => {
    templatesMock.listWorkflowTemplates.mockResolvedValue([
      {
        id: "template-1",
        template_key: "content_brief_to_draft",
        name: "Content Brief To Draft",
        version: "v1",
        active: true,
        definition_json: { tasks: [] },
        tasks: [],
      },
    ]);

    const route = await import("@/app/api/v1/workflow-templates/route");
    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].template_key).toBe("content_brief_to_draft");
  });

  it("updates a workflow template definition", async () => {
    templatesMock.updateWorkflowTemplate.mockResolvedValue({
      id: "template-1",
      template_key: "content_brief_to_draft",
      name: "Content Brief To Draft",
      version: "v1",
      active: true,
      definition_json: { tasks: [{ key: "brief" }] },
      tasks: [{ key: "brief", title: "Build brief", task_type: "memory.research", priority: "high" }],
    });

    const route = await import("@/app/api/v1/workflow-templates/[templateId]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/v1/workflow-templates/template-1", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-df-auth-agent-id": "admin-local-1" },
        body: JSON.stringify({
          definition_json: { tasks: [{ key: "brief" }] },
        }),
      }),
      { params: Promise.resolve({ templateId: "template-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(templatesMock.updateWorkflowTemplate).toHaveBeenCalledWith({
      templateId: "template-1",
      name: undefined,
      active: undefined,
      definitionJson: { tasks: [{ key: "brief" }] },
    });
    expect(body.id).toBe("template-1");
  });
});
