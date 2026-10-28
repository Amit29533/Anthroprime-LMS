import { getStore } from "@netlify/blobs";
import { createSessions } from "../../src/session.mjs";
import { createEodClient } from "../../src/integrations/eod.mjs";
import { createApp } from "../../src/app.mjs";
import { createBlobRunner } from "../../src/blob-store.mjs";
import {
  MAX_BODY_BYTES,
  SECURITY_HEADERS,
  createLoginLimiter,
  handleApi,
} from "../../src/gateway.mjs";

/**
 * Netlify Function for every /api/* request and /health. Static pages are
 * served from `public` by Netlify itself (see netlify.toml). Learning data is
 * kept in Netlify Blobs, because a function has no durable disk.
 */
const limited = createLoginLimiter();
const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "strict-transport-security": "max-age=31536000",
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...extra,
    },
  });

// Previews and branch deploys get their own data, never the live candidates'.
export const storeName = (deployContext) =>
  !deployContext || deployContext === "production"
    ? process.env.LMS_BLOBS_STORE || "anthroprime-lms"
    : `anthroprime-lms-${String(deployContext).replace(/[^a-z0-9-]/gi, "-")}`;

export function createHandler({
  blobsFor = (name) => getStore({ name, consistency: "strong" }),
} = {}) {
  let configured;
  const configure = (url, deployContext) => {
    if (configured) return configured;
    const origin = process.env.APP_ORIGIN || url.origin;
    const production = new URL(origin).protocol === "https:";
    const eod = createEodClient({
      apiUrl: process.env.EOD_API_URL,
      webUrl: process.env.EOD_WEB_URL,
    });
    const sessions = createSessions({
      key: process.env.LMS_SESSION_KEY || undefined,
      production,
    });
    const blobs = blobsFor(storeName(deployContext));
    const run = createBlobRunner({ blobs, instance: eod.instance });
    configured = {
      origin,
      app: (request) => run((store) => createApp({ store, eod, sessions })(request)),
    };
    return configured;
  };

  return async (req, context) => {
    const url = new URL(req.url);
    if (url.pathname === "/health")
      return json(200, { ok: true, service: "anthroprime-lms", version: "0.1.0" });
    let setup;
    try {
      setup = configure(url, context?.deploy?.context);
    } catch (err) {
      console.error("[lms] configuration", err.message);
      return json(503, {
        error:
          "The learning platform is not configured. Set EOD_API_URL, EOD_WEB_URL and LMS_SESSION_KEY in the Netlify environment, then redeploy.",
      });
    }
    try {
      const result = await handleApi({
        method: req.method,
        pathname: url.pathname,
        headers: Object.fromEntries(req.headers),
        address: context?.ip || "",
        origin: setup.origin,
        limited,
        app: setup.app,
        async readBody() {
          if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return null;
          const text = await req.text();
          return Buffer.byteLength(text) > MAX_BODY_BYTES ? null : text;
        },
      });
      return json(result.status, result.body, result.headers);
    } catch (err) {
      if (err.code === "STORE_BUSY")
        return json(503, { error: "Several changes arrived at once. Please retry." }, { "retry-after": "2" });
      console.error("[lms]", err.name, err.message);
      return json(500, { error: "The request could not be completed." });
    }
  };
}

export default createHandler();

export const config = { path: ["/api/*", "/health"] };
