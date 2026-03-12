import { callAgentMailTool, getAgentMailConfig } from "@/lib/integrations/agent-mail/client";

type TaskMailInput = {
  taskId: string;
  workflowRunId?: string;
  senderName: string;
  taskTitle: string;
  nextStatus: string;
  blockedReason?: string | null;
  reservationPaths?: string[];
};

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function logAgentMail(event: string, details: Record<string, unknown>) {
  if (!isDev()) return;
  console.info(`[agent-mail] ${event}`, details);
}

function getProjectKey() {
  return process.env.AGENT_MAIL_PROJECT_KEY?.trim() || process.cwd();
}

const FIXED_AGENT_NAME_MAP: Record<string, string> = {
  "agent-memory": "AmberOtter",
  "agent-knowledge": "CinderFox",
  "agent-content": "SilverLark",
  "agent-distribution": "MossHarbor",
};

const ADJECTIVES = [
  "Amber",
  "Brass",
  "Cinder",
  "Dusky",
  "Ember",
  "Foggy",
  "Ivory",
  "Mossy",
  "Sable",
  "Silver",
];

const NOUNS = [
  "Otter",
  "Falcon",
  "Harbor",
  "Badger",
  "Lark",
  "Finch",
  "Island",
  "Fox",
  "Bridge",
  "Signal",
];

function parseConfiguredAgentMap() {
  const raw = process.env.AGENT_MAIL_AGENT_MAP_JSON?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function fallbackAgentMailName(agentId: string) {
  let hash = 0;
  for (const char of agentId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  return `${adjective}${noun}`;
}

export function getAgentMailAgentName(agentId: string) {
  const configured = parseConfiguredAgentMap();
  return configured[agentId] ?? FIXED_AGENT_NAME_MAP[agentId] ?? fallbackAgentMailName(agentId);
}

function getRecipients(senderName: string) {
  const configured = process.env.AGENT_MAIL_DEFAULT_TO?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  return configured.length ? configured : [senderName];
}

function getProgram() {
  return process.env.AGENT_MAIL_PROGRAM?.trim() || "dark-factory";
}

function getModel() {
  return process.env.AGENT_MAIL_MODEL?.trim() || "next-api";
}

function getThreadId(workflowRunId?: string) {
  return workflowRunId ? `run-${workflowRunId}` : undefined;
}

export function isAgentMailEnabled() {
  return Boolean(getAgentMailConfig());
}

async function ensureProjectAndAgent(senderName: string) {
  const projectKey = getProjectKey();
  const agentMailName = getAgentMailAgentName(senderName);

  logAgentMail("ensure_project.start", {
    projectKey,
    senderName,
    agentMailName,
  });

  await callAgentMailTool("ensure_project", {
    human_key: projectKey,
  });

  await callAgentMailTool("register_agent", {
    project_key: projectKey,
    program: getProgram(),
    model: getModel(),
    name: agentMailName,
  });

  logAgentMail("ensure_project.done", {
    projectKey,
    senderName,
    agentMailName,
  });

  return { projectKey, agentMailName };
}

export async function mirrorTaskTransitionToAgentMail(input: TaskMailInput) {
  if (!isAgentMailEnabled()) return;

  const { projectKey, agentMailName } = await ensureProjectAndAgent(input.senderName);
  const threadId = getThreadId(input.workflowRunId);
  const subject = `[task:${input.taskId}] ${input.nextStatus.replaceAll("_", " ")} - ${input.taskTitle}`;
  const body = [
    `Task \`${input.taskId}\` moved to \`${input.nextStatus}\`.`,
    input.workflowRunId ? `Workflow run: \`${input.workflowRunId}\`` : null,
    input.blockedReason ? `Blocked reason: ${input.blockedReason}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  logAgentMail("send_message.start", {
    projectKey,
    senderName: input.senderName,
    agentMailName,
    taskId: input.taskId,
    threadId,
    subject,
    to: getRecipients(agentMailName),
  });

  const result = await callAgentMailTool("send_message", {
    project_key: projectKey,
    sender_name: agentMailName,
    to: getRecipients(agentMailName),
    subject,
    body_md: body,
    thread_id: threadId,
    importance: input.nextStatus === "blocked" ? "high" : "normal",
  });

  logAgentMail("send_message.done", {
    projectKey,
    agentMailName,
    taskId: input.taskId,
    threadId,
    result,
  });
}

export async function reserveTaskFilesInAgentMail(input: {
  senderName: string;
  taskId: string;
  paths: string[];
}) {
  if (!isAgentMailEnabled() || !input.paths.length) return;

  const { projectKey, agentMailName } = await ensureProjectAndAgent(input.senderName);
  logAgentMail("reserve_paths.start", {
    projectKey,
    senderName: input.senderName,
    agentMailName,
    taskId: input.taskId,
    paths: input.paths,
  });

  const result = await callAgentMailTool("file_reservation_paths", {
    project_key: projectKey,
    agent_name: agentMailName,
    paths: input.paths,
    ttl_seconds: 3600,
    exclusive: true,
    reason: `task:${input.taskId}`,
  });

  logAgentMail("reserve_paths.done", {
    projectKey,
    agentMailName,
    taskId: input.taskId,
    result,
  });
}

export async function releaseTaskFilesInAgentMail(input: {
  senderName: string;
  paths: string[];
}) {
  if (!isAgentMailEnabled() || !input.paths.length) return;

  const { projectKey, agentMailName } = await ensureProjectAndAgent(input.senderName);
  logAgentMail("release_paths.start", {
    projectKey,
    senderName: input.senderName,
    agentMailName,
    paths: input.paths,
  });

  const result = await callAgentMailTool("release_file_reservations", {
    project_key: projectKey,
    agent_name: agentMailName,
    paths: input.paths,
  });

  logAgentMail("release_paths.done", {
    projectKey,
    agentMailName,
    result,
  });
}
