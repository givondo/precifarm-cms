/**
 * Prints Supabase env vars for Netlify. Run: npm run netlify:database-url
 */
import fs from "fs";
import path from "path";

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

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error(".env not found.");
  process.exit(1);
}

let password = "";
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith("SUPABASE_DB_PASSWORD=")) {
    password = parseEnvValue(trimmed.slice("SUPABASE_DB_PASSWORD=".length));
    break;
  }
}

if (!password) {
  console.error("SUPABASE_DB_PASSWORD not found in .env");
  process.exit(1);
}

console.log(`
Add these in Netlify → Environment variables (Production):

  SUPABASE_DB_PASSWORD = ${password}
  SUPABASE_PROJECT_REF = wvqkhvimsxgyxryehnom   (optional — already the default)

You can DELETE DATABASE_URL on Netlify — the app builds the connection URL automatically.
Builds scope is fine to leave checked for SUPABASE_DB_PASSWORD.
`);
