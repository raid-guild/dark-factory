export type ApiKeyRole = "admin" | "human" | "agent";

export type ApiKeyRecord = {
  key: string;
  role: ApiKeyRole;
  agent_id?: string;
  label?: string;
  enabled: boolean;
};

function normalizeRecord(input: unknown): ApiKeyRecord | null {
  if (!input || typeof input !== "object") return null;

  const raw = input as Record<string, unknown>;
  const key = typeof raw.key === "string" ? raw.key : "";
  if (!key) return null;

  const role: ApiKeyRole =
    raw.role === "admin" || raw.role === "human" || raw.role === "agent" ? raw.role : "admin";

  const agentId = typeof raw.agent_id === "string" && raw.agent_id ? raw.agent_id : undefined;
  const label = typeof raw.label === "string" && raw.label ? raw.label : undefined;
  const enabled = raw.enabled !== false;

  return {
    key,
    role,
    agent_id: agentId,
    label,
    enabled,
  };
}

export function loadApiKeyRecords(): ApiKeyRecord[] {
  const rawJson = process.env.DARK_FACTORY_API_KEYS_JSON;
  const records: ApiKeyRecord[] = [];

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const normalized = normalizeRecord(item);
          if (normalized?.enabled) records.push(normalized);
        }
      }
    } catch {
      // Ignore malformed JSON and fallback to legacy key below.
    }
  }

  const legacyKey = process.env.DARK_FACTORY_API_KEY;
  if (legacyKey) {
    records.push({
      key: legacyKey,
      role: "admin",
      label: "legacy-admin",
      enabled: true,
    });
  }

  return records;
}

export function findApiKeyRecord(providedKey: string | null): ApiKeyRecord | null {
  if (!providedKey) return null;
  const records = loadApiKeyRecords();
  return records.find((record) => record.key === providedKey) ?? null;
}
