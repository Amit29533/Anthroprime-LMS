import { randomUUID, createHash } from "node:crypto";
import { HttpError } from "./integrations/eod.mjs";
import { requireInvitation, registerTrainingRoutes, trainingProgress } from "./domain/training.mjs";
import {
  validateCourse,
  courseFields,
  courseSummary,
  lessonsIn,
  learningProgress,
  recommendCourse,
  learnerCourse,
  gradePractice,
} from "./domain/learning.mjs";

const fail = (status, message) => {
  throw new HttpError(status, message);
};
const identity = (instance, id) =>
  createHash("sha256").update(`${instance}:${id}`).digest("hex");
const summary = (row) => ({
  id: row.id,
  course_id: row.course_id,
  course: courseSummary(row.course_snapshot),
  progress: learningProgress(row),
  completed_at: row.completed_at,
  reassessment_id: row.reassessment_id || "",
  learner_id: row.learner_id,
  learner_name: row.learner_name,
  baseline_overall_pct: row.baseline_overall_pct,
});
const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,150}$/.test(id);
export function createApp({ store, eod, sessions }) {
  const routes = [];
  const route = (method, pattern, role, handler) => {
    const keys = [];
    const regex = new RegExp(
      `^${pattern.replace(/:([a-z_]+)/g, (_, key) => {
        keys.push(key);
        return "([a-zA-Z0-9_-]+)";
      })}$`,
    );
    routes.push({ method, regex, keys, role, handler });
  };
  const context = (auth) => eod.learningContext(auth.token);
  const learnerId = (candidateId) => identity(eod.instance, candidateId);
  const own = (auth, id) => {
    const row = store.get("enrollments", id);
    if (!row || row.learner_id !== learnerId(auth.user.candidate_id))
      fail(404, "Learning assignment not found.");
    return row;
  };
  const pathSummary = (row) => {
    const enrollments = row.enrollment_ids
      .map((id) => store.get("enrollments", id))
      .filter(Boolean);
    const total = enrollments.reduce(
      (sum, e) => sum + learningProgress(e).total,
      0,
    );
    const completed = enrollments.reduce(
      (sum, e) => sum + learningProgress(e).completed,
      0,
    );
    return {
      id: row.id,
      path: row.path_snapshot,
      enrollments: enrollments.map(summary),
      percent: total ? Math.round((completed / total) * 100) : 0,
      completed_courses: enrollments.filter((e) => learningProgress(e).complete)
        .length,
    };
  };
  // Caller owns the transaction; course enrollment and its audit event commit together.
  const enroll = (course, candidate, actor, baseline) => {
    const lid = learnerId(candidate.id);
    const id = identity(lid, course.id);
    const existing = store.get("enrollments", id);
    if (existing) return existing;
    const row = store.insert("enrollments", {
      id,
      learner_id: lid,
      candidate_id: candidate.id,
      learner_name: candidate.name,
      course_id: course.id,
      course_snapshot: course,
      progress: {},
      completed_at: "",
      baseline_assessment_id: baseline?.id || "",
      baseline_overall_pct: baseline?.overall_pct ?? null,
    });
    store.audit(actor, "course_enrolled", id, {
      course: course.title,
      candidate_id: candidate.id,
    });
    return row;
  };
  const enrollPath = (path, candidate, actor, reports = new Map()) => {
    const id = identity(learnerId(candidate.id), path.id);
    const previous = store.get("path_enrollments", id);
    if (previous) return previous;
    const courses = path.course_ids.map((cid) => store.get("courses", cid));
    if (courses.some((c) => !c || c.status !== "published"))
      fail(
        409,
        "A course in this path is unavailable. Ask the learning administrator to update the path.",
      );
    const enrollments = courses.map((course) =>
      enroll(course, candidate, actor, reports.get(course.role_id)),
    );
    const row = store.insert("path_enrollments", {
      id,
      learner_id: learnerId(candidate.id),
      path_id: path.id,
      path_snapshot: path,
      enrollment_ids: enrollments.map((e) => e.id),
    });
    store.audit(actor, "path_enrolled", id, {
      path: path.title,
      candidate_id: candidate.id,
    });
    return row;
  };
  const requestFor = (row) => {
    const r = store.get("requests", row.id);
    return r
      ? {
          id: r.id,
          status: r.status,
          assessment_id: r.assessment_id || "",
          created_at: r.created_at,
        }
      : null;
  };
  route("GET", "/session", "public", async ({ token }) => {
    if (!token) return { user: null, eod_web_url: eod.webUrl };
    const me = await eod.call("/auth/me", { token });
    requireInvitation(store, me);
    return { user: me.user, candidate: me.candidate, eod_web_url: eod.webUrl };
  });
  route("POST", "/login", "public", async ({ body }) => {
    if (
      typeof body.username !== "string" ||
      body.username.length > 200 ||
      !body.username.trim() ||
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 200 ||
      (body.otp !== undefined &&
        (typeof body.otp !== "string" || body.otp.length > 100))
    )
      fail(400, "Enter your EOD username and password.");
    const result = await eod.call("/auth/login", {
      method: "POST",
      body: { username: body.username, password: body.password, otp: body.otp },
    });
    if (!result.user || !["admin", "candidate"].includes(result.user.role)) {
      if (result.token)
        await eod
          .call("/auth/logout", { token: result.token, method: "POST" })
          .catch(() => {});
      fail(403, "This release supports candidate and administrator accounts.");
    }
    if (
      typeof result.token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(result.token)
    )
      fail(502, "The assessment platform returned an invalid session.");
    try { requireInvitation(store, result); }
    catch (err) {
      await eod.call("/auth/logout", { token: result.token, method: "POST" }).catch(() => {});
      throw err;
    }
    return {
      _cookie: sessions.issue(result.token),
      user: result.user,
      candidate: result.candidate,
    };
  });
  route("POST", "/logout", "public", async ({ token }) => {
    if (token)
      await eod.call("/auth/logout", { token, method: "POST" }).catch(() => {});
    return { _cookie: sessions.clear(), ok: true };
  });
  route("GET", "/learn", "candidate", async ({ auth }) => {
    const ctx = await context(auth);
    const roleIds = new Set(ctx.reports.keys());
    const enrollments = store.list("enrollments", {
      learner_id: learnerId(auth.user.candidate_id),
    });
    const available = store
      .list("courses")
      .filter((c) => c.status === "published" && roleIds.has(c.role_id));
    // Assigned learning remains discoverable before a finalized baseline and
    // keeps its original title/content version after publication or archival.
    const courseMap = new Map(available.map((c) => [c.id, c]));
    for (const row of enrollments) courseMap.set(row.course_id, row.course_snapshot);
    const courses = [...courseMap.values()];
    const paths = store
      .list("paths")
      .filter((p) => p.status === "published" && roleIds.has(p.role_id))
      .map((p) => ({
        ...p,
        courses: p.course_ids
          .map((id) => store.get("courses", id))
          .filter(Boolean)
          .map(courseSummary),
      }));
    const pathEnrollments = store.list("path_enrollments", { learner_id: learnerId(auth.user.candidate_id) });
    const pathMap = new Map(paths.map((path) => [path.id, path]));
    for (const row of pathEnrollments) pathMap.set(row.path_id, {
      ...row.path_snapshot,
      courses: row.enrollment_ids.map((id) => store.get("enrollments", id))
        .filter(Boolean).map((e) => courseSummary(e.course_snapshot)),
    });
    return {
      name: ctx.candidate.name,
      has_report: ctx.reports.size > 0,
      courses: courses
        .map((c) => ({
          ...courseSummary(c),
          ...recommendCourse(c, ctx.reports),
        }))
        .sort((a, b) => b.priority - a.priority),
      enrollments: enrollments.map((e) => ({
        ...summary(e),
        request: requestFor(e),
      })),
      paths: [...pathMap.values()],
      path_enrollments: pathEnrollments.map(pathSummary),
      reports: [...ctx.reports.values()].map((a) => ({
        id: a.id,
        role_name: a.role_name,
        overall_pct: a.overall_pct,
        gaps: a.report_json.areas_to_improve.map((g) => ({
          name: g.competency,
          severity: g.severity,
          gap: g.gap,
        })),
      })),
      eod_web_url: eod.webUrl,
    };
  });
  route(
    "POST",
    "/courses/:id/enroll",
    "candidate",
    async ({ auth, params }) => {
      const ctx = await context(auth);
      const course = store.get("courses", params.id);
      if (
        !course ||
        course.status !== "published" ||
        !ctx.reports.has(course.role_id)
      )
        fail(404, "Course not found for your assessment track.");
      return {
        enrollment: summary(
          store.transaction(() =>
            enroll(
              course,
              ctx.candidate,
              auth.user,
              ctx.reports.get(course.role_id),
            ),
          ),
        ),
      };
    },
  );
  route("POST", "/paths/:id/enroll", "candidate", async ({ auth, params }) => {
    const ctx = await context(auth);
    const path = store.get("paths", params.id);
    if (!path || path.status !== "published" || !ctx.reports.has(path.role_id))
      fail(404, "Learning path not found for your assessment track.");
    return {
      path_enrollment: pathSummary(
        store.transaction(() =>
          enrollPath(path, ctx.candidate, auth.user, ctx.reports),
        ),
      ),
    };
  });
  route("GET", "/enrollments/:id", "candidate", async ({ auth, params }) => {
    const row = own(auth, params.id);
    return {
      enrollment: summary(row),
      course: learnerCourse(row.course_snapshot),
      training: trainingProgress(row),
      completed_lessons: Object.keys(row.progress || {}),
      request: requestFor(row),
      eod_web_url: eod.webUrl,
    };
  });
  route(
    "POST",
    "/enrollments/:id/complete",
    "candidate",
    async ({ auth, params, body }) =>
      store.transaction(() => {
        const row = own(auth, params.id);
        const lessons = lessonsIn(row.course_snapshot);
        const index = lessons.findIndex(
          (lesson) => lesson.id === body.lesson_id,
        );
        if (index < 0) fail(400, "Choose a lesson from your assigned course.");
        if (lessons[index].quiz)
          fail(409, "Submit the practice quiz to complete this lesson.");
        if (lessons.slice(0, index).some((lesson) => !row.progress[lesson.id]))
          fail(409, "Complete the earlier lessons first.");
        let updated = row;
        if (!row.progress[body.lesson_id]) {
          const progress = {
            ...row.progress,
            [body.lesson_id]: { completed_at: new Date().toISOString() },
          };
          updated = store.update("enrollments", row.id, {
            progress,
            completed_at: learningProgress({ ...row, progress }).complete
              ? new Date().toISOString()
              : "",
          });
          store.audit(auth.user, "lesson_completed", row.id, {
            lesson_id: body.lesson_id,
          });
        }
        return {
          enrollment: summary(updated),
          completed_lessons: Object.keys(updated.progress),
          training: trainingProgress(updated),
        };
      }),
  );
  route(
    "POST",
    "/enrollments/:id/quiz",
    "candidate",
    async ({ auth, params, body }) =>
      store.transaction(() => {
        const row = own(auth, params.id);
        const lessons = lessonsIn(row.course_snapshot);
        const index = lessons.findIndex(
          (lesson) => lesson.id === body.lesson_id && lesson.quiz,
        );
        if (index < 0)
          fail(400, "Choose a practice quiz from your assigned course.");
        if (lessons.slice(0, index).some((lesson) => !row.progress[lesson.id]))
          fail(409, "Complete the earlier lessons first.");
        const result = gradePractice(lessons[index].quiz, body.answers);
        if (result.error) fail(400, result.error);
        const at = new Date().toISOString();
        const prior = row.quiz_attempts?.[body.lesson_id];
        const quiz_attempts = {
          ...(row.quiz_attempts || {}),
          [body.lesson_id]: {
            count: (prior?.count || 0) + 1,
            percent: result.percent,
            first_percent: prior?.count ? prior.first_percent ?? null : result.percent,
            best_percent: Math.max(prior?.best_percent ?? prior?.percent ?? 0, result.percent),
            passed: result.passed,
            submitted_at: at,
          },
        };
        const progress = { ...row.progress };
        if (result.passed && !progress[body.lesson_id])
          progress[body.lesson_id] = { completed_at: at };
        const updated = store.update("enrollments", row.id, {
          quiz_attempts,
          progress,
          completed_at:
            row.completed_at ||
            (learningProgress({ ...row, progress }).complete ? at : ""),
        });
        store.audit(auth.user, "practice_submitted", row.id, {
          lesson_id: body.lesson_id,
          percent: result.percent,
          passed: result.passed,
        });
        return {
          result,
          enrollment: summary(updated),
          completed_lessons: Object.keys(progress),
          training: trainingProgress(updated),
        };
      }),
  );
  route(
    "POST",
    "/enrollments/:id/reassessment",
    "candidate",
    async ({ auth, params }) =>
      store.transaction(() => {
        const row = own(auth, params.id);
        if (!learningProgress(row).complete)
          fail(409, "Complete your course before requesting reassessment.");
        if (!store.get("requests", row.id)) {
          store.insert("requests", {
            id: row.id,
            learner_id: row.learner_id,
            candidate_id: row.candidate_id,
            learner_name: row.learner_name,
            role_id: row.course_snapshot.role_id,
            course_title: row.course_snapshot.title,
            status: "requested",
          });
          store.audit(auth.user, "reassessment_requested", row.id);
        }
        return { request: requestFor(row) };
      }),
  );
  route("GET", "/admin/overview", "admin", async ({ auth }) => {
    const [tracks, candidates, users] = await Promise.all([
      eod.tracks(auth.token),
      eod.all("/admin/candidates", "candidates", auth.token),
      eod.all("/admin/users", "users", auth.token),
    ]);
    const eligible = (candidate) => {
      const accounts = users.filter((u) => u.role === "candidate" && u.active !== false && u.candidate_id === candidate.id);
      if (accounts.length !== 1) return false;
      try { requireInvitation(store, { user: accounts[0], candidate }, { claim: false }); return true; }
      catch (error) { if (error.status === 403) return false; throw error; }
    };
    return {
      courses: store.list("courses").map(courseSummary),
      paths: store.list("paths"),
      enrollments: store.list("enrollments").map(summary),
      requests: store.list("requests").map(({ allocation_body, ...r }) => r),
      tracks,
      candidates: candidates
        .filter((c) => !c.deleting)
        .map((c) => ({
          id: c.id,
          name: c.name,
          target_role_id: c.target_role_id,
          training_access: eligible(c),
        })),
      audit: store.list("audit").slice(0, 30),
      eod_web_url: eod.webUrl,
    };
  });
  route("GET", "/admin/tracks/:id", "admin", async ({ auth, params }) => ({
    competencies: await eod.competencies(auth.token, params.id),
  }));
  route("GET", "/admin/courses/:id", "admin", async ({ params }) => {
    const course = store.get("courses", params.id);
    if (!course) fail(404, "Course not found.");
    return { course };
  });
  for (const method of ["POST", "PUT"])
    route(
      method,
      method === "POST" ? "/admin/courses" : "/admin/courses/:id",
      "admin",
      async ({ auth, body, params }) => {
        const problem = validateCourse(body);
        if (problem) fail(400, problem);
        const tracks = await eod.tracks(auth.token);
        const track = tracks.find((r) => r.id === body.role_id);
        if (!track) fail(400, "Choose an active EOD assessment track.");
        const competencies = await eod.competencies(auth.token, track.id);
        if (
          body.competency_ids.some(
            (id) => !competencies.some((c) => c.id === id),
          )
        )
          fail(400, "Choose competencies from this assessment track.");
        if (method === "POST" && !validId(body.request_id))
          fail(400, "A creation request identifier is required.");
        return store.transaction(() => {
          const id = params.id || identity(auth.user.id, body.request_id);
          const existing = store.get("courses", id);
          if (method === "POST" && existing) {
            if (
              JSON.stringify(courseFields(existing)) !==
              JSON.stringify(courseFields(body))
            )
              fail(
                409,
                "This creation request already saved different content. Reload the saved course before editing it.",
              );
            return { course: existing, already: true };
          }
          if (method === "PUT" && !existing) fail(404, "Course not found.");
          if (method === "PUT" && existing.version !== body.version)
            fail(
              409,
              "This course changed in another session. Reload before saving.",
            );
          const data = {
            ...courseFields(body),
            role_name: track.name,
            version: randomUUID(),
            published_at:
              existing?.published_at ||
              (body.status === "published" ? new Date().toISOString() : ""),
          };
          const course = existing
            ? store.update("courses", id, data)
            : store.insert("courses", { id, ...data });
          store.audit(
            auth.user,
            method === "POST" ? "course_created" : "course_updated",
            id,
            { title: course.title, status: course.status },
          );
          return { course };
        });
      },
    );
  for (const method of ["POST", "PUT"])
    route(
      method,
      method === "POST" ? "/admin/paths" : "/admin/paths/:id",
      "admin",
      async ({ auth, body, params }) => {
        if (
          typeof body.title !== "string" ||
          body.title.trim().length < 3 ||
          body.title.length > 160 ||
          typeof body.summary !== "string" ||
          body.summary.trim().length < 10 ||
          body.summary.length > 600 ||
          !["draft", "published", "archived"].includes(body.status) ||
          !Array.isArray(body.course_ids) ||
          !body.course_ids.length ||
          body.course_ids.length > 20 ||
          new Set(body.course_ids).size !== body.course_ids.length ||
          body.course_ids.some((id) => !validId(id))
        )
          fail(400, "Add a title, summary, status and 1–20 different courses.");
        const tracks = await eod.tracks(auth.token);
        if (!tracks.some((t) => t.id === body.role_id))
          fail(400, "Choose an active assessment track.");
        if (method === "POST" && !validId(body.request_id))
          fail(400, "A creation request identifier is required.");
        return store.transaction(() => {
          const courses = body.course_ids.map((id) => store.get("courses", id));
          if (
            courses.some(
              (c) =>
                !c ||
                c.role_id !== body.role_id ||
                (body.status === "published" && c.status !== "published"),
            )
          )
            fail(
              400,
              "Path courses must share the track and be published before the path is published.",
            );
          const id = params.id || identity(auth.user.id, body.request_id);
          const previous = store.get("paths", id);
          if (method === "POST" && previous) {
            if (
              previous.title !== body.title.trim() ||
              previous.summary !== body.summary.trim() ||
              previous.role_id !== body.role_id ||
              previous.status !== body.status ||
              JSON.stringify(previous.course_ids) !==
                JSON.stringify(body.course_ids)
            )
              fail(
                409,
                "This creation request already saved a different path. Reload it before editing.",
              );
            return { path: previous, already: true };
          }
          if (method === "PUT" && !previous)
            fail(404, "Learning path not found.");
          if (method === "PUT" && previous.version !== body.version)
            fail(
              409,
              "This path changed in another session. Reload before saving.",
            );
          const data = {
            title: body.title.trim(),
            summary: body.summary.trim(),
            role_id: body.role_id,
            course_ids: body.course_ids,
            status: body.status,
            version: randomUUID(),
          };
          const path = previous
            ? store.update("paths", id, data)
            : store.insert("paths", { id, ...data });
          store.audit(auth.user, "path_saved", id, { title: path.title });
          return { path };
        });
      },
    );
  route("POST", "/admin/assign", "admin", async ({ auth, body }) => {
    if (
      !validId(body.candidate_id) ||
      !validId(body.id) ||
      !["course", "path"].includes(body.kind)
    )
      fail(400, "Choose a candidate and published learning content.");
    const candidates = await eod.all(
      "/admin/candidates",
      "candidates",
      auth.token,
    );
    const candidate = candidates.find(
      (c) => c.id === body.candidate_id && !c.deleting,
    );
    if (!candidate) fail(404, "Candidate not found.");
    const accounts = (await eod.all("/admin/users", "users", auth.token))
      .filter((u) => u.role === "candidate" && u.active !== false && u.candidate_id === candidate.id);
    if (accounts.length !== 1) fail(409, "Training assignment needs exactly one active ECOD candidate account.");
    requireInvitation(store, { user: accounts[0], candidate }, { claim: false });
    const item = store.get(
      body.kind === "course" ? "courses" : "paths",
      body.id,
    );
    if (!item || item.status !== "published")
      fail(400, "Publish this learning content before assigning it.");
    return store.transaction(() =>
      body.kind === "course"
        ? { enrollment: summary(enroll(item, candidate, auth.user, null)) }
        : {
            path_enrollment: pathSummary(
              enrollPath(item, candidate, auth.user),
            ),
          },
    );
  });
  route(
    "POST",
    "/admin/requests/:id/allocate",
    "admin",
    async ({ auth, params }) => {
      let request = store.get("requests", params.id);
      if (!request) fail(404, "Reassessment request not found.");
      if (request.assessment_id)
        return { assessment_id: request.assessment_id, already: true };
      if (!request.allocation_body) {
        const [tracks, candidates] = await Promise.all([
          eod.tracks(auth.token),
          eod.all("/admin/candidates", "candidates", auth.token),
        ]);
        const track = tracks.find((r) => r.id === request.role_id);
        const candidate = candidates.find(
          (c) => c.id === request.candidate_id && !c.deleting,
        );
        if (!track || !candidate)
          fail(409, "The assessment track or candidate is unavailable.");
        request = store.transaction(() => {
          const current = store.get("requests", params.id);
          if (current.allocation_body) return current;
          return store.update("requests", params.id, {
            allocation_body: {
              candidate_id: candidate.id,
              role_id: track.id,
              assessor_id: candidate.assessor_id || track.assessor_id || null,
              question_count: Math.min(
                track.question_count || 50,
                track.bank_count || 50,
              ),
              request_id: identity("lms-reassessment", request.id),
            },
          });
        });
      }
      // A deterministic EOD request_id makes a lost response safe to retry.
      const assessment = await eod.call("/admin/assessments", {
        token: auth.token,
        method: "POST",
        body: request.allocation_body,
      });
      if (!validId(assessment.id))
        fail(
          502,
          "The assessment platform did not return an assessment identifier. Retry this request.",
        );
      return store.transaction(() => {
        store.update("requests", request.id, {
          status: "allocated",
          assessment_id: assessment.id,
        });
        store.update("enrollments", request.id, {
          reassessment_id: assessment.id,
        });
        store.audit(auth.user, "reassessment_allocated", request.id, {
          assessment_id: assessment.id,
        });
        return { assessment_id: assessment.id };
      });
    },
  );
  registerTrainingRoutes({ route, store, eod, summary });
  // ECOD forwards the current administrator's token only to this bounded API.
  for (const assignmentRoute of ["/integration/training/assign", "/admin/training/assign"]) route("POST", assignmentRoute, "admin", async ({ auth, body }) => {
    const result = await appRequest({ method: "POST", path: "/admin/assign", headers: { cookie: sessions.issue(auth.token).split(";")[0] }, body });
    if (result.status !== 200) fail(result.status, result.body.error);
    return result.body;
  });
  const appRequest = async ({ method, path, headers = {}, body = {} }) => {
    try {
      if (typeof body !== "object" || body === null || Array.isArray(body))
        fail(400, "Send a JSON object.");
      const matched = routes.find(
        (r) => r.method === method && r.regex.test(path),
      );
      if (!matched) fail(404, "This page or action was not found.");
      const captures = path.match(matched.regex);
      const params = Object.fromEntries(
        matched.keys.map((key, i) => [key, captures[i + 1]]),
      );
      const token = path.startsWith("/integration/training")
        ? /^Bearer ([a-f0-9]{64})$/i.exec(headers.authorization || "")?.[1]
        : sessions.read(headers.cookie);
      let auth = null;
      if (matched.role !== "public") {
        if (!token) fail(401, "Sign in with your EOD account to continue.");
        const me = await eod.call("/auth/me", { token });
        if (!me.user || me.user.active === false)
          fail(401, "Your account is unavailable.");
        if (me.user.role !== matched.role)
          fail(403, "This account does not have access to this workspace.");
        if (matched.role === "candidate" && !me.user.candidate_id)
          fail(409, "Your account needs a linked candidate profile.");
        requireInvitation(store, me);
        auth = { token, user: me.user };
      }
      const result = await matched.handler({ auth, token, body, params });
      const { _cookie, ...response } = result;
      return {
        status: 200,
        body: response,
        headers: _cookie ? { "set-cookie": _cookie } : {},
      };
    } catch (err) {
      if (!err.status)
        console.error("[lms]", err.code || err.name, err.message);
      return {
        status: err.status || 500,
        body: {
          ...(path === "/session" ? { eod_web_url: eod.webUrl } : {}),
          ...(err.code === "TRAINING_INVITE_REQUIRED" ? { code: err.code } : {}),
          error: err.status
            ? err.message
            : "Your change could not be saved. Please retry.",
        },
        headers: err.status === 401 || err.code === "TRAINING_INVITE_REQUIRED" ? { "set-cookie": sessions.clear() } : {},
      };
    }
  };
  return appRequest;
}
