import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const KINDS = new Set([
  "courses",
  "paths",
  "enrollments",
  "path_enrollments",
  "audit",
  "requests",
  "metadata",
  "invitations",
]);
export function createStore(file = ":memory:", instance = "test", { rows } = {}) {
  if (file !== ":memory:")
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(kind,id));
    CREATE INDEX IF NOT EXISTS learner_lookup ON records(kind,json_extract(data,'$.learner_id'));
    CREATE UNIQUE INDEX IF NOT EXISTS unique_course_enrollment ON records(json_extract(data,'$.learner_id'),json_extract(data,'$.course_id')) WHERE kind='enrollments';
    CREATE UNIQUE INDEX IF NOT EXISTS unique_path_enrollment ON records(json_extract(data,'$.learner_id'),json_extract(data,'$.path_id')) WHERE kind='path_enrollments';`);
  // Rows from a hosted snapshot (Netlify Blobs) load in their saved order, so
  // newest-first listings read the same as they do from a database file.
  if (rows?.length) {
    const load = db.prepare("INSERT INTO records(kind,id,data) VALUES(?,?,?)");
    db.exec("BEGIN");
    try {
      for (const row of rows) load.run(row.kind, row.id, JSON.stringify(row.data));
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      db.close();
      throw err;
    }
  }
  let writes = 0;
  const check = (kind) => {
    if (!KINDS.has(kind)) throw new Error("Unknown record kind");
  };
  const store = {
    get(kind, id) {
      check(kind);
      const row = db
        .prepare("SELECT data FROM records WHERE kind=? AND id=?")
        .get(kind, id);
      return row ? JSON.parse(row.data) : null;
    },
    list(kind, filter = {}) {
      check(kind);
      return db
        .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid DESC")
        .all(kind)
        .map((row) => JSON.parse(row.data))
        .filter((row) =>
          Object.entries(filter).every(([key, value]) => row[key] === value),
        );
    },
    insert(kind, data) {
      check(kind);
      const row = {
        ...data,
        id: data.id || randomUUID(),
        created_at: new Date().toISOString(),
      };
      db.prepare("INSERT INTO records(kind,id,data) VALUES(?,?,?)").run(
        kind,
        row.id,
        JSON.stringify(row),
      );
      writes += 1;
      return row;
    },
    update(kind, id, patch) {
      const current = store.get(kind, id);
      if (!current) return null;
      const row = {
        ...current,
        ...patch,
        id,
        updated_at: new Date().toISOString(),
      };
      db.prepare("UPDATE records SET data=? WHERE kind=? AND id=?").run(
        JSON.stringify(row),
        kind,
        id,
      );
      writes += 1;
      return row;
    },
    transaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        if (result?.then)
          throw new Error(
            "Database transactions must not contain asynchronous work.",
          );
        db.exec("COMMIT");
        return result;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    audit(actor, action, entity, details = {}) {
      return store.insert("audit", {
        actor: actor.id,
        actor_name: actor.name,
        action,
        entity,
        details,
      });
    },
    /** Inserts and updates made so far; a hosted snapshot is saved only when this moved. */
    get writes() {
      return writes;
    },
    exportRows() {
      return db
        .prepare("SELECT kind, id, data FROM records ORDER BY rowid")
        .all()
        .map((row) => ({ kind: row.kind, id: row.id, data: JSON.parse(row.data) }));
    },
    close() {
      db.close();
    },
  };
  const previous = store.get("metadata", "eod-instance");
  if (previous && previous.instance !== instance) {
    db.close();
    throw new Error(
      "This database belongs to a different EOD instance. Use a separate database or an explicit migration.",
    );
  }
  if (!previous)
    store.insert("metadata", {
      id: "eod-instance",
      instance,
      schema_version: 1,
    });
  return store;
}
