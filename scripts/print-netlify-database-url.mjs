/**
 * Prints DATABASE_URL for Netlify (from local .env). Run: node scripts/print-netlify-database-url.mjs
 * Copy the output into Netlify → Environment variables → DATABASE_URL (Functions scope only).
 */
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error(".env not found. Run npm run supabase:setup first.");
  process.exit(1);
}

let databaseUrl = "";
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (line.startsWith("DATABASE_URL=")) {
    databaseUrl = line.slice("DATABASE_URL=".length).trim();
    break;
  }
}

if (!databaseUrl || databaseUrl.includes("YOUR_PASSWORD")) {
  console.error("DATABASE_URL missing or placeholder in .env. Run: npm run supabase:setup");
  process.exit(1);
}

console.log("Copy this value into Netlify → DATABASE_URL (Functions scope only, NOT Builds):\n");
console.log(databaseUrl);
