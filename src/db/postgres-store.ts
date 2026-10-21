import postgres from "postgres";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { appStore } from "./schema";
import { normalizeStore, seedStore, type DataStore } from "./store";
import { getDatabaseUrl } from "@/lib/database-url";

const STORE_ID = "default";

function getSql() {
  const url = getDatabaseUrl()!;
  return postgres(url, {
    max: 1,
    prepare: false,
    ssl: url.includes("supabase") ? "require" : undefined,
  });
}

export async function ensureSeeded(): Promise<void> {
  await getStore();
}

export async function getStore(): Promise<DataStore> {
  const db = getDb();
  const rows = await db.select().from(appStore).where(eq(appStore.id, STORE_ID)).limit(1);

  if (rows.length === 0) {
    const store = normalizeStore(seedStore()).store;
    await db.insert(appStore).values({ id: STORE_ID, data: store });
    return store;
  }

  // Check on a copy first: most reads change nothing and need no transaction.
  const probe = normalizeStore(structuredClone(rows[0].data as DataStore));
  if (!probe.changed) return probe.store;
  return normalizeWithBackup();
}

/** Prefix of the rows that keep the data exactly as it was before the code changed it. */
export const BACKUP_PREFIX = "bak-"; // app_store.id is varchar(32): "bak-" + YYYYMMDDHHMMSS fits

/**
 * Normalising rewrites accounts (hashes, retired passwords, the admin), so it runs inside a locked
 * transaction and first saves the untouched data as its own app_store row. Rolling back to older code
 * is then a single UPDATE from that row (see docs/HOSTING.md).
 */
async function normalizeWithBackup(): Promise<DataStore> {
  const sql = getSql();
  try {
    return await sql.begin(async (tx) => {
      const rows = await tx<{ data: DataStore }[]>`
        SELECT data FROM app_store WHERE id = ${STORE_ID} FOR UPDATE
      `;
      if (rows.length === 0) throw new Error("app_store row disappeared during normalisation.");
      const original = rows[0].data;
      const normalized = normalizeStore(structuredClone(original));
      if (!normalized.changed) return normalized.store;
      const backupId = `${BACKUP_PREFIX}${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
      await tx`
        INSERT INTO app_store (id, data, updated_at)
        VALUES (${backupId}, ${tx.json(original)}, NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      await tx`
        UPDATE app_store SET data = ${tx.json(normalized.store)}, updated_at = NOW()
        WHERE id = ${STORE_ID}
      `;
      return normalized.store;
    });
  } finally {
    await sql.end();
  }
}

export async function mutateStore(fn: (store: DataStore) => void): Promise<void> {
  const sql = getSql();

  try {
    await sql.begin(async (tx) => {
      const rows = await tx<{ data: DataStore }[]>`
        SELECT data FROM app_store WHERE id = ${STORE_ID} FOR UPDATE
      `;

      let store: DataStore;
      if (rows.length === 0) {
        store = normalizeStore(seedStore()).store;
        await tx`
          INSERT INTO app_store (id, data, updated_at)
          VALUES (${STORE_ID}, ${tx.json(store)}, NOW())
        `;
      } else {
        store = rows[0].data;
      }

      fn(store);

      await tx`
        UPDATE app_store
        SET data = ${tx.json(store)}, updated_at = NOW()
        WHERE id = ${STORE_ID}
      `;
    });
  } finally {
    await sql.end();
  }
}
