import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { world, tokens } from "./helpers.mjs";
import { interactiveAsset } from "../src/interactive.mjs";
import { lessonContent, bindRichLessons } from "../public/js/lesson-content.js";
import { rsaInteractivePath } from "../public/js/interactive-catalog.js";

const empty = () => ({ xp: 0, done: {}, badges: {} });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await tick(); }
  assert.ok(check(), "expected activity state did not appear");
}

test("practice state: account isolation, stale-tab protection, validation, revocation; no course completion", async (t) => {
  const w = world(t);
  const course = await w.makeCourse(), enrollment = await w.enroll(course);
  const endpoint = "/interactive/state/week-1";
  assert.equal((await w.call(null, "GET", endpoint)).status, 401);
  const first = (await w.call("candidate", "GET", endpoint)).body;
  const state = { xp: 25, done: { "lesson-1-b0": true }, badges: { LB: true } };
  assert.equal((await w.call("candidate", "PUT", endpoint, { ...first, state })).status, 200);
  const saved = (await w.call("candidate", "GET", endpoint)).body;
  assert.deepEqual(saved.state, state);
  assert.equal(saved.version, 1);
  const other = (await w.call("other", "GET", endpoint)).body;
  assert.deepEqual(other.state, empty());
  assert.notEqual(other.viewer, first.viewer);
  assert.equal((await w.call("other", "PUT", endpoint, { ...first, state })).status, 409, "old account's open page cannot write to the new account");
  assert.equal((await w.call("candidate", "PUT", endpoint, { ...first, state })).status, 409, "stale tabs cannot overwrite a newer save");
  assert.equal((await w.call("candidate", "PUT", endpoint, { ...saved, state: { ...state, xp: -1 } })).status, 400);
  assert.equal((await w.call("candidate", "GET", "/interactive/state/week-10")).status, 404);
  assert.deepEqual(w.store.get("enrollments", enrollment.id).progress, {});
  assert.equal(w.store.get("enrollments", enrollment.id).quiz_attempts, undefined);
  const invitation = w.store.list("invitations").find((i) => i.user_id === w.fixture.users[tokens.candidate].id);
  w.store.update("invitations", invitation.id, { status: "revoked" });
  assert.equal((await w.call("candidate", "GET", endpoint)).status, 403);
  assert.equal((await w.call("candidate", "PUT", endpoint, { ...saved, state })).status, 403);
});

test("private assets: HTML and answer-bearing scripts require live invitation; paths are bounded", async (t) => {
  const w = world(t);
  const headers = { cookie: w.sessions.issue(tokens.candidate).split(";")[0] };
  for (const name of ["week-1/index.html", "week-1/page-2.js", "activity.js", "style-shim.js"]) {
    await assert.rejects(access(new URL(`../public/interactive/${name}`, import.meta.url)));
    const args = { pathname: `/interactive/${name}`, method: "GET", app: w.app };
    assert.equal((await interactiveAsset({ ...args, headers: {} })).status, 401);
    const response = await interactiveAsset({ ...args, headers });
    assert.equal(response.status, 200);
    assert.match(response.headers["cache-control"], /private, no-store/);
    assert.equal(response.headers.vary, "Cookie");
    assert.ok(response.body.length);
    assert.equal((await interactiveAsset({ ...args, method: "HEAD", headers })).body, null);
  }
  for (const pathname of ["/interactive/../rsa-course.mjs", "/interactive/week-10/index.html", "/interactive/week-1/not-real.js"]) {
    assert.equal((await interactiveAsset({ pathname, method: "GET", headers, app: w.app })).status, 404);
  }
  const invitation = w.store.list("invitations").find((i) => i.user_id === w.fixture.users[tokens.candidate].id);
  w.store.update("invitations", invitation.id, { status: "revoked" });
  assert.equal((await interactiveAsset({ pathname: "/interactive/week-1/page-2.js", method: "GET", headers, app: w.app })).status, 403);
});

