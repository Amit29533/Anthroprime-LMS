import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createStore } from "../src/store.mjs";
import { createSessions } from "../src/session.mjs";
import { createEodClient } from "../src/integrations/eod.mjs";

test("SQLite persists data and refuses accidental EOD-instance changes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "anthroprime-test-"));
  const file = path.join(dir, "test.sqlite");
  try {
    const a = createStore(file, "instance-one");
    a.insert("courses", { id: "course", title: "Saved" });
    a.close();
    const b = createStore(file, "instance-one");
    assert.equal(b.get("courses", "course").title, "Saved");
    b.close();
    assert.throws(
      () => createStore(file, "instance-two"),
      /different EOD instance/,
    );
  } finally {
    const resolved = await fs.realpath(dir);
    assert.equal(
      path.dirname(resolved).toLowerCase(),
      (await fs.realpath(os.tmpdir())).toLowerCase(),
    );
    assert.ok(path.basename(resolved).startsWith("anthroprime-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
test("transactions roll back every write and reject asynchronous transaction callbacks", () => {
  const s = createStore();
  try {
    assert.throws(() =>
      s.transaction(() => {
        s.insert("courses", { id: "one" });
        s.insert("courses", { id: "one" });
      }),
    );
    assert.equal(s.list("courses").length, 0);
    assert.throws(() => s.transaction(() => Promise.resolve()), /asynchronous/);
  } finally {
    s.close();
  }
});
test("encrypted sessions reject tampering and require production key configuration", () => {
  const sessions = createSessions({ key: "f".repeat(64), production: true });
  const token = "a".repeat(64);
  const cookie = sessions.issue(token);
  assert.equal(sessions.read(cookie), token);
  assert.match(cookie, /__Host-anthroprime=/);
  assert.match(cookie, /Secure/);
  const [name, value] = cookie.split(";")[0].split("=");
  assert.equal(
    sessions.read(`${name}=${value[0] === "A" ? "B" : "A"}${value.slice(1)}`),
    null,
  );
  assert.equal(sessions.read("anthroprime=not-a-session"), null);
  assert.throws(() => createSessions({ production: true }), /required/);
});
test("EOD integration refuses insecure remote origins, embedded credentials and route escape", async () => {
  for (const apiUrl of [
    "http://example.com/api",
    "https://user:password@example.com/api",
    "https://example.com/api?token=secret",
    "https://example.com/private",
  ])
    assert.throws(() => createEodClient({ apiUrl }));
  assert.throws(() =>
    createEodClient({
      apiUrl: "https://assessment.example/api",
      webUrl: "https://evil.example",
    }),
  );
  const eod = createEodClient({ apiUrl: "http://localhost:3131/api" });
  await assert.rejects(eod.call("//evil.example"), /Invalid EOD route/);
});
