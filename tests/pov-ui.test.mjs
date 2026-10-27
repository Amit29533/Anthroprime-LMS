import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { world, courseInput, tokens } from "./helpers.mjs";
import { player, lessonText, closeLearningWindow } from "../public/js/player.js";
import { courseOverview } from "../public/js/course-overview.js";
import { lessonContent } from "../public/js/lesson-content.js";
import { setupNavigation, closeNavigation, clearEditorGuard } from "../public/js/experience.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await tick(); }
  assert.ok(check(), "expected UI state did not appear");
}
function domWorld(t, { mobile = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#f5f4f1"></head><body><a class="skip" href="#main-content">Skip to content</a><div id="app"><main id="main-content"></main></div><div id="toast"></div></body></html>', { url: "http://localhost/#/home", pretendToBeVisual: true });
  const { window } = dom;
  const names = ["window", "document", "location", "history", "localStorage", "FormData", "CustomEvent", "fetch"];
  const old = Object.fromEntries(names.map((n) => [n, globalThis[n]]));
  for (const n of names.filter((n) => n !== "fetch")) globalThis[n] = window[n];
  window.matchMedia = (query) => ({ matches: query.includes("max-width") ? mobile : query.includes("min-width") ? !mobile : false, media: query, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event("close")); };
  t.after(() => { closeLearningWindow(); clearEditorGuard(); closeNavigation(); dom.window.close(); for (const n of names) { if (old[n] === undefined) delete globalThis[n]; else globalThis[n] = old[n]; } });
  return { window, document: window.document, view: window.document.querySelector("main"), dom };
}
function withInlineCheck() {
  const input = courseInput();
  const quiz = structuredClone(input.curriculum[0].lessons[1].quiz);
  quiz.pass_percent = 66;
  quiz.questions = Array.from({ length: 3 }, (_, i) => ({ ...quiz.questions[0], id: `question-${i}`, prompt: `Scenario ${i + 1}: which access policy follows least privilege?` }));
  input.curriculum[0].lessons[0].quiz = quiz;
  return input;
}
function selectAnswers(window, view, values) {
  for (const [i, value] of values.entries()) {
    assert.equal(view.querySelectorAll(".quiz-question:not([hidden])").length, 1, "only one question is presented at a time");
    const radio = view.querySelector(`input[name="question-${i}"][value="${value}"]`);
    assert.equal(radio.closest("fieldset").hidden, false, "the learner answers the visible question");
    radio.checked = true; radio.dispatchEvent(new window.Event("change", { bubbles: true }));
    if (i < values.length - 1) view.querySelector('[type="submit"]').click();
  }
}
function beginQuiz(view) {
  view.querySelector('[data-lesson="reading"][data-part="check"]').click();
  assert.equal(view.querySelector("#practice-form"), null, "the check has a separate introduction");
  view.querySelector("#start-quiz").click();
}

test("reader POV: the whole lesson is on one page, reading never completes it, and full screen retains the workspace and quiz draft", async (t) => {
  const { window, view, document } = domWorld(t);
  const w = world(t); const input = withInlineCheck();
  input.curriculum[0].lessons[0].body = "## Your goal\n\nChoose an access policy.\n\n## Worked example\n\nLimit access to the data needed.";
  const course = await w.makeCourse(input); const enrollment = await w.enroll(course);
  let writes = 0;
  const api = async (route, options = {}) => {
    if (options.method === "POST") writes++;
    const r = await w.call("candidate", options.method || "GET", route, options.body);
    return r.body;
  };
  await player(view, enrollment.id, { api });
  const workspace = view.querySelector("#learning-workspace");
  let native = null;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => native });
  workspace.requestFullscreen = async () => { native = workspace; document.dispatchEvent(new window.Event("fullscreenchange")); };
  document.exitFullscreen = async () => { native = null; document.dispatchEvent(new window.Event("fullscreenchange")); };
  view.querySelector("#toggle-learning-fullscreen").click(); await tick();
  assert.equal(native, workspace);
  const body = view.querySelector(".lesson-body");
  assert.match(body.querySelector(".lesson-goal").textContent, /Choose an access policy/);
  assert.equal(body.querySelector("h2").textContent, "Worked example");
  assert.match(body.textContent, /Limit access to the data needed/, "every section is visible without paging");
  assert.equal(view.querySelector("details"), view.querySelector(".learn-module"), "no lesson text is hidden behind a disclosure");
  view.querySelector('[data-lesson="reading"][data-part="read"]').click();
  assert.equal(view.querySelector("#learning-workspace"), workspace, "paint preserves the native full-screen element");
  assert.equal(native, workspace);
  assert.equal(writes, 0, "reading is not completion evidence");
  beginQuiz(view);
  const radio = view.querySelector('input[name="question-0"][value="a"]');
  radio.checked = true; radio.dispatchEvent(new window.Event("change", { bubbles: true }));
  view.querySelector('[type="submit"]').click();
  assert.equal(native, workspace);
  view.querySelector("#toggle-learning-fullscreen").click(); await tick();
  assert.equal(native, null);
  view.querySelector("#previous-question").click();
  assert.equal(view.querySelector('input[name="question-0"][value="a"]').checked, true);
  assert.equal(writes, 0, "only the final server submission grades the check");
  delete workspace.requestFullscreen;
  view.querySelector("#toggle-learning-fullscreen").click(); await tick();
  assert.equal(workspace.classList.contains("is-expanded"), true, "unsupported full screen has an expanded-window fallback");
  assert.equal(view.querySelector("#toggle-learning-fullscreen").getAttribute("aria-label"), "Exit full screen");
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(workspace.classList.contains("is-expanded"), false);
  assert.equal(view.querySelector(".learn-notice").hidden, true);
  closeLearningWindow();
  assert.equal(document.body.classList.contains("learning-window-open"), false);
});

