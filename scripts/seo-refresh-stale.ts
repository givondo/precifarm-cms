/**
 * Refresh stale published content via AI drafts (saved to review queue).
 * Usage: npm run seo:refresh-stale
 */
import fs from "fs";
import path from "path";
import { closeDb, isPostgresEnabled } from "../src/db/client";
import { findStaleContent, refreshAllStaleContent } from "../src/lib/seo/stale";
import { isContentGenerationConfigured } from "../src/lib/seo/generate";

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

async function main() {
  if (!isPostgresEnabled()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  if (!isContentGenerationConfigured()) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
  }

  const stale = await findStaleContent();
  console.log(`Found ${stale.length} stale item(s).`);

  const results = await refreshAllStaleContent(5);
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
