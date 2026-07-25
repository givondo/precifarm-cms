import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

import { getDatabaseUrl, isDatabaseConfigured } from "@/lib/database-url";

export function isPostgresEnabled(): boolean {
  return isDatabaseConfigured();
}

export function getDb() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Using JSON file store.");
  }
  if (!client) {
    client = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 20,
      ssl: databaseUrl.includes("supabase") ? "require" : undefined,
    });
    db = drizzle(client, { schema });
  }
  return db!;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export { schema };
