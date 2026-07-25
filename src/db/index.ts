import { isPostgresEnabled } from "./client";
import * as fileStore from "./store";
import * as pgStore from "./postgres-store";

export type { DataStore } from "./store";
export { isPostgresEnabled };

export async function ensureSeeded(): Promise<void> {
  if (isPostgresEnabled()) {
    await pgStore.ensureSeeded();
  } else {
    fileStore.ensureSeeded();
  }
}

export async function getStore() {
  if (isPostgresEnabled()) {
    return pgStore.getStore();
  }
  return fileStore.getStore();
}

export async function mutateStore(fn: (store: fileStore.DataStore) => void): Promise<void> {
  if (isPostgresEnabled()) {
    await pgStore.mutateStore(fn);
  } else {
    fileStore.mutateStore(fn);
  }
}
