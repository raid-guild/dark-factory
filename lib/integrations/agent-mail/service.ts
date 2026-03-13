import { callAgentMailTool, getAgentMailConfig, getAgentMailWebBaseUrl, readAgentMailResource } from "@/lib/integrations/agent-mail/client";

type TaskMailInput = {
  taskId: string;
  workflowRunId?: string;
  senderName: string;
  taskTitle: string;
  nextStatus: string;
  blockedReason?: string | null;
  reservationPaths?: string[];
};

type AgentMailProject = {
  id: number;
  slug: string;
  human_key: string;
  created_at: string;
};

type AgentMailThreadSummary = {
  thread_id: string;
  summary: {
    participants?: string[];
    key_points?: string[];
    action_items?: string[];
    total_messages?: number;
  };
  examples?: Array<{
    id?: number;
    subject?: string;
    from?: string;
    created_ts?: string;
  }>;
};

type AgentMailThreadResource = {
  project: string;
  thread_id: string;
  messages: Array<{
    id: number;
    subject?: string;
    from?: string;
    created_ts?: string;
    importance?: string;
    body_md?: string;
  }>;
};

type AgentMailReservationRecord = {
  id: number;
  agent: string;
  path_pattern: string;
  exclusive: boolean;
  reason?: string | null;
  created_ts?: string | null;
  expires_ts?: string | null;
  released_ts?: string | null;
  stale?: boolean;
  stale_reasons?: string[];
};

type AgentMailUnreadView = {
  project: string;
  agent: string;
  count: number;
  messages: Array<{
    id: number;
    subject?: string;
    from?: string;
    created_ts?: string;
    importance?: string;
  }>;
};

export type WorkflowRunMailSummary = {
  enabled: boolean;
  project_key?: string;
  project_slug?: string;
  project_url?: string;
  thread_id?: string;
  thread_url?: string;
  latest_subject?: string;
  thread_digest?: string;
  participants: string[];
  message_count: number;
  urgent_unread_count: number;
  active_reservations: number;
  reservation_conflicts: number;
  stale_reservations: number;
};

