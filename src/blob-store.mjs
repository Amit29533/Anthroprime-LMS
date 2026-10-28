import { createStore } from "./store.mjs";

const KEY = "records";
const ATTEMPTS = 4;

export class StoreBusyError extends Error {
  constructor() {
    super("The learning data was changed by another request at the same time.");
    this.code = "STORE_BUSY";
  }
}

/**
 * Hosted storage for platforms without a durable disk (Netlify Functions).
 *
 * The whole LMS dataset lives in one Netlify Blob. Each request loads it into an
 * in-memory SQLite store, so the app keeps its synchronous transactions, and a
 * request that wrote anything saves the snapshot back only if nobody else saved
 * in between (`onlyIfMatch` on the ETag it read). On a lost race the request is
 * replayed against the newer data; every LMS write is idempotent for that
 * reason, including the EOD allocation, which carries a deterministic id.
 */
export function createBlobRunner({ blobs, instance }) {
  return async function run(work) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const saved = await blobs.getWithMetadata(KEY, { type: "json" });
      const store = createStore(":memory:", instance, { rows: saved?.data?.rows || [] });
      let result;
      let snapshot;
      try {
        result = await work(store);
        if (store.writes) snapshot = { version: 1, rows: store.exportRows() };
      } finally {
        store.close();
      }
      if (!snapshot) return result;
      const written = await blobs.setJSON(
        KEY,
        snapshot,
        saved?.etag ? { onlyIfMatch: saved.etag } : { onlyIfNew: true },
      );
      if (written?.modified !== false) return result;
    }
    throw new StoreBusyError();
  };
}
