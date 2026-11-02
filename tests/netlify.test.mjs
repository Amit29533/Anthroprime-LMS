import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createBlobRunner } from "../src/blob-store.mjs";
import { eodFixture } from "./helpers.mjs";

/** An in-memory stand-in for a Netlify Blobs store with ETag-conditional writes. */
function fakeBlobs() {
  let value = null;
  let etag = null;
  let version = 0;
  const blobs = {
    saves: 0,
    beforeSave: null,
    async getWithMetadata() {
      return value === null ? null : { data: JSON.parse(value), etag, metadata: {} };
    },
    async setJSON(_key, data, conditions = {}) {
      await blobs.beforeSave?.();
      if (conditions.onlyIfNew && value !== null) return { modified: false };
      if (conditions.onlyIfMatch && conditions.onlyIfMatch !== etag) return { modified: false };
      value = JSON.stringify(data);
      etag = `"v${++version}"`;
      blobs.saves += 1;
      return { modified: true, etag };
    },
    /** Another instance saving the same data: only the ETag moves. */
    touch() {
      etag = `"v${++version}"`;
    },
  };
  return blobs;
}

test("Blobs runner: writes persist between requests, reads never save, order and timestamps survive", async () => {
  const blobs = fakeBlobs();
  const run = createBlobRunner({ blobs, instance: "https://ecod.example/api/" });
  const first = await run((store) => store.insert("invitations", { id: "one", email: "a@example.test" }));
  await run((store) => store.insert("invitations", { id: "two", email: "b@example.test" }));
  assert.equal(blobs.saves, 2);
  const listed = await run((store) => store.list("invitations").map((r) => r.id));
  assert.deepEqual(listed, ["two", "one"], "newest first, as on a database file");
  assert.equal(blobs.saves, 2, "a read-only request does not save");
  const again = await run((store) => store.get("invitations", "one"));
  assert.equal(again.created_at, first.created_at);
  const otherEcod = createBlobRunner({ blobs, instance: "https://other.example/api/" });
  await assert.rejects(otherEcod((store) => store.get("invitations", "one")), /different EOD instance/);
});

test("Blobs runner: a lost race replays the request on the newer data; endless contention gives up cleanly", async () => {
  const blobs = fakeBlobs();
  const run = createBlobRunner({ blobs, instance: "https://ecod.example/api/" });
  await run((store) => store.insert("invitations", { id: "base" }));
  let attempts = 0;
  blobs.beforeSave = async () => {
    // Another instance saves first, once.
    blobs.beforeSave = null;
    await run((store) => store.insert("invitations", { id: "rival" }));
  };
  await run((store) => {
    attempts += 1;
    store.insert("invitations", { id: `mine-${attempts}` });
  });
  assert.equal(attempts, 2, "the request ran again after losing the race");
  const ids = await run((store) => store.list("invitations").map((r) => r.id).sort());
  assert.deepEqual(ids, ["base", "mine-2", "rival"], "neither writer's change was lost");

  blobs.beforeSave = async () => blobs.touch();
  await assert.rejects(run((store) => store.insert("invitations", { id: "never" })), { code: "STORE_BUSY" });
});