export type TaskMailSummary = {
  enabled: boolean;
  project_key?: string;
  project_slug?: string;
  project_url?: string;
  thread_id?: string;
  thread_url?: string;
  recent_messages: Array<{
    id: number;
    subject?: string;
    from?: string;
    created_ts?: string;
    importance?: string;
  }>;
  active_reservations: AgentMailReservationRecord[];
  reservation_conflicts: number;
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

  const project = await callAgentMailTool<AgentMailProject>("ensure_project", {
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

  return { projectKey, project, agentMailName };
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

function countReservationConflicts(reservations: AgentMailReservationRecord[]) {
  const grouped = new Map<string, Set<string>>();

  for (const reservation of reservations) {
    if (!reservation.exclusive || reservation.released_ts) continue;
    const key = reservation.path_pattern;
    const agents = grouped.get(key) ?? new Set<string>();
    agents.add(reservation.agent);
    grouped.set(key, agents);
  }

  let conflicts = 0;
  for (const agents of grouped.values()) {
    if (agents.size > 1) conflicts += 1;
  }
  return conflicts;
}

function deriveThreadDigest(summary: AgentMailThreadSummary["summary"]) {
  const keyPoint = summary.key_points?.[0];
  if (keyPoint) return keyPoint;

  const actionItem = summary.action_items?.[0];
  if (actionItem) return actionItem;

  return undefined;
}

function getAgentMailLinks(projectSlug?: string, threadId?: string) {
  const webBaseUrl = getAgentMailWebBaseUrl();
  if (!webBaseUrl || !projectSlug) {
    return {
      projectUrl: undefined,
      threadUrl: undefined,
    };
  }

  return {
    projectUrl: `${webBaseUrl}/mail/${encodeURIComponent(projectSlug)}`,
    threadUrl: threadId ? `${webBaseUrl}/mail/${encodeURIComponent(projectSlug)}/thread/${encodeURIComponent(threadId)}` : undefined,
  };
}

async function safeAgentMailTool<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch {
    return fallback;
  }
}

async function safeAgentMailResource<T>(uri: string, fallback: T): Promise<T> {
  try {
    return await readAgentMailResource<T>(uri);
  } catch {
    return fallback;
  }
}

async function ensureProjectOnly() {
  if (!isAgentMailEnabled()) return null;
  const projectKey = getProjectKey();
  const project = await callAgentMailTool<AgentMailProject>("ensure_project", {
    human_key: projectKey,
  });

  return { projectKey, project };
}

async function getUrgentUnreadCount(projectKey: string, agentNames: string[]) {
  const counts = await Promise.all(
    agentNames.map(async (agentName) => {
      const payload = await safeAgentMailResource<AgentMailUnreadView>(
        `resource://views/urgent-unread/${encodeURIComponent(agentName)}?project=${encodeURIComponent(projectKey)}&limit=50`,
        {
          project: projectKey,
          agent: agentName,
          count: 0,
          messages: [],
        },
      );
      return payload.count ?? 0;
    }),
  );

  return counts.reduce((sum, value) => sum + value, 0);
}

export async function getWorkflowRunMailSummary(input: {
  workflowRunId: string;
  participantAgentKeys: string[];
}): Promise<WorkflowRunMailSummary> {
  if (!isAgentMailEnabled()) {
    return {
      enabled: false,
      participants: [],
      message_count: 0,
      urgent_unread_count: 0,
      active_reservations: 0,
      reservation_conflicts: 0,
      stale_reservations: 0,
    };
  }

  const ensured = await ensureProjectOnly();
  if (!ensured) {
    return {
      enabled: false,
      participants: [],
      message_count: 0,
      urgent_unread_count: 0,
      active_reservations: 0,
      reservation_conflicts: 0,
      stale_reservations: 0,
    };
  }

  const participantNames = Array.from(new Set(input.participantAgentKeys.map(getAgentMailAgentName)));
  const threadId = getThreadId(input.workflowRunId) ?? "";
  const [threadSummary, threadResource, reservations, urgentUnreadCount] = await Promise.all([
    safeAgentMailTool<AgentMailThreadSummary>(
      () =>
        callAgentMailTool<AgentMailThreadSummary>("summarize_thread", {
          project_key: ensured.projectKey,
          thread_id: threadId,
          include_examples: false,
          llm_mode: false,
        }),
      {
        thread_id: threadId,
        summary: {},
        examples: [],
      },
    ),
    safeAgentMailResource<AgentMailThreadResource>(
      `resource://thread/${encodeURIComponent(threadId)}?project=${encodeURIComponent(ensured.projectKey)}&include_bodies=false`,
      {
        project: ensured.project.slug,
        thread_id: threadId,
        messages: [],
      },
    ),
    safeAgentMailResource<AgentMailReservationRecord[]>(
      `resource://file_reservations/${encodeURIComponent(ensured.project.slug)}?active_only=true`,
      [],
    ),
    participantNames.length ? getUrgentUnreadCount(ensured.projectKey, participantNames) : Promise.resolve(0),
  ]);
  const links = getAgentMailLinks(ensured.project.slug, threadId);

  return {
    enabled: true,
    project_key: ensured.projectKey,
    project_slug: ensured.project.slug,
    project_url: links.projectUrl,
    thread_id: threadId,
    thread_url: links.threadUrl,
    latest_subject: threadResource.messages.at(-1)?.subject,
    thread_digest: deriveThreadDigest(threadSummary.summary),
    participants: threadSummary.summary.participants ?? participantNames,
    message_count: threadSummary.summary.total_messages ?? threadResource.messages.length,
    urgent_unread_count: urgentUnreadCount,
    active_reservations: reservations.length,
    reservation_conflicts: countReservationConflicts(reservations),
    stale_reservations: reservations.filter((reservation) => reservation.stale).length,
  };
}

export async function getTaskMailSummary(input: {
  taskId: string;
  workflowRunId?: string;
}): Promise<TaskMailSummary> {
  if (!isAgentMailEnabled() || !input.workflowRunId) {
    return {
      enabled: false,
      recent_messages: [],
      active_reservations: [],
      reservation_conflicts: 0,
    };
  }

  const ensured = await ensureProjectOnly();
  if (!ensured) {
    return {
      enabled: false,
      recent_messages: [],
      active_reservations: [],
      reservation_conflicts: 0,
    };
  }

  const threadId = getThreadId(input.workflowRunId) ?? "";
  const [threadResource, reservations] = await Promise.all([
    safeAgentMailResource<AgentMailThreadResource>(
      `resource://thread/${encodeURIComponent(threadId)}?project=${encodeURIComponent(ensured.projectKey)}&include_bodies=false`,
      {
        project: ensured.project.slug,
        thread_id: threadId,
        messages: [],
      },
    ),
    safeAgentMailResource<AgentMailReservationRecord[]>(
      `resource://file_reservations/${encodeURIComponent(ensured.project.slug)}?active_only=true`,
      [],
    ),
  ]);

  const taskSubjectPrefix = `[task:${input.taskId}]`;
  const taskMessages = threadResource.messages
    .filter((message) => message.subject?.startsWith(taskSubjectPrefix))
    .slice(-5)
    .reverse();
  const taskReservations = reservations.filter((reservation) => reservation.reason === `task:${input.taskId}`);
  const links = getAgentMailLinks(ensured.project.slug, threadId);

  return {
    enabled: true,
    project_key: ensured.projectKey,
    project_slug: ensured.project.slug,
    project_url: links.projectUrl,
    thread_id: threadId,
    thread_url: links.threadUrl,
    recent_messages: taskMessages,
    active_reservations: taskReservations,
    reservation_conflicts: countReservationConflicts(taskReservations),
  };
}
