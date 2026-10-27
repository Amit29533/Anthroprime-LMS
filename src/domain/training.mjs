import { createHash } from "node:crypto";
import { HttpError } from "../integrations/eod.mjs";
import { lessonsIn, learningProgress } from "./learning.mjs";

export const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
export const validEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const invitationId = (email) => createHash("sha256").update(normalizeEmail(email)).digest("hex");

export function requireInvitation(store, me, { claim = true } = {}) {
  if (me.user?.role === "admin") return;
  const user = me.user;
  const email = normalizeEmail(user?.email);
  const invite = validEmail(email) ? store.get("invitations", invitationId(email)) : null;
  if (user?.role !== "candidate" || !user.candidate_id || !me.candidate || me.candidate.id !== user.candidate_id || user.active === false
    || !invite || invite.status !== "active" || (invite.user_id && invite.user_id !== user.id)
    || (invite.candidate_id && invite.candidate_id !== user.candidate_id)) {
    const error = new HttpError(403, "Training is invitation only. Ask your ECOD administrator to invite the email on your ECOD account.");
    error.code = "TRAINING_INVITE_REQUIRED";
    throw error;
  }
  if (claim && !invite.first_access_at) store.transaction(() => {
    store.update("invitations", invite.id, { user_id: user.id, candidate_id: user.candidate_id, first_access_at: new Date().toISOString() });
    store.audit(user, "training_invitation_accepted", invite.id, {});
  });
  return invite;
}

export function trainingProgress(row) {
  const lessons = lessonsIn(row.course_snapshot);
  const attempts = row.quiz_attempts || {};
  return {
    ...learningProgress(row),
    modules: row.course_snapshot.curriculum.map((module) => {
      const completed = module.lessons.filter((l) => row.progress?.[l.id]?.completed_at).length;
      return { id: module.id, title: module.title, completed, total: module.lessons.length,
        percent: module.lessons.length ? Math.round(completed / module.lessons.length * 100) : 0 };
    }),
    lessons: lessons.map((lesson) => ({ id: lesson.id, title: lesson.title,
      completed_at: row.progress?.[lesson.id]?.completed_at || "", question_count: lesson.quiz?.questions.length || 0,
      attempts: attempts[lesson.id]?.count || 0, first_percent: attempts[lesson.id]?.first_percent ?? null,
      best_percent: attempts[lesson.id]?.best_percent ?? attempts[lesson.id]?.percent ?? null,
      latest_percent: attempts[lesson.id]?.percent ?? null, submitted_at: attempts[lesson.id]?.submitted_at || "" })),
  };
}

export function registerTrainingRoutes({ route, store, eod, summary }) {
  const overview = async ({ auth }) => {
    const [candidates, users] = await Promise.all([
      eod.all("/admin/candidates", "candidates", auth.token), eod.all("/admin/users", "users", auth.token),
    ]);
    const invitations = store.list("invitations");
    const rows = store.list("enrollments");
    return {
      generated_at: new Date().toISOString(), invitations,
      courses: store.list("courses").filter((c) => c.status === "published").map((c) => ({ id: c.id, title: c.title, role_id: c.role_id })),
      candidates: candidates.filter((c) => !c.deleting).map((candidate) => {
        const accounts = users.filter((u) => u.role === "candidate" && u.active !== false && u.candidate_id === candidate.id);
        const invitation = invitations.find((i) => accounts.some((u) => normalizeEmail(u.email) === i.email && (!i.user_id || i.user_id === u.id)));
        return { id: candidate.id, name: candidate.name, email: accounts[0]?.email || "",
          access: invitation?.status === "active" ? (invitation.first_access_at ? "active" : "invited") : invitation?.status || "not_invited",
          invitation_id: invitation?.id || "", has_account: accounts.length > 0,
          enrollments: rows.filter((r) => r.candidate_id === candidate.id).map((r) => ({ ...summary(r), training: trainingProgress(r), updated_at: r.updated_at })),
        };
      }),
    };
  };
  const invite = async ({ auth, body }) => {
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address.");
    const users = (await eod.all("/admin/users", "users", auth.token)).filter((u) => normalizeEmail(u.email) === email);
    if (users.length > 1) throw new HttpError(409, "More than one ECOD account uses this email. Give each account a unique email before inviting.");
    const user = users[0];
    if (user && (user.role !== "candidate" || user.active === false || !user.candidate_id))
      throw new HttpError(409, "This email must belong to an active ECOD candidate account with a linked profile.");
    const id = invitationId(email);
    const old = store.get("invitations", id);
    if (old?.user_id && user?.id !== old.user_id) throw new HttpError(409, "This invitation is bound to a different ECOD account. Restore that account or use a different email.");
    return store.transaction(() => {
      const fields = { email, status: "active", user_id: user?.id || "", candidate_id: user?.candidate_id || "", invited_by: auth.user.id, invited_at: new Date().toISOString() };
      const invitation = old ? store.update("invitations", id, fields) : store.insert("invitations", { id, ...fields, first_access_at: "" });
      store.audit(auth.user, "training_invited", id, { email });
      return { invitation, notice: "Access granted locally. No email was sent. Assign a course separately." };
    });
  };
  const change = async ({ auth, params, body }) => {
    if (!["active", "revoked"].includes(body.status)) throw new HttpError(400, "Choose active or revoked access.");
    if (!store.get("invitations", params.id)) throw new HttpError(404, "Invitation not found.");
    return store.transaction(() => {
      const invitation = store.update("invitations", params.id, { status: body.status });
      store.audit(auth.user, "training_access_changed", params.id, { status: body.status });
      return { invitation };
    });
  };
  for (const prefix of ["/admin/training", "/integration/training"]) {
    route("GET", prefix, "admin", overview);
    route("POST", `${prefix}/invitations`, "admin", invite);
    route("PUT", `${prefix}/invitations/:id`, "admin", change);
  }
}
