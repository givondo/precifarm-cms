/**
 * One-time Supabase sync: push Drizzle schema + seed default data.
 *
 * Add to .env:
 *   SUPABASE_DB_PASSWORD=your-database-password
 *
 * Or set DATABASE_URL directly (pooler URI for runtime).
 *
 * Usage: npm run supabase:setup
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

const PROJECT_REF = "wvqkhvimsxgyxryehnom";
const REGION = "eu-west-1";

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = parseEnvValue(trimmed.slice(eq + 1));
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseEnvValue(raw) {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function encodePassword(password) {
  return encodeURIComponent(password);
}

function buildUrls(password) {
  const encoded = encodePassword(password);
  return {
    direct: `postgresql://postgres:${encoded}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
    session: `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${REGION}.pooler.supabase.com:5432/postgres`,
    pooler: `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`,
  };
}

loadEnvFile();

const password = process.env.SUPABASE_DB_PASSWORD?.trim();
let poolerUrl = process.env.DATABASE_URL?.trim();
let directUrl = process.env.SUPABASE_DIRECT_URL?.trim();

if (password) {
  const urls = buildUrls(password);
  poolerUrl = urls.pooler;
  directUrl = directUrl ?? urls.session;
} else if (poolerUrl?.includes("YOUR_PASSWORD")) {
  poolerUrl = undefined;
}

if (!directUrl && poolerUrl?.includes("supabase")) {
  // drizzle-kit push works more reliably on direct connection
  directUrl = poolerUrl
    .replace(`postgres.${PROJECT_REF}`, "postgres")
    .replace(/pooler\.supabase\.com:6543/, `${PROJECT_REF}.supabase.co:5432`)
    .replace(/aws-0-[a-z0-9-]+\./, "db.");
}

if (!poolerUrl && !password) {
  console.error(`
Supabase password not found.

Add ONE of these to .env:

  SUPABASE_DB_PASSWORD=your-database-password

  DATABASE_URL=postgresql://postgres.${PROJECT_REF}:PASSWORD@aws-0-${REGION}.pooler.supabase.com:6543/postgres

Get the password from Supabase → Project Settings → Database.
`);
  process.exit(1);
}

if (!directUrl) {
  console.error("Could not derive direct DATABASE_URL for schema push. Set SUPABASE_DIRECT_URL in .env.");
  process.exit(1);
}

console.log("Pushing schema to Supabase (session pooler)...");
const push = spawnSync("npx", ["drizzle-kit", "push"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: directUrl },
  shell: true,
});

if (push.status !== 0) {
  process.exit(push.status ?? 1);
}

console.log("\nSeeding default route, agents, and app store...");
const seed = spawnSync("npx", ["tsx", "scripts/seed-postgres.ts"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: poolerUrl ?? directUrl },
  shell: true,
});

if (seed.status !== 0) {
  process.exit(seed.status ?? 1);
}

// Write pooler URL to .env if we built it from password
if (password && poolerUrl) {
  let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  if (/^DATABASE_URL=/m.test(envText)) {
    envText = envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${poolerUrl}`);
  } else {
    envText = envText.trimEnd() + `\n\n# Supabase PostgreSQL (transaction pooler — use on Netlify too)\nDATABASE_URL=${poolerUrl}\n`;
  }
  fs.writeFileSync(envPath, envText, "utf8");
  console.log("\nUpdated DATABASE_URL in .env");
}

console.log(`
Supabase sync complete.

Next steps:
1. Netlify → Environment variables → add DATABASE_URL (same pooler URI as .env)
2. Redeploy CMS on Netlify
3. Verify: GET /api/v1/health → "storageBackend": "postgresql"

Pooler URL written to .env — copy DATABASE_URL from there for Netlify (Functions scope only).
`);
