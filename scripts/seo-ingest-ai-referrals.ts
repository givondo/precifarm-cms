/**
 * Ingest AI referrer events from analytics into seo_ai_citations + seo_metrics.
 * Usage: npm run seo:ingest-citations
 */
import fs from "fs";
import path from "path";
import { closeDb, isPostgresEnabled } from "../src/db/client";
import { ingestAiReferralsFromAnalytics } from "../src/lib/seo/citations";

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

  const result = await ingestAiReferralsFromAnalytics(7);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
