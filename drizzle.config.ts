import type { Config } from "drizzle-kit";
import fs from "fs";
import path from "path";
import { getDatabaseUrl } from "./src/lib/database-url";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

// Session pooler (5432) is more reliable for drizzle-kit DDL than transaction pooler (6543).
function getDrizzlePushUrl(): string {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const ref = process.env.SUPABASE_PROJECT_REF?.trim() || "wvqkhvimsxgyxryehnom";
  const region = process.env.SUPABASE_REGION?.trim() || "eu-west-1";

  if (password) {
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  }

  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("Set DATABASE_URL or SUPABASE_DB_PASSWORD in .env");
  }
  if (url.includes("pooler.supabase.com:6543")) {
    return url.replace(":6543/", ":5432/");
  }
  return url;
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDrizzlePushUrl(),
    ssl: "require",
  },
} satisfies Config;
