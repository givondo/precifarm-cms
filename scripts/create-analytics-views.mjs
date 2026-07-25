/**
 * Apply analytics SQL views (idempotent). Requires PostgreSQL.
 * Usage: npm run analytics:views
 */
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
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

async function main() {
  loadEnv();

  const password = process.env.SUPABASE_DB_PASSWORD?.trim().replace(/^["']|["']$/g, "");
  const ref = process.env.SUPABASE_PROJECT_REF?.trim() || "wvqkhvimsxgyxryehnom";
  const region = process.env.SUPABASE_REGION?.trim() || "eu-west-1";

  let url = password
    ? `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`
    : process.env.DATABASE_URL?.trim();

  if (!url || url.includes("YOUR_PASSWORD")) {
    console.error("SUPABASE_DB_PASSWORD or DATABASE_URL is required.");
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "..", "drizzle", "analytics-views.sql");
  const ddl = fs.readFileSync(sqlPath, "utf8");

  const db = postgres(url, {
    max: 1,
    prepare: false,
    ssl: url.includes("supabase") ? "require" : undefined,
  });

  await db.unsafe(ddl);
  await db.end();
  console.log("Analytics views applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
