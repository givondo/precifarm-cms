import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isPostgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Using JSON file store.");
  }
  if (!client) {
    const url = process.env.DATABASE_URL;
    client = postgres(url, {
      max: 1,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 20,
      ssl: url.includes("supabase") ? "require" : undefined,
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
