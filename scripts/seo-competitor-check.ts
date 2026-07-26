/**
 * Ingest competitor SERP snapshots from JSON file or sample data.
 * Usage: npm run seo:competitors -- path/to/snapshots.json
 */
import fs from "fs";
import path from "path";
import { closeDb, isPostgresEnabled } from "../src/db/client";
import { bulkUpsertCompetitorSnapshots, listCompetitorThreats } from "../src/lib/seo/competitors";

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

const SAMPLE = [
  {
    query: "nairobi kisumu bus",
    competitorDomain: "easycoach.co.ke",
    competitorUrl: "https://easycoach.co.ke",
    position: 2,
    ourPosition: 8,
    ourUrl: "https://precifarm.com/guides/book-nairobi-kisumu-coach",
    capturedAt: new Date().toISOString().slice(0, 10),
    source: "sample",
  },
  {
    query: "ev charging kenya",
    competitorDomain: "chargepoint.com",
    position: 4,
    ourPosition: 12,
    capturedAt: new Date().toISOString().slice(0, 10),
    source: "sample",
  },
];

async function main() {
  if (!isPostgresEnabled()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const fileArg = process.argv[2];
  let rows = SAMPLE;

  if (fileArg) {
    const raw = fs.readFileSync(path.resolve(fileArg), "utf8");
    rows = JSON.parse(raw);
  }

  await bulkUpsertCompetitorSnapshots(rows);
  const threats = await listCompetitorThreats(10);
  console.log(`Ingested ${rows.length} snapshot(s). Threats: ${threats.length}`);
  console.log(JSON.stringify(threats.slice(0, 5), null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
