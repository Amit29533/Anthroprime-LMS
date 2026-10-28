/**
 * Publish the RSA course to a hosted LMS (for example on Netlify) through its
 * admin API. Safe to re-run: the same content is recognised and left as is.
 * Does not invite or assign anyone.
 *
 *   LMS_URL=https://learning.example.com EOD_API_URL=https://ecod.example.com/api \
 *   ECOD_ADMIN_USERNAME=admin ECOD_ADMIN_PASSWORD=... npm run publish:rsa
 */
import { createEodClient } from "../src/integrations/eod.mjs";
import { validateCourse } from "../src/domain/learning.mjs";
import { rsaCourse } from "../content/rsa-course.mjs";

const lmsUrl = new URL(process.env.LMS_URL || "");
if (lmsUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(lmsUrl.hostname))
  throw new Error("Set LMS_URL to the hosted LMS address (HTTPS).");
const username = process.env.ECOD_ADMIN_USERNAME || "admin";
const password = process.env.ECOD_ADMIN_PASSWORD;
if (!password) throw new Error("Set ECOD_ADMIN_PASSWORD to an ECOD administrator password.");

const eod = createEodClient({ apiUrl: process.env.EOD_API_URL, webUrl: process.env.EOD_WEB_URL });
const lms = async (path, { method = "GET", body, cookie = "" } = {}) => {
  const response = await fetch(new URL(`/api${path}`, lmsUrl), {
    method,
    headers: { origin: lmsUrl.origin, "x-lms-request": "1", "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`LMS ${path}: ${response.status} ${data.error || ""}`.trim());
  return { data, cookie: (response.headers.get("set-cookie") || "").split(";")[0] };
};

const login = await eod.call("/auth/login", { method: "POST", body: { username, password } });
try {
  if (login.user?.role !== "admin") throw new Error("An ECOD administrator is required.");
  const track = (await eod.tracks(login.token)).find((t) => t.key === "databricks-rsa");
  if (!track) throw new Error("The ECOD RSA track (databricks-rsa) is missing.");
  const competencies = await eod.competencies(login.token, track.id);
  const course = { ...rsaCourse(track.id, competencies.map((c) => c.id)), request_id: "rsa-enterprise-readiness-v1" };
  const problem = validateCourse(course);
  if (problem) throw new Error(problem);
  const session = await lms("/login", { method: "POST", body: { username, password } });
  try {
    const saved = await lms("/admin/courses", { method: "POST", body: course, cookie: session.cookie });
    console.log(saved.data.already
      ? "RSA course is already published with this content."
      : "RSA course published: 12 modules, 48 lessons, 144 MCQs. No candidates invited or assigned.");
  } finally {
    await lms("/logout", { method: "POST", cookie: session.cookie }).catch(() => {});
  }
} finally {
  await eod.call("/auth/logout", { token: login.token, method: "POST" }).catch(() => {});
}
