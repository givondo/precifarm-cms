const PROJECT_REF = "wvqkhvimsxgyxryehnom";
const REGION = "eu-west-1";

function trim(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Build pooler URL from parts — avoids URL-encoding issues in Netlify env UI. */
export function getDatabaseUrl(): string | undefined {
  const password = trim("SUPABASE_DB_PASSWORD");
  if (password) {
    const ref = trim("SUPABASE_PROJECT_REF") ?? PROJECT_REF;
    const region = trim("SUPABASE_REGION") ?? REGION;
    const encoded = encodeURIComponent(password);
    return `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  }

  const direct = trim("DATABASE_URL");
  if (direct && !direct.includes("YOUR_PASSWORD")) {
    return direct;
  }

  return undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}
