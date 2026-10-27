/** Import the supplied RSA course into a local LMS only. Does not invite or assign anyone. */
import { createEodClient } from "../src/integrations/eod.mjs";
import { createStore } from "../src/store.mjs";
import { validateCourse, courseFields } from "../src/domain/learning.mjs";
import { rsaCourse } from "../content/rsa-course.mjs";

if (process.env.NODE_ENV === "production") throw new Error("RSA local import cannot run in production.");
const eod = createEodClient({ apiUrl: process.env.EOD_API_URL, webUrl: process.env.EOD_WEB_URL });
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(eod.instance).hostname)) throw new Error("A loopback ECOD fixture is required.");
if (!process.env.LOCAL_ECOD_PASSWORD) throw new Error("Set LOCAL_ECOD_PASSWORD to the local ECOD administrator password.");
const login = await eod.call("/auth/login", { method: "POST", body: { username: process.env.LOCAL_ECOD_USERNAME || "admin", password: process.env.LOCAL_ECOD_PASSWORD } });
let store;
try {
  if (login.user.role !== "admin") throw new Error("An ECOD administrator is required.");
  const track = (await eod.tracks(login.token)).find((t) => t.key === "databricks-rsa");
  if (!track) throw new Error("The local ECOD RSA track is missing.");
  const competencies = await eod.competencies(login.token, track.id);
  const input = rsaCourse(track.id, competencies.map((c) => c.id));
  const problem = validateCourse(input);
  if (problem) throw new Error(problem);
  store = createStore(process.env.LMS_DATABASE || "data/lms-preview.sqlite", eod.instance);
  const id = "rsa-enterprise-readiness-v1";
  const previous = store.get("courses", id);
  const fields = courseFields(input);
  if (previous && JSON.stringify(courseFields(previous)) === JSON.stringify(fields)) console.log("RSA content is already current; progress and invitations are unchanged.");
  else store.transaction(() => {
    const record = { ...fields, version: (previous?.version || 0) + 1, published_at: new Date().toISOString() };
    if (previous) store.update("courses", id, record);
    else store.insert("courses", { id, ...record });
    store.audit(login.user, "rsa_course_imported", id, { modules: 12, lessons: 48, questions: 144 });
    console.log("RSA course ready locally: 12 modules, 48 lessons, 144 MCQs. No candidates invited or assigned.");
  });
} finally {
  store?.close();
  await eod.call("/auth/logout", { token: login.token, method: "POST" }).catch(() => {});
}
