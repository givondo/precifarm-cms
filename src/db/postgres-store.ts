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
    const store = seedStore();
    await db.insert(appStore).values({ id: STORE_ID, data: store });
    return store;
  }

  const normalized = normalizeStore(rows[0].data as DataStore);
  if (normalized.changed) {
    await db
      .update(appStore)
      .set({ data: normalized.store, updatedAt: new Date() })
      .where(eq(appStore.id, STORE_ID));
  }

  return normalized.store;
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
        store = seedStore();
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
