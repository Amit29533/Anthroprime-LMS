import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { eodFixture } from "./helpers.mjs";

test("real HTTP transport: shared login, cookie protection, CSRF, limits, headers and static isolation", async () => {
  const fixture = eodFixture();
  const backend = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const response = await fixture.fetcher(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: body || undefined,
    });
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "anthroprime-http-"),
  );
  const root = fileURLToPath(new URL("../", import.meta.url));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      HOST: "127.0.0.1",
      APP_ORIGIN: origin,
      EOD_API_URL: `http://127.0.0.1:${backend.address().port}/api`,
      EOD_WEB_URL: `http://127.0.0.1:${backend.address().port}`,
      LMS_DATABASE: path.join(directory, "lms.sqlite"),
      LMS_SESSION_KEY: "9".repeat(64),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${origin}/health`)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* wait for listener */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, logs);
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get("content-security-policy"),
      /script-src 'self'/,
    );
    assert.equal((await fetch(`${origin}/.env`)).status, 404);
    assert.equal((await fetch(`${origin}/src/app.mjs`)).status, 404);
    const font = await fetch(`${origin}/assets/fonts/dm-sans-latin.woff2`);
    assert.equal(font.status, 200);
    assert.equal(font.headers.get("content-type"), "font/woff2");
    const logo = await fetch(`${origin}/assets/anthroprime-logo.jpg`);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get("content-type"), "image/jpeg");
    const body = JSON.stringify({
      username: "candidate",
      password: "correct-password",
    });
    assert.equal(
      (
        await fetch(`${origin}/api/login`, {
          method: "POST",
          headers: { origin: "https://evil.example", "x-lms-request": "1" },
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${origin}/api/login`, {
          method: "POST",
          headers: { origin },
          body,
        })
      ).status,
      403,
      "custom request header required",
    );
    const login = await fetch(`${origin}/api/login`, {
      method: "POST",
      headers: { origin, "x-lms-request": "1" },
      body,
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("cache-control"), /no-store/);
    assert.equal((await login.json()).token, undefined);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const learning = await fetch(`${origin}/api/learn`, {
      headers: { cookie },
    });
    assert.equal(learning.status, 200);
    assert.equal((await learning.json()).name, "Rohit Verma");
    const tooBig = await fetch(`${origin}/api/login`, {
      method: "POST",
      headers: { origin, "x-lms-request": "1" },
      body: "x".repeat(1000001),
    });
    assert.equal(tooBig.status, 413);
    const malformed = await fetch(`${origin}/api/login`, {
      method: "POST",
      headers: { origin, "x-lms-request": "1" },
      body: "{broken",
    });
    assert.equal(malformed.status, 400);
    const forged = await fetch(`${origin}/api/learn`, {
      headers: { cookie: "anthroprime=forged" },
    });
    assert.equal(forged.status, 401);
  } finally {
    if (child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
    await new Promise((resolve) => backend.close(resolve));
    const resolved = await fs.realpath(directory);
    assert.equal(
      path.dirname(resolved).toLowerCase(),
      (await fs.realpath(os.tmpdir())).toLowerCase(),
    );
    assert.ok(path.basename(resolved).startsWith("anthroprime-http-"));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
