import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __darkFactoryPgPool: Pool | undefined;
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return databaseUrl;
}

function buildPoolConfig(): PoolConfig {
  const connectionString = requireDatabaseUrl();
  const parsed = new URL(connectionString);
  const sslMode = parsed.searchParams.get("sslmode");
  const disableSsl = sslMode === "disable" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  return {
    connectionString,
    ssl: disableSsl ? false : { rejectUnauthorized: false },
    max: 10,
  };
}

export function getPool(): Pool {
  if (!global.__darkFactoryPgPool) {
    global.__darkFactoryPgPool = new Pool(buildPoolConfig());
  }

  return global.__darkFactoryPgPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