test("Netlify function: health, configuration errors, CSRF, sign-in, invite-only access and data shared across instances", async (t) => {
  const fixture = eodFixture();
  const backend = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await fixture.fetcher(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString() || undefined,
    });
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const saved = { ...process.env };
  t.after(() => {
    backend.close();
    for (const key of ["APP_ORIGIN", "EOD_API_URL", "EOD_WEB_URL", "LMS_SESSION_KEY"])
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
  });
  const { createHandler, storeName } = await import("../netlify/functions/api.mjs");
  const origin = "https://learning.example";
  const context = { ip: "203.0.113.9", deploy: { context: "production" } };
  const request = (handler, path, { method = "GET", body, cookie = "", headers = {} } = {}) =>
    handler(
      new Request(`${origin}/api${path}`, {
        method,
        headers: { origin, "x-lms-request": "1", "content-type": "application/json", cookie, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
      context,
    );
  const read = async (response) => ({ status: response.status, body: await response.json(), cookie: (response.headers.get("set-cookie") || "").split(";")[0] });

  for (const key of ["APP_ORIGIN", "EOD_API_URL", "EOD_WEB_URL", "LMS_SESSION_KEY"]) delete process.env[key];
  const unconfigured = createHandler({ blobsFor: () => fakeBlobs() });
  assert.equal((await unconfigured(new Request(`${origin}/health`), context)).status, 200);
  const missing = await read(await request(unconfigured, "/session"));
  assert.equal(missing.status, 503);
  assert.match(missing.body.error, /EOD_API_URL/);

  process.env.APP_ORIGIN = origin;
  process.env.EOD_API_URL = `http://127.0.0.1:${backend.address().port}/api`;
  process.env.EOD_WEB_URL = `http://127.0.0.1:${backend.address().port}`;
  process.env.LMS_SESSION_KEY = "7".repeat(64);
  const blobs = fakeBlobs();
  const names = [];
  const handler = createHandler({ blobsFor: (name) => (names.push(name), blobs) });
  const asset = (cookie = "", file = "page-2.js") => handler(new Request(`${origin}/interactive/week-1/${file}`, { headers: { cookie } }), context);
  assert.equal((await asset()).status, 401);

  const forged = await read(await request(handler, "/login", { method: "POST", body: {}, headers: { origin: "https://evil.example" } }));
  assert.equal(forged.status, 403);

  const admin = await read(await request(handler, "/login", { method: "POST", body: { username: "admin", password: "correct-password" } }));
  assert.equal(admin.status, 200);
  assert.match(admin.cookie, /^__Host-anthroprime=/, "HTTPS deployments use the secure cookie");
  const signIn = { method: "POST", body: { username: "candidate", password: "correct-password" } };
  const refused = await read(await request(handler, "/login", signIn));
  assert.equal(refused.status, 403, "not invited yet");
  assert.equal(refused.body.code, "TRAINING_INVITE_REQUIRED");

  const invited = await read(await request(handler, "/admin/training/invitations", { method: "POST", body: { email: "rohit@example.test" }, cookie: admin.cookie }));
  assert.equal(invited.status, 200);

  // A fresh function instance (cold start) reads the same Blobs data.
  const coldStart = createHandler({ blobsFor: () => blobs });
  const candidate = await read(await request(coldStart, "/login", signIn));
  assert.equal(candidate.status, 200);
  const practice = await asset(candidate.cookie);
  assert.equal(practice.status, 200);
  assert.match(practice.headers.get("cache-control"), /private, no-store/);
  assert.match(await practice.text(), /LESSONS/);
  const progress = await read(await request(handler, "/interactive/state/week-1", { cookie: candidate.cookie }));
  assert.equal((await request(handler, "/interactive/state/week-1", { method: "PUT", cookie: candidate.cookie, body: { ...progress.body, state: { xp: 5, done: {}, badges: {} } } })).status, 200);
  const persisted = await read(await request(coldStart, "/interactive/state/week-1", { cookie: candidate.cookie }));
  assert.equal(persisted.body.state.xp, 5, "practice survives Netlify cold starts");
  const learn = await read(await request(coldStart, "/learn", { cookie: candidate.cookie }));
  assert.equal(learn.status, 200);
  assert.deepEqual(names, ["anthroprime-lms"]);
  assert.equal(storeName("deploy-preview"), "anthroprime-lms-deploy-preview", "previews never touch live data");

  const huge = await read(await request(handler, "/admin/training/invitations", { method: "POST", body: { email: "x".repeat(1000001) }, cookie: admin.cookie }));
  assert.equal(huge.status, 413);
  assert.equal((await request(handler, `/admin/training/invitations/${invited.body.invitation.id}`, { method: "PUT", cookie: admin.cookie, body: { status: "revoked" } })).status, 200);
  assert.equal((await asset(candidate.cookie, "index.html")).status, 403);
  assert.equal((await asset(candidate.cookie)).status, 403);
});
