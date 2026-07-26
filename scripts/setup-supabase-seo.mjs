/**
 * Push SEO Phase 3/4 schema to Supabase and seed content.
 * Usage: npm run supabase:seo
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

function loadEnvFile() {
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

function run(label, cmd, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required in .env (Supabase pooler URI).");
  process.exit(1);
}

run("Push schema (seo Phase 3/4 tables + locale)", "npx", ["drizzle-kit", "push"]);
run("Seed SEO entities, content, Swahili FAQ", "npx", ["tsx", "scripts/seed-seo.ts"]);
run("Seed local page template + city drafts", "npx", ["tsx", "scripts/generate-local-pages.ts"]);
run("Sample competitor snapshots", "npx", ["tsx", "scripts/seo-competitor-check.ts"]);

console.log(`
Supabase SEO setup complete.

Verify in CMS admin:
  /seo  /seo/gaps  /seo/competitors  /seo/automation

Website (set CMS_API_URL to production CMS):
  /locations  /sw  /api/knowledge/tools  /.well-known/assetlinks.json
`);
