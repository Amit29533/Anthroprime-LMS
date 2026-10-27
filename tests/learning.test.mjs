import { test } from "node:test";
import assert from "node:assert/strict";
import { world, courseInput } from "./helpers.mjs";
import {
  validateCourse,
  learnerCourse,
  gradePractice,
} from "../src/domain/learning.mjs";
import { HttpError } from "../src/integrations/eod.mjs";

test("publishing validates real content, track, links and quiz answers", async (t) => {
  const w = world(t);
  for (const input of [
    courseInput({ title: "" }),
    courseInput({ role_id: "missing" }),
    courseInput({ competency_ids: ["foreign"] }),
    courseInput({ curriculum: [] }),
  ])
    assert.equal(
      (await w.call("admin", "POST", "/admin/courses", input)).status,
      400,
    );
  const unsafe = courseInput();
  unsafe.curriculum[0].lessons[0].resource_url = "javascript:alert(1)";
  assert.match(validateCourse(unsafe), /HTTPS/);
  const quiz = courseInput();
  quiz.curriculum[0].lessons[1].quiz.questions[0].correct_option_id =
    "not-a-choice";
  assert.match(validateCourse(quiz), /quiz question/);
  const reserved = courseInput();
  reserved.curriculum[0].lessons[0].id = "__proto__";
  assert.match(validateCourse(reserved), /safe identifier/);
  const course = await w.makeCourse();
  assert.equal(course.status, "published");
});
test("unfinished draft lessons and questions can be saved without making them publishable", async (t) => {
  const w = world(t);
  const input = courseInput({ status: "draft", summary: "" });
  input.curriculum[0].title = "";
  input.curriculum[0].lessons[0].title = "";
  const q = input.curriculum[0].lessons[1].quiz.questions[0];
  q.prompt = "";
  q.explanation = "";
  q.options.forEach((o) => {
    o.label = "";
  });
  const result = await w.call("admin", "POST", "/admin/courses", input);
  assert.equal(result.status, 200);
  assert.equal(
    (
      await w.call("admin", "PUT", `/admin/courses/${result.body.course.id}`, {
        ...result.body.course,
        status: "published",
      })
    ).status,
    400,
  );
});
test("creation retries return the saved item and reject a changed payload under the same key", async (t) => {
  const w = world(t);
  const input = courseInput();
  const first = await w.call("admin", "POST", "/admin/courses", input);
  const retry = await w.call("admin", "POST", "/admin/courses", input);
  assert.equal(retry.body.course.id, first.body.course.id);
  assert.equal(w.store.list("courses").length, 1);
  assert.equal(
    (
      await w.call("admin", "POST", "/admin/courses", {
        ...input,
        title: "A changed title under the same request",
      })
    ).status,
    409,
  );
});
test("same EOD identity signs in without exposing the EOD bearer token", async (t) => {
  const w = world(t);
  const result = await w.call(null, "POST", "/login", {
    username: "candidate",
    password: "correct-password",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.candidate_id, "candidate-one");
  assert.equal(result.body.token, undefined);
  assert.match(result.headers["set-cookie"], /HttpOnly/);
  assert.match(result.headers["set-cookie"], /SameSite=Lax/);
  assert.doesNotMatch(result.headers["set-cookie"], /bbbbbbbb/);
  assert.equal(
    (
      await w.call(null, "POST", "/login", {
        username: "candidate",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await w.call(null, "POST", "/login", {
        username: "assessor",
        password: "correct-password",
      })
    ).status,
    403,
  );
});
test("role and ownership guards protect authoring and other learners", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  const enrollment = await w.enroll(course);
  assert.equal((await w.call(null, "GET", "/learn")).status, 401);
  assert.equal(
    (await w.call("candidate", "GET", "/admin/overview")).status,
    403,
  );
  assert.equal((await w.call("admin", "GET", "/learn")).status, 403);
  for (const [method, suffix, body] of [
    ["GET", "", {}],
    ["POST", "/complete", { lesson_id: "reading" }],
    ["POST", "/quiz", { lesson_id: "practice", answers: { "q-one": "a" } }],
    ["POST", "/reassessment", {}],
  ])
    assert.equal(
      (
        await w.call(
          "other",
          method,
          `/enrollments/${enrollment.id}${suffix}`,
          body,
        )
      ).status,
      404,
    );
});
test("recommendations use finalized EOD gaps; unpublished content and answer keys stay private", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  await w.makeCourse({ status: "draft", title: "Private draft course" });
  const library = await w.call("candidate", "GET", "/learn");
  assert.equal(library.body.courses.length, 1);
  assert.deepEqual(library.body.courses[0].gap_names, [
    "Governance & Security",
  ]);
  assert.doesNotMatch(JSON.stringify(library.body), /correct_option_id|SECRET/);
  const enrollment = await w.enroll(course);
  const detail = await w.call(
    "candidate",
    "GET",
    `/enrollments/${enrollment.id}`,
  );
  assert.doesNotMatch(
    JSON.stringify(detail.body),
    /correct_option_id|Least privilege grants/,
  );
  assert.ok(
    detail.body.course.curriculum[0].lessons[1].quiz.questions[0].options
      .length,
  );
});
test("enrollment is idempotent, version-frozen and survives course archival", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  const first = await w.enroll(course);
  const again = await w.enroll(course);
  assert.equal(again.id, first.id);
  assert.equal(w.store.list("enrollments").length, 1);
  const changed = courseInput({
    ...course,
    title: "A substantially updated course",
    status: "archived",
  });
  assert.equal(
    (await w.call("admin", "PUT", `/admin/courses/${course.id}`, changed))
      .status,
    200,
  );
  const detail = await w.call("candidate", "GET", `/enrollments/${first.id}`);
  assert.equal(detail.body.course.title, course.title);
  assert.equal(
    (await w.call("other", "POST", `/courses/${course.id}/enroll`)).status,
    404,
  );
  assert.equal(
    (await w.call("admin", "PUT", `/admin/courses/${course.id}`, changed))
      .status,
    409,
    "stale version cannot overwrite a later update",
  );
});
test("ordered lessons and server-scored practice protect completion", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  const enrollment = await w.enroll(course);
  const base = `/enrollments/${enrollment.id}`;
  assert.equal(
    (
      await w.call("candidate", "POST", `${base}/quiz`, {
        lesson_id: "practice",
        answers: { "q-one": "a" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await w.call("candidate", "POST", `${base}/reassessment`)).status,
    409,
  );
  const reading = await w.call("candidate", "POST", `${base}/complete`, {
    lesson_id: "reading",
  });
  assert.equal(reading.body.enrollment.progress.percent, 50);
  assert.equal(
    (
      await w.call("candidate", "POST", `${base}/complete`, {
        lesson_id: "practice",
      })
    ).status,
    409,
    "cannot mark a quiz complete without a passing attempt",
  );
  const missing = await w.call("candidate", "POST", `${base}/quiz`, {
    lesson_id: "practice",
    answers: {},
  });
  assert.equal(missing.status, 400);
  const fail = await w.call("candidate", "POST", `${base}/quiz`, {
    lesson_id: "practice",
    answers: { "q-one": "b" },
    percent: 100,
    passed: true,
  });
  assert.equal(fail.body.result.percent, 0);
  assert.equal(fail.body.enrollment.progress.complete, false);
  assert.match(fail.body.result.feedback[0].explanation, /minimum permissions/);
  const pass = await w.call("candidate", "POST", `${base}/quiz`, {
    lesson_id: "practice",
    answers: { "q-one": "a" },
  });
  assert.equal(pass.body.result.percent, 100);
  assert.equal(pass.body.enrollment.progress.complete, true);
  assert.ok(pass.body.enrollment.completed_at);
  const retake = await w.call("candidate", "POST", `${base}/quiz`, {
    lesson_id: "practice",
    answers: { "q-one": "b" },
  });
  assert.equal(
    retake.body.enrollment.progress.complete,
    true,
    "later practice does not erase completed progress",
  );
  assert.equal(
    w.store.get("enrollments", enrollment.id).quiz_attempts.practice.count,
    3,
  );
});
test("completion and audit are one transaction, including failure recovery", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  const enrollment = await w.enroll(course);
  const original = w.store.audit;
  w.store.audit = () => {
    throw new Error("injected audit failure");
  };
  assert.equal(
    (
      await w.call(
        "candidate",
        "POST",
        `/enrollments/${enrollment.id}/complete`,
        { lesson_id: "reading" },
      )
    ).status,
    500,
  );
  assert.deepEqual(w.store.get("enrollments", enrollment.id).progress, {});
  w.store.audit = original;
  assert.equal(
    (
      await w.call(
        "candidate",
        "POST",
        `/enrollments/${enrollment.id}/complete`,
        { lesson_id: "reading" },
      )
    ).status,
    200,
  );
});
test("path enrollment freezes order and enrolls all courses atomically", async (t) => {
  const w = world(t);
  const a = await w.makeCourse();
  const b = await w.makeCourse({ title: "A second useful course" });
  const created = await w.call("admin", "POST", "/admin/paths", {
    request_id: "a-path-request",
    title: "Your governance development path",
    summary:
      "Build a complete foundation, then apply your learning in practice.",
    role_id: "rsa",
    status: "published",
    course_ids: [b.id, a.id],
  });
  assert.equal(created.status, 200);
  const path = created.body.path;
  const result = await w.call("candidate", "POST", `/paths/${path.id}/enroll`);
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.path_enrollment.enrollments.map((e) => e.course_id),
    [b.id, a.id],
  );
  await w.call("candidate", "POST", `/paths/${path.id}/enroll`);
  assert.equal(w.store.list("enrollments").length, 2);
  assert.equal(w.store.list("path_enrollments").length, 1);
  const library = await w.call("candidate", "GET", "/learn");
  assert.equal(library.body.path_enrollments[0].percent, 0);
  w.eod.learningContext = async () => ({ candidate: w.fixture.candidates[0], reports: new Map() });
  w.store.update("paths", path.id, { title: "Changed path", status: "archived" });
  w.store.update("courses", b.id, { title: "Changed course", status: "archived" });
  const assignedOnly = await w.call("candidate", "GET", "/learn");
  assert.equal(assignedOnly.body.paths[0].title, path.title, "assigned paths remain discoverable without a finalized report");
  assert.deepEqual(assignedOnly.body.paths[0].courses.map((c) => c.id), [b.id, a.id]);
  assert.equal(assignedOnly.body.paths[0].courses[0].title, b.title, "library preserves the assigned course versions");
  const invalid = await w.call("admin", "POST", "/admin/paths", {
    request_id: "invalid-path",
    title: "Invalid path",
    summary: "This path must not publish duplicate courses.",
    role_id: "rsa",
    status: "published",
    course_ids: [a.id, a.id],
  });
  assert.equal(invalid.status, 400);
});
test("completed learning requests a real, retry-safe EOD reassessment", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  const e = await w.enroll(course);
  const base = `/enrollments/${e.id}`;
  await w.call("candidate", "POST", `${base}/complete`, {
    lesson_id: "reading",
  });
  await w.call("candidate", "POST", `${base}/quiz`, {
    lesson_id: "practice",
    answers: { "q-one": "a" },
  });
  await w.call("candidate", "POST", `${base}/reassessment`);
  await w.call("candidate", "POST", `${base}/reassessment`);
  assert.equal(w.store.list("requests").length, 1);
  const allocated = await w.call(
    "admin",
    "POST",
    `/admin/requests/${e.id}/allocate`,
  );
  assert.equal(allocated.status, 200);
  const again = await w.call(
    "admin",
    "POST",
    `/admin/requests/${e.id}/allocate`,
  );
  assert.equal(again.body.assessment_id, allocated.body.assessment_id);
  assert.equal(w.fixture.allocations.size, 1);
  assert.equal(
    w.fixture.calls.filter((c) => c.path === "/admin/assessments").length,
    1,
  );
});
test("live EOD deactivation revokes LMS access and clears its cookie", async (t) => {
  const w = world(t);
  w.fixture.users["b".repeat(64)].active = false;
  const result = await w.call("candidate", "GET", "/learn");
  assert.equal(result.status, 401);
  assert.match(result.headers["set-cookie"], /Max-Age=0/);
});
test("a lost EOD allocation response retries the same persisted request without another paper", async (t) => {
  const w = world(t);
  const course = await w.makeCourse();
  const e = await w.enroll(course);
  await w.call("candidate", "POST", `/enrollments/${e.id}/complete`, {
    lesson_id: "reading",
  });
  await w.call("candidate", "POST", `/enrollments/${e.id}/quiz`, {
    lesson_id: "practice",
    answers: { "q-one": "a" },
  });
  await w.call("candidate", "POST", `/enrollments/${e.id}/reassessment`);
  const original = w.eod.call;
  let loseResponse = true;
  w.eod.call = async (route, options) => {
    const result = await original(route, options);
    if (route === "/admin/assessments" && loseResponse) {
      loseResponse = false;
      throw new HttpError(503, "Injected lost allocation response");
    }
    return result;
  };
  assert.equal(
    (await w.call("admin", "POST", `/admin/requests/${e.id}/allocate`)).status,
    503,
  );
  assert.ok(w.store.get("requests", e.id).allocation_body);
  assert.equal(
    (await w.call("admin", "POST", `/admin/requests/${e.id}/allocate`)).status,
    200,
  );
  assert.equal(w.fixture.allocations.size, 1);
  const attempts = w.fixture.calls.filter(
    (c) => c.path === "/admin/assessments",
  );
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0].body, attempts[1].body);
});
