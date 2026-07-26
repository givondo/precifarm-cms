/**
 * Generate embeddings for all published SEO content.
 * Usage: npm run seo:embeddings
 */
import fs from "fs";
import path from "path";
import { closeDb, isPostgresEnabled } from "../src/db/client";
import { generateAllEmbeddings, embeddingStats } from "../src/lib/seo/analytics";
import { isEmbeddingConfigured } from "../src/lib/seo/embeddings";

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

  if (!isEmbeddingConfigured()) {
    console.error("OPENAI_API_KEY is required for embedding generation.");
    process.exit(1);
  }

  const before = await embeddingStats();
  console.log(`Embedding coverage: ${before.embedded}/${before.published} published items`);

  const results = await generateAllEmbeddings();
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`Done: ${ok} succeeded, ${failed.length} failed`);
  for (const row of failed) {
    console.error(`  ${row.slug}: ${row.error}`);
  }

  const after = await embeddingStats();
  console.log(`Coverage now: ${after.embedded}/${after.published}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
