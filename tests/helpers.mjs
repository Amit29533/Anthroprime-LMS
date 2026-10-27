import { randomUUID } from "node:crypto";
import { createStore } from "../src/store.mjs";
import { createSessions } from "../src/session.mjs";
import { createEodClient } from "../src/integrations/eod.mjs";
import { createApp } from "../src/app.mjs";

export const tokens = {
  admin: "a".repeat(64),
  candidate: "b".repeat(64),
  other: "c".repeat(64),
  assessor: "d".repeat(64),
};
export function eodFixture() {
  const users = {
    [tokens.admin]: {
      id: "admin",
      name: "Learning Admin",
      role: "admin",
      active: true,
    },
    [tokens.candidate]: {
      id: "user-one",
      name: "Rohit Verma",
      candidate_id: "candidate-one",
      role: "candidate",
      active: true,
    },
    [tokens.other]: {
      id: "user-two",
      name: "Priya Student",
      candidate_id: "candidate-two",
      role: "candidate",
      active: true,
    },
    [tokens.assessor]: {
      id: "assessor",
      name: "Assessor",
      role: "assessor",
      active: true,
    },
  };
  const track = {
    id: "rsa",
    key: "databricks-rsa",
    name: "Resident Solutions Architect",
    default_question_count: 50,
    question_count: 348,
  };
  const candidates = [
    {
      id: "candidate-one",
      name: "Rohit Verma",
      target_role_id: "rsa",
      assessor_id: "assessor",
    },
    { id: "candidate-two", name: "Priya Student", target_role_id: "rsa" },
  ];
  const calls = [];
  const allocations = new Map();
  const fetcher = async (url, opts = {}) => {
    const path = new URL(url).pathname.replace(/^\/api/, "");
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : {};
    const token = opts.headers?.authorization?.replace(/^Bearer /, "");
    calls.push({ path, method, body });
    const result = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (path === "/auth/login") {
      const selected = tokens[body.username];
      if (!selected || body.password !== "correct-password")
        return result({ error: "Invalid username or password." }, 401);
      return result({
        token: selected,
        user: users[selected],
        candidate:
          candidates.find((c) => c.id === users[selected].candidate_id) || null,
      });
    }
    const user = users[token];
    if (!user || user.active === false)
      return result({ error: "Sign in required." }, 401);
    if (path === "/auth/me")
      return result({
        user,
        candidate: candidates.find((c) => c.id === user.candidate_id) || null,
      });
    if (path === "/auth/logout") return result({ ok: true });
    if (path.startsWith("/admin/") && user.role !== "admin")
      return result({ error: "Forbidden." }, 403);
    if (path === "/admin/roles") return result({ roles: [track] });
    if (path === "/admin/roles/rsa")
      return result({
        role: track,
        competencies: [
          {
            id: "governance",
            key: "governance-security",
            name: "Governance & Security",
          },
        ],
        questions: [{ correct_option_ids: ["SECRET"] }],
      });
    if (path === "/admin/candidates")
      return result({ candidates, total: candidates.length });
    if (path === "/admin/assessments" && method === "POST") {
      if (!allocations.has(body.request_id))
        allocations.set(body.request_id, {
          id: `assessment-${allocations.size + 1}`,
        });
      return result(allocations.get(body.request_id));
    }
    if (path === "/candidate/assessments")
      return result({
        candidate: candidates.find((c) => c.id === user.candidate_id),
        assessments: [
          {
            id: "baseline",
            status: "scored",
            scored_at: "2026-10-10T00:00:00Z",
            overall_pct: 48,
          },
        ],
      });
    if (path === "/candidate/reports/baseline")
      return result({
        report: {
          role: track,
          overall_pct: 48,
          areas_to_improve: [
            {
              competency_id: "governance",
              competency: "Governance & Security",
              gap: 2,
              weight: 20,
              severity: "critical_gap",
            },
          ],
        },
      });
    return result({ error: "Not found." }, 404);
  };
  return { fetcher, users, calls, allocations, candidates, track };
}
export function courseInput(overrides = {}) {
  return {
    request_id: randomUUID(),
    title: "Governance in practice",
    summary: "Build clear ownership, proportionate access and useful evidence.",
    role_id: "rsa",
    level: "foundation",
    status: "published",
    competency_ids: ["governance"],
    outcomes: ["Explain least privilege in a practical scenario."],
    curriculum: [
      {
        id: "module-one",
        title: "Understand and apply",
        lessons: [
          {
            id: "reading",
            title: "Start with ownership",
            kind: "article",
            minutes: 6,
            body: "Start with a named owner. Give each person only the access needed for their task and keep useful evidence of changes.",
            resource_url: "",
          },
          {
            id: "practice",
            title: "Try a short scenario",
            kind: "quiz",
            minutes: 3,
            body: "",
            resource_url: "",
            quiz: {
              pass_percent: 70,
              questions: [
                {
                  id: "q-one",
                  prompt: "Which access policy best follows least privilege?",
                  options: [
                    {
                      id: "a",
                      label:
                        "Grant only the permissions required for the task.",
                    },
                    {
                      id: "b",
                      label: "Grant all permissions to avoid support requests.",
                    },
                  ],
                  correct_option_id: "a",
                  explanation:
                    "Least privilege grants the minimum permissions required for the intended task.",
                },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}
export function world(t) {
  const fixture = eodFixture();
  const eod = createEodClient({
    apiUrl: "https://assessment.example/api",
    fetcher: fixture.fetcher,
  });
  const store = createStore(":memory:", eod.instance);
  const sessions = createSessions({ key: "1".repeat(64) });
  const app = createApp({ store, sessions, eod });
  t.after(() => store.close());
  const call = (role, method, path, body = {}) =>
    app({
      method,
      path,
      body,
      headers: {
        cookie: role ? sessions.issue(tokens[role]).split(";")[0] : "",
      },
    });
  const makeCourse = async (overrides) => {
    const result = await call(
      "admin",
      "POST",
      "/admin/courses",
      courseInput(overrides),
    );
    if (result.status !== 200) throw new Error(JSON.stringify(result));
    return result.body.course;
  };
  const enroll = async (course) => {
    const result = await call(
      "candidate",
      "POST",
      `/courses/${course.id}/enroll`,
    );
    if (result.status !== 200) throw new Error(JSON.stringify(result));
    return result.body.enrollment;
  };
  return { fixture, eod, store, sessions, app, call, makeCourse, enroll };
}
