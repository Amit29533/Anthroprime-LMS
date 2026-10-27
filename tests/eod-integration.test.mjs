/** Optional contract test against the actual EOD source checkout; never production. */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createStore } from "../src/store.mjs";
import { createSessions } from "../src/session.mjs";
import { createEodClient } from "../src/integrations/eod.mjs";
import { createApp } from "../src/app.mjs";
import { courseInput } from "./helpers.mjs";

test(
  "real EOD: shared account → scored baseline → learning + practice → new formal assessment",
  {
    skip: process.env.EOD_REPO
      ? false
      : "Set EOD_REPO to a local EOD-simple checkout to run the real integration contract.",
  },
  async (t) => {
    const { makeWorld } = await import(
      pathToFileURL(path.join(process.env.EOD_REPO, "tests/helpers/world.mjs"))
        .href
    );
    const w = await makeWorld({ t, mcq: 1, open: 1 });
    const candidate = await w.candidateUser("lms.integration");
    const assessor = await w.assessorUser("lms.assessor");
    await w.assign(candidate.assessmentId, assessor.user.id);
    await w.walkAndSubmit(candidate.token, candidate.assessmentId);
    await w.scoreAndFinalize(assessor.token, candidate.assessmentId);
    const eod = createEodClient({
      apiUrl: "https://eod-contract.example/api",
      fetcher: async (url, options) => {
        const target = new URL(url);
        const result = await w.app({
          method: options.method,
          path: target.pathname.replace(/^\/api/, ""),
          query: Object.fromEntries(target.searchParams),
          headers: options.headers,
          body: options.body ? JSON.parse(options.body) : undefined,
        });
        return new Response(JSON.stringify(result.body), {
          status: result.status,
        });
      },
    });
    const store = createStore(":memory:", eod.instance);
    t.after(() => store.close());
    const sessions = createSessions({ key: "5".repeat(64) });
    const app = createApp({ store, sessions, eod });
    const call = async (token, method, route, body = {}) =>
      app({
        method,
        path: route,
        body,
        headers: { cookie: sessions.issue(token).split(";")[0] },
      });
    await w.store.update("users", candidate.user.id, { email: "contract@example.test" });
    const invited = await call(w.tok, "POST", "/admin/training/invitations", { email: "contract@example.test" });
    assert.equal(invited.status, 200, JSON.stringify(invited.body));
    const login = await app({
      method: "POST",
      path: "/login",
      body: { username: "lms.integration", password: "User-pass-123" },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.id, candidate.user.id);
    const tracks = await eod.tracks(w.tok);
    assert.ok(tracks.some((r) => r.id === w.role.id));
    const input = courseInput({
      role_id: w.role.id,
      competency_ids: [w.c1.id],
    });
    const made = await call(w.tok, "POST", "/admin/courses", input);
    assert.equal(made.status, 200, JSON.stringify(made.body));
    const library = await call(candidate.token, "GET", "/learn");
    assert.equal(library.status, 200);
    assert.ok(library.body.reports.length);
    const enrolled = await call(
      candidate.token,
      "POST",
      `/courses/${made.body.course.id}/enroll`,
    );
    const id = enrolled.body.enrollment.id;
    assert.equal(enrolled.status, 200);
    await call(candidate.token, "POST", `/enrollments/${id}/complete`, {
      lesson_id: "reading",
    });
    const practiced = await call(
      candidate.token,
      "POST",
      `/enrollments/${id}/quiz`,
      { lesson_id: "practice", answers: { "q-one": "a" } },
    );
    assert.equal(practiced.body.enrollment.progress.complete, true);
    await call(candidate.token, "POST", `/enrollments/${id}/reassessment`);
    const allocated = await call(
      w.tok,
      "POST",
      `/admin/requests/${id}/allocate`,
    );
    assert.equal(allocated.status, 200, JSON.stringify(allocated.body));
    const paper = await w.store.get(
      "assessments",
      allocated.body.assessment_id,
    );
    assert.equal(paper.candidate_id, candidate.cand.id);
    assert.equal(paper.role_id, w.role.id);
    assert.equal(paper.assessor_id, assessor.user.id);
    assert.notEqual(paper.id, candidate.assessmentId);
    assert.equal(paper.status, "assigned");
    const replay = await call(w.tok, "POST", `/admin/requests/${id}/allocate`);
    assert.equal(replay.body.assessment_id, paper.id);
  },
);
