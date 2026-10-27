import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./src/store.mjs";
import { createSessions } from "./src/session.mjs";
import { createEodClient } from "./src/integrations/eod.mjs";
import { createApp } from "./src/app.mjs";

const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3140);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT.");
const origin = process.env.APP_ORIGIN || `http://127.0.0.1:${port}`;
if (production && new URL(origin).protocol !== "https:")
  throw new Error("APP_ORIGIN must use HTTPS in production.");
const eod = createEodClient({
  apiUrl: process.env.EOD_API_URL,
  webUrl: process.env.EOD_WEB_URL,
});
const sessions = createSessions({
  key: process.env.LMS_SESSION_KEY || undefined,
  production,
});
const store = createStore(
  process.env.LMS_DATABASE || "data/lms.sqlite",
  eod.instance,
);
const app = createApp({ store, eod, sessions });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const rates = new Map();
const headers = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  ...(production ? { "strict-transport-security": "max-age=31536000" } : {}),
};
const server = http.createServer(async (req, res) => {
  const reply = (status, data, extra = {}) => {
    res.writeHead(status, {
      ...headers,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...extra,
    });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === "/health")
      return reply(200, {
        ok: true,
        service: "anthroprime-lms",
        version: "0.1.0",
      });
    if (url.pathname.startsWith("/api/")) {
      if (!["GET", "POST", "PUT"].includes(req.method))
        return reply(405, { error: "Method not allowed." });
      if (
        req.method !== "GET" &&
        (req.headers.origin !== new URL(origin).origin ||
          req.headers["x-lms-request"] !== "1")
      )
        return reply(403, {
          error: "Open this action from the learning platform.",
        });
      if (url.pathname === "/api/login") {
        const address = req.socket.remoteAddress;
        const now = Date.now();
        for (const [key, entry] of rates)
          if (entry.until < now) rates.delete(key);
        const rate = rates.get(address) || { count: 0, until: now + 60000 };
        rate.count += 1;
        rates.set(address, rate);
        if (rate.count > 20)
          return reply(
            429,
            { error: "Too many sign-in attempts. Please wait a minute." },
            { "retry-after": "60" },
          );
      }
      const chunks = [];
      let bytes = 0;
      if (Number(req.headers["content-length"] || 0) > 1000000) {
        req.resume();
        return reply(413, {
          error: "This course is too large. Split it into smaller courses.",
        });
      }
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 1000000)
          return reply(413, {
            error: "This course is too large. Split it into smaller courses.",
          });
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return reply(400, { error: "Invalid JSON request." });
      }
      const result = await app({
        method: req.method,
        path: url.pathname.slice(4),
        headers: req.headers,
        body,
      });
      return reply(result.status, result.body, result.headers);
    }
    if (!["GET", "HEAD"].includes(req.method))
      return reply(405, { error: "Method not allowed." });
    const pathname = decodeURIComponent(url.pathname);
    const relative =
      pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const target = path.resolve(root, relative);
    if (
      !target.startsWith(`${root}${path.sep}`) ||
      !mime[path.extname(target)] ||
      relative.split(/[\\/]/).some((part) => part.startsWith("."))
    )
      return reply(404, { error: "File not found." });
    const content = await fs.readFile(target);
    res.writeHead(200, {
      ...headers,
      "content-type": mime[path.extname(target)],
      "cache-control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (err) {
    if (err.code === "ENOENT" || err instanceof URIError)
      reply(404, { error: "File not found." });
    else {
      console.error("[http]", err.name);
      reply(500, { error: "The request could not be completed." });
    }
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Anthroprime LMS: ${origin}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