test("rich lessons: Windows line endings, escaped code/tables, bounded embeds and source-checked messages", async (t) => {
  const body = "## Example\n\n```sql\nSELECT '<script>';\n```\n\n| Column | Meaning |\n|---|---|\n| <img> | sample |\n\nMore prose.";
  const html = lessonContent(body).html;
  assert.equal(lessonContent(body.replaceAll("\n", "\r\n")).html, html);
  assert.equal(lessonContent(body.replaceAll("\n", "\r")).html, html);
  assert.match(html, /lesson-code-copy/);
  assert.match(html, /<table/);
  assert.doesNotMatch(html, /<script>|<img>/);
  for (const src of ["https://evil.example", "//evil.example", "/api/me", "/interactive/week-1/../week-2/index.html"]) {
    assert.doesNotMatch(lessonContent(`::interactive ${src}`).html, /<iframe/);
  }
  const dom = new JSDOM(`<main>${html}${lessonContent("::interactive /interactive/week-1/index.html#lesson-1").html}</main>`, { url: "https://lms.example" });
  t.after(() => dom.window.close());
  const root = dom.window.document.querySelector("main"), frame = root.querySelector("iframe");
  const release = bindRichLessons(root); t.after(release);
  const send = (origin, source, data) => dom.window.dispatchEvent(new dom.window.MessageEvent("message", { origin, source, data: { type: "ecod-interactive", ...data } }));
  send("https://evil.example", frame.contentWindow, { height: 1000 });
  send("https://lms.example", dom.window, { height: 1000 });
  assert.equal(frame.style.height, "");
  send("https://lms.example", frame.contentWindow, { height: 10000, event: "lesson-complete" });
  assert.equal(frame.style.height, "6000px");
  assert.match(root.querySelector(".lesson-interactive-status").textContent, /Pass the course knowledge check/);
  let copied;
  Object.defineProperty(dom.window.navigator, "clipboard", { value: { async writeText(text) { copied = text; } } });
  root.querySelector("[data-lesson-copy]").click(); await tick();
  assert.equal(copied, "SELECT '<script>';");
  release(); send("https://lms.example", frame.contentWindow, { height: 400 });
  assert.equal(frame.style.height, "6000px", "closing reader removes listeners");
});

test("all 36 RSA practices render with server-loaded state and matching presentation links", async (t) => {
  for (let week = 1; week <= 9; week++) {
    const folder = new URL(`../content/interactive/week-${week}/`, import.meta.url);
    const html = await readFile(new URL("index.html", folder), "utf8");
    assert.match(html, /\/interactive\/activity.js/);
    assert.doesNotMatch(html, /<script src="page-2.js"/);
    const dom = new JSDOM(html, { url: `https://lms.example/interactive/week-${week}/index.html`, runScripts: "outside-only" });
    const w = dom.window; w.scrollTo = () => {}; w.structuredClone = structuredClone;
    let saved;
    w.__ecodActivity = { initial: { xp: 15, done: {}, badges: {} }, save: (state) => { saved = structuredClone(state); } };
    try {
      const script = await readFile(new URL("page-2.js", folder), "utf8");
      assert.doesNotMatch(script, /localStorage/);
      w.eval(`${script}\nwindow.reviewLessons = LESSONS; window.reviewRender = render;`);
      assert.equal(w.reviewLessons.length, 4);
      for (const [index, lesson] of w.reviewLessons.entries()) {
        assert.equal(rsaInteractivePath(`rsa-t0${week}-l${index + 1}`), `/interactive/week-${week}/index.html#${lesson.id}`);
        w.location.hash = lesson.id; w.reviewRender();
        assert.equal(w.document.querySelector("#main h1").textContent, lesson.title);
      }
      w.location.hash = "lesson-1"; w.reviewRender();
      w.document.querySelector(".poll .opt").click();
      assert.ok(saved.xp > 15);
    } finally { dom.window.close(); }
  }
  assert.equal(rsaInteractivePath("rsa-c01-c02-l1"), "");
});

test("practice bootstrap loads before the engine and retries the latest failed save", async (t) => {
  const dom = new JSDOM('<p id="activity-save-status"></p><button id="activity-retry" hidden>Retry</button>', { url: "https://lms.example/interactive/week-1/index.html", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window; w.structuredClone = structuredClone;
  const calls = []; let failSave = true;
  w.fetch = async (_url, options) => {
    calls.push(options);
    if (!options.method) return { ok: true, json: async () => ({ viewer: "one", version: 0, state: empty() }) };
    if (failSave) throw new Error("Connection lost.");
    return { ok: true, json: async () => ({ version: 1 }) };
  };
  w.eval(await readFile(new URL("../content/interactive/activity.js", import.meta.url), "utf8"));
  await until(() => w.__ecodActivity);
  assert.ok(w.document.querySelector('script[src="page-2.js"]'));
  w.__ecodActivity.save({ xp: 10, done: {}, badges: {} });
  w.__ecodActivity.save({ xp: 25, done: {}, badges: {} });
  await until(() => !w.document.querySelector("#activity-retry").hidden);
  assert.match(w.document.querySelector("#activity-save-status").textContent, /not saved/);
  failSave = false; w.document.querySelector("#activity-retry").click();
  await until(() => /Practice saved/.test(w.document.querySelector("#activity-save-status").textContent));
  assert.equal(JSON.parse(calls.at(-1).body).state.xp, 25);
  assert.equal(JSON.parse(calls.at(-1).body).viewer, "one");
  assert.equal(calls.at(-1).keepalive, true);
});
