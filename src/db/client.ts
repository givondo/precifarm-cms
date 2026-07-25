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
    // Supabase pooler (port 6543) requires prepare: false
    client = postgres(process.env.DATABASE_URL, {
      max: 10,
      prepare: false,
      ssl: process.env.DATABASE_URL.includes("supabase") ? "require" : undefined,
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
