import { readFile } from "node:fs/promises";
import path from "node:path";

const asset = /^\/interactive\/(?:style-shim\.js|activity\.js|week-[1-9]\/(?:index\.html|page-[12]\.(?:js|css)))$/;
const types = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8" };

/** Content lives outside the public directory: every asset checks live access. */
export async function interactiveAsset({ pathname, method, headers, app }) {
  const responseHeaders = { "cache-control": "private, no-store", vary: "Cookie" };
  const error = (status, message, extra = {}) => ({ status, headers: { ...responseHeaders, "content-type": "application/json; charset=utf-8", ...extra }, body: JSON.stringify({ error: message }) });
  if (!["GET", "HEAD"].includes(method)) return error(405, "Method not allowed.");
  if (!asset.test(pathname)) return error(404, "File not found.");
  const access = await app({ method: "GET", path: "/interactive/access", headers });
  if (access.status !== 200) return error(access.status, access.body.error, access.headers);
  try {
    const content = await readFile(path.join(process.cwd(), "content", pathname.slice(1)));
    return { status: 200, headers: { ...responseHeaders, "content-type": types[pathname.split(".").at(-1)] }, body: method === "HEAD" ? null : content };
  } catch (err) {
    if (err.code === "ENOENT") return error(404, "File not found.");
    throw err;
  }
}

/** Optional practice state, never a trusted quiz score or lesson completion. */
export function registerInteractiveRoutes({ route, store, identity, fail }) {
  const key = (auth, week) => {
    if (!/^week-[1-9]$/.test(week)) fail(404, "Activity not found.");
    return identity(auth.user.id, `interactive-v2:${week}`);
  };
  route("GET", "/interactive/access", "training", async () => ({}));
  route("GET", "/interactive/state/:week", "training", async ({ auth, params }) => {
    const viewer = key(auth, params.week);
    const row = store.get("activities", viewer);
    return { viewer, state: row?.state || { xp: 0, done: {}, badges: {} }, version: row?.version || 0 };
  });
  route("PUT", "/interactive/state/:week", "training", async ({ auth, params, body }) => {
    const id = key(auth, params.week), state = body.state;
    if (body.viewer !== id) fail(409, "Your signed-in account changed. Reload this practice before continuing.");
    const flags = (value, pattern, limit) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= limit && Object.entries(value).every(([k, v]) => pattern.test(k) && v === true);
    if (!state || !Number.isInteger(state.xp) || state.xp < 0 || state.xp > 100000
      || !flags(state.done, /^lesson-[1-4]-b\d{1,3}$/, 300)
      || !flags(state.badges, /^[A-Za-z0-9_-]{1,40}$/, 20)
      || !Number.isSafeInteger(body.version) || body.version < 0)
      fail(400, "Invalid activity progress.");
    return store.transaction(() => {
      const row = store.get("activities", id);
      if ((row?.version || 0) !== body.version) fail(409, "This practice was updated in another tab. Reload before continuing.");
      const record = { state: { xp: state.xp, done: state.done, badges: state.badges }, version: body.version + 1 };
      if (row) store.update("activities", id, record);
      else store.insert("activities", { id, ...record });
      return { version: record.version };
    });
  });
}
