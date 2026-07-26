/**
 * Generate local SEO pages from templates and location entities.
 * Usage: npm run seo:local-pages
 */
import fs from "fs";
import path from "path";
import { closeDb, isPostgresEnabled } from "../src/db/client";
import {
  generateLocalPagesFromTemplate,
  upsertDefaultLocalTemplate,
} from "../src/lib/seo/local-pages";

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

  const template = await upsertDefaultLocalTemplate();
  console.log(`Template ready: ${template.slug}`);

  const result = await generateLocalPagesFromTemplate(template.slug);
  const ok = result.results.filter((r) => r.ok).length;
  console.log(`Generated ${ok}/${result.results.length} local page drafts.`);

  for (const row of result.results.filter((r) => !r.ok)) {
    console.error(`  ${row.slug}: ${row.error}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
