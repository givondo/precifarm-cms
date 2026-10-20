/**
 * Export aggregate KPI counts from the install pipeline for the Precifarm KPI register.
 * Read only: never seeds, normalises or writes the store. Prints counts only, no customer data.
 *
 * Usage:
 *   npm run ops:kpi-counts                     # as of now, to stdout
 *   npm run ops:kpi-counts -- 2026-10-31       # as of the end of a date
 *   npm run ops:kpi-counts -- --out counts.json
 *
 * Then, in kenya-ebus-ecosystem:  python ops/tools/kpis.py import-counts counts.json
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { computeKpiCounts, type KpiCountsInput } from "../src/lib/kpi-counts";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eqAt = t.indexOf("=");
    if (eqAt === -1) continue;
    const key = t.slice(0, eqAt).trim();
    let val = t.slice(eqAt + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function readStoreReadOnly(): Promise<{ store: KpiCountsInput; source: string }> {
  const { isPostgresEnabled, getDb, closeDb } = await import("../src/db/client");
  if (isPostgresEnabled()) {
    const { appStore } = await import("../src/db/schema");
    try {
      const rows = await getDb().select().from(appStore).where(eq(appStore.id, "default")).limit(1);
      if (!rows.length) throw new Error("app_store has no 'default' row; nothing to count");
      return { store: rows[0].data as KpiCountsInput, source: "postgres" };
    } finally {
      await closeDb();
    }
  }
  const file = path.join(process.cwd(), "data", "store.json");
  if (!fs.existsSync(file)) throw new Error(`No DATABASE_URL and no ${file}; nothing to count`);
  return { store: JSON.parse(fs.readFileSync(file, "utf8")) as KpiCountsInput, source: "file" };
}

async function main() {
  loadEnvFile();
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : null;
  const date = args.find((a, i) => /^\d{4}-\d{2}-\d{2}$/.test(a) && i !== outAt + 1);
  const asOf = date ? `${date}T23:59:59.999+03:00` : new Date().toISOString();
  const { store, source } = await readStoreReadOnly();
  const result = { ...computeKpiCounts(store, asOf), generated_at: new Date().toISOString(), source: `precifarm-cms ${source} store` };
  const text = JSON.stringify(result, null, 2) + "\n";
  if (out) {
    fs.writeFileSync(out, text, "utf8");
    console.error(`Wrote ${out}`);
  } else process.stdout.write(text);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
