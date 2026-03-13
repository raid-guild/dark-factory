import "server-only";

let validated = false;
let cachedWarnings: string[] = [];

function hasWriteAuthConfigured() {
  return Boolean(process.env.DARK_FACTORY_API_KEYS_JSON?.trim() || process.env.DARK_FACTORY_API_KEY?.trim());
}

function parseOptionalJson(raw: string, name: string) {
  try {
    JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

function validateEnvironmentOnce() {
  const warnings: string[] = [];
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const agentMailUrl = process.env.AGENT_MAIL_URL?.trim();
  const agentMailBearerToken = process.env.AGENT_MAIL_BEARER_TOKEN?.trim();
  const apiKeysJson = process.env.DARK_FACTORY_API_KEYS_JSON?.trim();
  const agentMapJson = process.env.AGENT_MAIL_AGENT_MAP_JSON?.trim();

  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  if (!hasWriteAuthConfigured()) {
    warnings.push("No API write keys configured. Write routes will return 503 until DARK_FACTORY_API_KEYS_JSON or DARK_FACTORY_API_KEY is set.");
  }

  if (apiKeysJson) {
    parseOptionalJson(apiKeysJson, "DARK_FACTORY_API_KEYS_JSON");
  }

  if (agentMapJson) {
    parseOptionalJson(agentMapJson, "AGENT_MAIL_AGENT_MAP_JSON");
  }

  if (agentMailUrl && !/^https?:\/\//.test(agentMailUrl)) {
    throw new Error("AGENT_MAIL_URL must start with http:// or https://");
  }

  if (agentMailUrl && !agentMailBearerToken) {
    warnings.push("AGENT_MAIL_URL is configured without AGENT_MAIL_BEARER_TOKEN. This is acceptable for local/dev setups but should be avoided in production.");
  }

  if (!agentMailUrl && agentMailBearerToken) {
    warnings.push("AGENT_MAIL_BEARER_TOKEN is set but AGENT_MAIL_URL is not configured.");
  }

  return warnings;
}

export function validateEnvironment() {
  if (validated) return cachedWarnings;

  cachedWarnings = validateEnvironmentOnce();
  validated = true;

  for (const warning of cachedWarnings) {
    console.warn(`[env] ${warning}`);
  }

  return cachedWarnings;
}
