import fs from "fs";
import path from "path";
import postgres from "postgres";

const envPath = path.join(process.cwd(), ".env");
const PROJECT_REF = "wvqkhvimsxgyxryehnom";
const REGION = "eu-west-1";

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

function loadPassword() {
  if (!fs.existsSync(envPath)) throw new Error(".env not found");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key === "SUPABASE_DB_PASSWORD") return parseEnvValue(trimmed.slice(eq + 1));
  }
  throw new Error("SUPABASE_DB_PASSWORD not in .env");
}

const password = loadPassword();
const encoded = encodeURIComponent(password);

const candidates = [
  {
    name: "direct",
    url: `postgresql://postgres:${encoded}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  },
  {
    name: "pooler-session",
    url: `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${REGION}.pooler.supabase.com:5432/postgres`,
  },
  {
    name: "pooler-transaction",
    url: `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`,
  },
];

for (const { name, url } of candidates) {
  process.stdout.write(`Testing ${name}... `);
  const sql = postgres(url, {
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: 15,
  });
  try {
    const rows = await sql`select 1 as ok`;
    console.log(`OK (${rows[0].ok})`);
    console.log(`Use this mode for setup: ${name}`);
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.log("FAILED");
    console.error(`  ${err.message}`);
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

process.exit(1);