test("mobile reader POV: outline traps focus in visible items, closes on Escape, and restores the learning stage", async (t) => {
  const { window, document, view } = domWorld(t, { mobile: true });
  const w = world(t); const course = await w.makeCourse(withInlineCheck()); const enrollment = await w.enroll(course);
  const data = (await w.call("candidate", "GET", `/enrollments/${enrollment.id}`)).body;
  await player(view, enrollment.id, { api: async () => data });
  assert.equal(view.querySelector(".learn-outline").inert, true);
  view.querySelector("#toggle-course-outline").click();
  assert.equal(view.querySelector(".learn-stage").inert, true);
  assert.equal(document.activeElement, view.querySelector(".learn-outline a"));
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(document.activeElement.disabled, false);
  assert.ok(document.activeElement.closest(".learn-outline"));
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(view.querySelector(".learn-stage").inert, false);
  assert.equal(document.activeElement.id, "toggle-course-outline");
});

test("course overview POV: snapshot counts, next lesson and sequential locks remain accurate", async (t) => {
  const { view } = domWorld(t);
  const w = world(t); const course = await w.makeCourse(withInlineCheck()); const enrollment = await w.enroll(course);
  const data = (await w.call("candidate", "GET", `/enrollments/${enrollment.id}`)).body;
  await courseOverview(view, enrollment.id, { api: async () => data });
  assert.match(view.querySelector(".overview-progress").textContent, /0% complete/);
  assert.match(view.querySelector(".module-card").textContent, /2 lessons/);
  assert.equal(view.querySelector(".course-overview-hero .button").getAttribute("href"), `#/course/${enrollment.id}?lesson=reading`);
  const links = [...view.querySelectorAll(".overview-lesson-row a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, [`#/course/${enrollment.id}?lesson=reading`, `#/course/${enrollment.id}?lesson=reading&part=check`], "only the first uncompleted lesson and its check open");
  assert.equal(view.querySelectorAll(".overview-lesson-row .sr-only").length, 1);
  view.querySelector('[data-overview-tab="about"]').click();
  assert.match(view.querySelector(".about-side").textContent, /Go in order/);
  assert.equal(view.querySelector(".overview-lesson-row"), null);
  assert.equal(view.querySelector("#practice-form"), null);
});

test("lesson content: every line is shown, labels and bullet groups are structured, sources are footnotes, HTML stays inert", () => {
  const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
  const long = lessonContent(`## Overview\n\n${words}\n\nSource: supplied notes`);
  assert.match(long.html, /word0 /); assert.match(long.html, /word399/);
  assert.deepEqual(long.toc.map((t) => t.title), ["Overview"]);
  assert.deepEqual(long.sources, ["supplied notes"]);
  const slide = lessonContent("## Your learning goal\n\nDesign a governed lakehouse\n\n## Why it matters\n\nCore ideas\nTeams build a point solution for every new request\nSame raw data is copied by every team\nWHY IT MATTERS\nStorage sprawl multiplies cost");
  assert.match(slide.html, /class="lesson-goal"[\s\S]*Design a governed lakehouse/);
  assert.deepEqual(slide.toc.map((t) => t.title), ["Why it matters"], "the goal is a callout, not a section");
  assert.equal((slide.html.match(/class="lesson-label"/g) || []).length, 2);
  assert.equal((slide.html.match(/<li>/g) || []).length, 2, "short slide fragments become a list");
  assert.match(slide.html, /<p>Storage sprawl multiplies cost<\/p>/, "a single line under a label stays a sentence");
  assert.doesNotMatch(lessonContent("## <svg onload=x>\n\n<script>x</script>\n<img onerror=x>\n\nSource: <iframe>").html, /<script>|<img|<svg|<iframe>/);
});

test("candidate POV: real grading, red/green review, explicit retry, saved scores, next lesson and reassessment", async (t) => {
  const { window, view } = domWorld(t);
  const w = world(t);
  const course = await w.makeCourse(withInlineCheck());
  const enrollment = await w.enroll(course);
  const api = async (route, options = {}) => {
    const r = await w.call("candidate", options.method || "GET", route, options.body);
    if (r.status !== 200) throw new Error(r.body.error);
    return r.body;
  };
  await player(view, enrollment.id, { api, eodUrl: "https://assessment.example" });
  assert.equal(view.querySelector("#practice-form"), null, "reading has no inline quiz wall");
  beginQuiz(view);
  assert.equal(view.querySelectorAll(".quiz-question").length, 3);
  assert.equal(view.querySelector("[type=submit]").disabled, true, "submit explains that all answers are required");
  assert.equal(view.querySelectorAll(".is-correct,.is-incorrect").length, 0, "no answer key is shown before submission");
  selectAnswers(window, view, ["a", "b", "b"]);
  view.querySelector("#practice-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await until(() => view.querySelector(".quiz-result.review"));
  assert.match(view.querySelector(".quiz-result").textContent, /1 of 3 correct/);
  assert.equal(view.querySelectorAll(".quiz-option.is-correct").length, 3, "every correct answer is identified in review");
  assert.equal(view.querySelectorAll(".quiz-option.is-incorrect").length, 2);
  assert.match(view.querySelector(".is-incorrect .option-verdict").textContent, /Your answer/);
  assert.equal(view.querySelectorAll("fieldset:disabled").length, 3, "editing cannot make submitted feedback misleading");
  assert.equal(view.querySelector("#next-lesson"), null);
  assert.equal(view.querySelector("#complete-lesson"), null, "the normal complete button cannot bypass the check");
  assert.equal(document.activeElement, view.querySelector(".quiz-result"));
  view.querySelector("#retry-practice").click();
  assert.equal(view.querySelectorAll("input:checked").length, 0);
  assert.equal(view.querySelectorAll(".is-correct,.is-incorrect").length, 0);
  selectAnswers(window, view, ["a", "a", "b"]);
  view.querySelector("#practice-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await until(() => view.querySelector(".quiz-result.passed"));
  assert.match(view.querySelector(".player-progress").textContent, /50% complete/);
  assert.match(view.querySelector(".attempt-history").textContent, /33%/);
  assert.match(view.querySelector(".attempt-history").textContent, /67%/);
  view.querySelector("#next-lesson").click();
  assert.match(view.querySelector(".quiz-start").textContent, /Try a short scenario/);
  view.querySelector("#start-quiz").click();
  const radio = view.querySelector('input[value="a"]'); radio.checked = true; radio.dispatchEvent(new window.Event("change", { bubbles: true }));
  view.querySelector("#practice-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await until(() => view.querySelector("#request-reassessment"));
  assert.match(view.querySelector(".player-progress").textContent, /100% complete/);
  view.querySelector("#request-reassessment").click();
  await until(() => view.textContent.includes("Reassessment requested · awaiting allocation"));
  assert.equal(w.store.list("requests").length, 1);
  const admin = await w.call("admin", "GET", "/admin/training");
  assert.equal(admin.body.candidates.find((c) => c.id === "candidate-one").enrollments[0].progress.percent, 100);
});

test("candidate POV: network failure keeps selected answers and prevents duplicate submission", async (t) => {
  const { window, view } = domWorld(t);
  const w = world(t);
  const course = await w.makeCourse(withInlineCheck()); const enrollment = await w.enroll(course);
  let reject;
  let quizCalls = 0;
  const api = async (route, options = {}) => {
    if (route.endsWith("/quiz") && ++quizCalls === 1) return new Promise((_, r) => { reject = r; });
    const r = await w.call("candidate", options.method || "GET", route, options.body);
    if (r.status !== 200) throw new Error(r.body.error);
    return r.body;
  };
  await player(view, enrollment.id, { api });
  beginQuiz(view);
  selectAnswers(window, view, ["a", "a", "b"]);
  const submit = () => view.querySelector("#practice-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  submit(); submit();
  assert.equal(quizCalls, 1);
  assert.equal(view.querySelector("[type=submit]").disabled, true);
  reject(new Error("Connection interrupted."));
  await until(() => view.querySelector("#practice-error") && !view.querySelector("#practice-error").hidden);
  assert.match(view.querySelector("#practice-error").textContent, /selected answers are kept/);
  assert.equal(view.querySelectorAll("input:checked").length, 3);
  assert.equal(view.querySelector("[type=submit]").disabled, false);
  assert.equal(w.store.get("enrollments", enrollment.id).quiz_attempts, undefined);
  submit(); await until(() => view.querySelector(".quiz-result.passed"));
  assert.equal(w.store.get("enrollments", enrollment.id).quiz_attempts.reading.count, 1);
});

async function mountApp(t, w, role, { mobile = false } = {}) {
  const environment = domWorld(t, { mobile });
  let cookie = role ? w.sessions.issue(tokens[role]).split(";")[0] : "";
  globalThis.fetch = async (route, options = {}) => {
    const r = await w.app({ method: options.method || "GET", path: String(route).replace(/^\/api/, ""), body: options.body ? JSON.parse(options.body) : {}, headers: { cookie } });
    if (r.headers["set-cookie"]) cookie = r.headers["set-cookie"].split(";")[0];
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers });
  };
  await import(`../public/js/app.js?pov=${Date.now()}-${Math.random()}`);
  return environment;
}

test("candidate POV: assigned library works before a report; session revocation clears the learning workspace", async (t) => {
  const w = world(t);
  const course = await w.makeCourse(); const enrollment = await w.enroll(course);
  w.store.update("courses", course.id, { title: "Revised course title", status: "archived" });
  w.eod.learningContext = async () => ({ candidate: w.fixture.candidates[0], reports: new Map() });
  const { window, document } = await mountApp(t, w, "candidate");
  window.location.hash = "#/catalog";
  await until(() => document.querySelector("#course-search"));
  assert.match(document.querySelector(".course-card").textContent, /Governance in practice/);
  assert.ok(document.querySelector(`[data-open="${enrollment.id}"]`));
  assert.doesNotMatch(document.querySelector(".course-card").textContent, /Revised course title/, "enrollment keeps its published snapshot");
  assert.equal(document.querySelector('[href="#/training"]'), null);
  document.querySelector(`[data-open="${enrollment.id}"]`).click();
  await until(() => document.querySelector(".course-overview-hero"));
  window.location.hash = document.querySelector(".course-overview-hero .button").getAttribute("href");
  await until(() => document.querySelector("#learning-workspace"));
  assert.equal(document.body.classList.contains("learning-window-open"), true);
  window.location.hash = `#/course/${enrollment.id}`;
  await until(() => document.querySelector(".course-overview-hero"));
  assert.equal(document.body.classList.contains("learning-window-open"), false, "leaving the reader restores the standard workspace");
  const invitation = w.store.list("invitations").find((i) => i.email === "rohit@example.test");
  await w.call("admin", "PUT", `/admin/training/invitations/${invitation.id}`, { status: "revoked" });
  window.location.hash = "#/learning";
  await until(() => document.querySelector("#login-form"));
  assert.match(document.querySelector(".form-error").textContent, /invitation only/);
  assert.equal(document.querySelector(".course-card"), null);
});

test("admin POV: authoring, invitation-aware assignment, dashboard progress, and accessible dialog cancellation", async (t) => {
  const w = world(t);
  const course = await w.makeCourse(); await w.enroll(course);
  await w.call("admin", "PUT", `/admin/training/invitations/${w.store.list("invitations").find((i) => i.email === "priya@example.test").id}`, { status: "revoked" });
  const { window, document } = await mountApp(t, w, "admin");
  document.querySelector("#assign-learning").click();
  const dialog = document.querySelector("dialog");
  assert.ok(dialog.getAttribute("aria-labelledby"));
  const choices = [...dialog.querySelectorAll('[name="candidate_id"] option')].map((o) => o.textContent);
  assert.ok(choices.includes("Rohit Verma")); assert.ok(!choices.includes("Priya Student"));
  dialog.querySelector('[data-close]').click(); assert.equal(document.querySelector("dialog"), null);
  window.location.hash = "#/course-editor/new";
  await until(() => document.querySelector("#save-draft"));
  const title = document.querySelector('[name="title"]'); title.value = "A new learning module"; title.dispatchEvent(new window.Event("input", { bubbles: true }));
  document.querySelector("#save-draft").click();
  await until(() => w.store.list("courses").some((c) => c.title === "A new learning module"));
  assert.equal(w.store.list("courses").find((c) => c.title === "A new learning module").status, "draft");
  window.location.hash = "#/training";
  await until(() => document.querySelector(".training-dashboard"));
  assert.match(document.querySelector(".training-dashboard").textContent, /Candidate progression/);
  assert.match(document.querySelector(".training-dashboard").textContent, /Rohit Verma/);
});

test("mobile POV: opening, focus containment, Escape, scrim and focus restoration", (t) => {
  const { document, window } = domWorld(t, { mobile: true });
  document.querySelector("#app").innerHTML = '<aside id="sidebar"><button id="sidebar-close">Close</button><a href="#/home">Home</a><button id="last">Sign out</button></aside><button id="nav-scrim" hidden></button><div class="workspace-main"><button id="mobile-menu">Menu</button></div>';
  const root = document.querySelector("#app"); setupNavigation(root);
  const sidebar = root.querySelector("#sidebar"), opener = root.querySelector("#mobile-menu");
  assert.equal(sidebar.inert, true);
  opener.click();
  assert.equal(opener.getAttribute("aria-expanded"), "true");
  assert.equal(root.querySelector(".workspace-main").inert, true);
  root.querySelector("#last").focus();
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  assert.equal(document.activeElement.id, "sidebar-close");
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(opener.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, opener);
  assert.equal(root.querySelector(".workspace-main").inert, false);
  opener.click(); root.querySelector("#nav-scrim").click();
  assert.equal(root.querySelector("#nav-scrim").hidden, true);
});

test("learner text and quiz presentation escape source HTML instead of executing it", () => {
  const output = lessonText('## <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\nSource: trainer notes');
  assert.doesNotMatch(output, /<script>|<img/);
  assert.match(output, /&lt;script&gt;/);
});

test("account POV: existing ECOD credentials sign in, errors are actionable, and visible Log out clears the session", async (t) => {
  const w = world(t);
  const { document, window } = await mountApp(t, w, null);
  const submit = (password) => {
    const form = document.querySelector("#login-form");
    form.elements.username.value = "candidate"; form.elements.password.value = password;
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  };
  submit("wrong-password");
  await until(() => !document.querySelector(".form-error").hidden);
  assert.match(document.querySelector(".form-error").textContent, /Invalid username or password/);
  assert.equal(document.activeElement, document.querySelector(".form-error"));
  assert.equal(document.querySelector('#login-form [type="submit"]').disabled, false);
  submit("correct-password");
  await until(() => document.querySelector("#header-logout"));
  document.querySelector("#header-logout").click();
  await until(() => document.querySelector("#login-form"));
  window.location.hash = "#/learning";
  await tick();
  assert.ok(document.querySelector("#login-form"));
  assert.equal(document.querySelector(".workspace"), null);
});

test("navigation POV: a late lesson response cannot overwrite the screen after the learner leaves", async (t) => {
  const { view, document } = domWorld(t);
  const w = world(t); const course = await w.makeCourse(); const enrollment = await w.enroll(course);
  const data = (await w.call("candidate", "GET", `/enrollments/${enrollment.id}`)).body;
  let resolve;
  const loading = player(view, enrollment.id, { api: () => new Promise((r) => { resolve = r; }) });
  view.remove(); document.querySelector("#app").innerHTML = '<h1>Course library</h1>';
  resolve(data); await loading;
  assert.equal(document.querySelector("h1").textContent, "Course library");
  assert.equal(view.innerHTML, "");
});

test("author POV: internal navigation protects unsaved edits, cancellation keeps them, explicit discard leaves", async (t) => {
  const w = world(t);
  const { document, window } = await mountApp(t, w, "admin");
  window.location.hash = "#/course-editor/new";
  await until(() => document.querySelector("#save-draft"));
  const title = document.querySelector('[name="title"]');
  title.value = "Keep my unsaved course"; title.dispatchEvent(new window.Event("input", { bubbles: true }));
  window.location.hash = "#/studio";
  await until(() => document.querySelector("dialog"));
  assert.equal(document.querySelector('[name="title"]').value, "Keep my unsaved course");
  document.querySelector('.dialog-foot [data-close]').click();
  await until(() => !document.querySelector("dialog"));
  assert.equal(window.location.hash, "#/course-editor/new");
  assert.equal(document.querySelector('[name="title"]').value, "Keep my unsaved course");
  const unload = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, true, "hard-reload protection remains after cancelling internal navigation");
  window.location.hash = "#/training";
  await until(() => document.querySelector("dialog"));
  document.querySelector('dialog [type="submit"]').click();
  await until(() => document.querySelector(".training-dashboard"));
  assert.equal(w.store.list("courses").length, 0, "discard does not create or publish a course");
});

test("author POV: pending saves lock fields, prevent duplicate writes and keep navigation from discarding the save", async (t) => {
  const w = world(t); const { document, window } = await mountApp(t, w, "admin");
  window.location.hash = "#/course-editor/new";
  await until(() => document.querySelector("#save-draft"));
  const originalFetch = globalThis.fetch;
  let finish;
  let writes = 0;
  globalThis.fetch = (url, options = {}) => {
    if (url === "/api/admin/courses" && options.method === "POST") {
      writes++;
      return new Promise((resolve) => { finish = async () => resolve(await originalFetch(url, options)); });
    }
    return originalFetch(url, options);
  };
  const title = document.querySelector('[name="title"]'); title.value = "Save this version"; title.dispatchEvent(new window.Event("input", { bubbles: true }));
  document.querySelector("#save-draft").click();
  assert.equal(title.disabled, true);
  assert.match(document.querySelector("#editor-save-state").textContent, /Saving/);
  document.querySelector("#save-draft").click(); assert.equal(writes, 1);
  window.location.hash = "#/training";
  await until(() => window.location.hash === "#/course-editor/new");
  assert.match(document.querySelector("#toast").textContent, /being saved/);
  await finish();
  await until(() => window.location.hash === "#/studio");
  assert.equal(w.store.list("courses").filter((c) => c.title === "Save this version").length, 1);
});
