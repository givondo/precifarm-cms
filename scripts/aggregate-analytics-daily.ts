/**
 * Daily analytics aggregation (idempotent).
 * Usage:
 *   npm run analytics:aggregate              # yesterday + today
 *   npm run analytics:aggregate -- 2026-07-20  # single date
 *   npm run analytics:aggregate -- 2026-07-01 2026-07-25  # range
 */
import fs from "fs";
import path from "path";
import { aggregateDailyRange, persistDailyMetrics } from "../src/lib/analytics/aggregate-daily";
import { getLocalDateString } from "../src/lib/booking";
import { closeDb } from "../src/db/client";

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

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const today = getLocalDateString();

  let start: string;
  let end: string;

  if (args.length === 0) {
    start = addDays(today, -1);
    end = today;
  } else if (args.length === 1) {
    start = args[0];
    end = args[0];
  } else {
    start = args[0];
    end = args[1];
  }

  console.log(`Aggregating ${start} → ${end}…`);

  if (start === end) {
    const n = await persistDailyMetrics(start);
    console.log(`Wrote ${n} metric rows for ${start}.`);
  } else {
    const result = await aggregateDailyRange(start, end);
    console.log(`Processed ${result.days} day(s), ${result.metricsWritten} metric rows total.`);
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
