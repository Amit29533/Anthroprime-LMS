import { api as defaultApi, esc, icon, progress, tag, action } from "./ui.js";
import { cover, courseCode } from "./covers.js";

export const hours = (minutes) => minutes >= 90 ? `${Math.round(minutes / 6) / 10} h` : `${minutes} min`;
export const passNeeded = (quiz) => Array.from({ length: quiz.questions.length + 1 }, (_, n) => n)
  .find((n) => Math.round(n / quiz.questions.length * 100) >= quiz.pass_percent);
const moduleParts = (title) => title.includes(" · ") ? [title.split(" · ")[0], title.split(" · ").slice(1).join(" · ")] : ["", title];

export async function courseOverview(view, id, { api = defaultApi, eodUrl = "" } = {}) {
  const data = await api(`/enrollments/${id}`);
  if (!view.isConnected) return;
  const { course, enrollment } = data;
  let request = data.request;
  const done = new Set(data.completed_lessons);
  const lessons = course.curriculum.flatMap((m) => m.lessons);
  const minutes = lessons.reduce((n, l) => n + (l.minutes || 0), 0);
  const checks = lessons.filter((l) => l.quiz);
  const next = enrollment.progress.next_lesson_id || lessons[0]?.id;
  const nextLesson = lessons.find((l) => l.id === next);
  const stats = new Map((data.training?.lessons || []).map((l) => [l.id, l]));
  const href = (lesson, part) => `#/course/${id}?lesson=${encodeURIComponent(lesson)}${part ? `&part=${part}` : ""}`;
  const unlocked = lessons.findIndex((l) => !done.has(l.id));
  const canOpen = (l) => unlocked < 0 || lessons.indexOf(l) <= unlocked;
  const passRule = checks.length ? passNeeded(checks[0].quiz) : 0;
  const sameRule = checks.every((l) => l.quiz.questions.length === checks[0].quiz.questions.length && passNeeded(l.quiz) === passRule);
  let tab = "curriculum";

  const state = (l) => done.has(l.id) ? "done" : canOpen(l) ? "current" : "locked";
  const row = (l, part) => {
    const s = state(l), check = part === "check";
    const best = stats.get(l.id)?.best_percent;
    const meta = check
      ? `${l.quiz.questions.length} questions · pass ${passNeeded(l.quiz)}${Number.isFinite(best) ? ` · best ${best}%` : ""}`
      : `${l.kind === "quiz" ? "Practice" : l.kind === "video" ? "Video" : "Reading"} · ${l.minutes} min`;
    const label = s === "done" ? "Review" : l.id === next && !check ? "Start" : "Open";
    return `<li class="overview-lesson-row ${check ? "is-check" : ""} state-${s}"><span class="overview-state">${icon(s === "done" ? "checkCircle" : s === "locked" ? "lock" : check || l.kind === "quiz" ? "help" : "doc")}</span><div class="row-copy"><strong>${check ? "Knowledge check" : esc(l.title)}</strong><small>${meta}</small></div>${s === "locked" ? '<span class="sr-only">Locked</span>' : `<a class="row-action" href="${href(l.id, check ? "check" : "")}" aria-label="${label}: ${esc(check ? `${l.title} knowledge check` : l.title)}">${label}${icon("chevron")}</a>`}</li>`;
  };

  const curriculum = () => `<div class="module-list">${course.curriculum.map((module, i) => {
    const completed = module.lessons.filter((l) => done.has(l.id)).length;
    const [code, title] = moduleParts(module.title);
    const status = completed === module.lessons.length ? "Completed" : module.lessons.some(canOpen) ? completed ? "In progress" : "Ready" : "Locked";
    const openByDefault = module.lessons.some((l) => l.id === next) || (enrollment.progress.complete && i === 0);
    return `<details class="module-card" ${openByDefault ? "open" : ""}><summary><span class="module-index">${String(i + 1).padStart(2, "0")}</span><span class="module-heading">${code ? `<small>${esc(code)}</small>` : ""}<strong>${esc(title)}</strong><span class="module-sub">${module.lessons.length} lessons · ${hours(module.lessons.reduce((n, l) => n + l.minutes, 0))}</span></span><span class="module-status">${tag(status, status === "Completed" ? "green" : status === "Locked" ? "" : "blue")}<span class="module-count">${completed}/${module.lessons.length}</span></span><span class="module-chevron">${icon("chevron")}</span></summary><ol class="lesson-rows">${module.lessons.map((l) => row(l) + (l.quiz && l.kind !== "quiz" ? row(l, "check") : "")).join("")}</ol></details>`;
  }).join("")}</div>`;

  const about = () => `<div class="about-grid"><section class="about-main"><h2>About this course</h2><p>${esc(course.summary)}</p>${course.outcomes?.length ? `<h2>What you’ll learn</h2><ul class="outcome-list">${course.outcomes.map((o) => `<li>${icon("check")}<span>${esc(o)}</span></li>`).join("")}</ul>` : ""}</section><aside class="about-side"><h2>How it works</h2><ul class="how-list"><li>${icon("path")}<span><strong>Go in order.</strong> Each lesson unlocks when you finish the one before it.</span></li>${checks.length ? `<li>${icon("help")}<span><strong>Check your understanding.</strong> ${sameRule ? `Answer ${checks[0].quiz.questions.length} questions after each lesson and get ${passRule} right to continue.` : "Pass the short knowledge check after each lesson to continue."}</span></li><li>${icon("refresh")}<span><strong>Retry freely.</strong> Explanations show after every attempt. Your best score is kept.</span></li>` : ""}<li>${icon("shield")}<span><strong>Progress saves automatically.</strong> Pick up where you left off on any device.</span></li></ul><h2>This course includes</h2><dl class="includes"><div><dt>Modules</dt><dd>${course.curriculum.length}</dd></div><div><dt>Lessons</dt><dd>${lessons.length}</dd></div><div><dt>Knowledge checks</dt><dd>${checks.length}</dd></div><div><dt>Estimated time</dt><dd>${hours(minutes)}</dd></div></dl></aside></div>`;

  const completeBanner = () => enrollment.progress.complete ? `<section class="complete-banner">${icon("trophy")}<div><h2>You’ve completed this course</h2><p>Every lesson and knowledge check is done. A formal reassessment in ECOD is the next step.</p></div>${request?.assessment_id ? `<a class="button primary" href="${esc(eodUrl || data.eod_web_url || "")}/#/assessments/${esc(request.assessment_id)}/quiz" target="_blank" rel="noopener">Open reassessment ${icon("external")}</a>` : request ? tag("Reassessment requested · awaiting allocation", "green") : '<button id="request-reassessment" class="button primary">Request reassessment</button>'}</section>` : "";

  const paint = () => {
    const pct = enrollment.progress.percent;
    view.innerHTML = `<a class="breadcrumb" href="#/learning">${icon("back")} My learning</a>
      <section class="course-overview-hero">${cover(course.id, courseCode(course.title), { size: "hero" })}<div class="hero-shade"></div>
        <div class="hero-copy"><div class="hero-tags"><span class="chip">Course</span>${course.level ? `<span class="chip ghost">${esc(course.level[0].toUpperCase() + course.level.slice(1))}</span>` : ""}</div><h1>${esc(course.title)}</h1><p>${esc(course.summary)}</p>
          <ul class="hero-meta"><li>${icon("book")}${course.curriculum.length} modules</li><li>${icon("doc")}${lessons.length} lessons</li><li>${icon("clock")}${hours(minutes)}</li></ul>
          ${next ? `<div class="hero-actions"><a class="button primary large" href="${href(next)}">${enrollment.progress.complete ? "Review course" : done.size ? "Continue course" : "Start course"} ${icon("arrow")}</a>${nextLesson && !enrollment.progress.complete ? `<span class="hero-next">Up next: <strong>${esc(nextLesson.title)}</strong></span>` : ""}</div>` : ""}
        </div>
        <div class="overview-progress"><div class="ring-row"><strong class="big-pct">${pct}<span>%</span></strong> <span>complete</span></div>${progress(pct)}<dl><div><dt>Lessons</dt><dd>${lessons.length}</dd></div><div><dt>Incomplete</dt><dd>${lessons.length - done.size}</dd></div><div><dt>Completed</dt><dd>${done.size}</dd></div></dl></div>
      </section>
      ${completeBanner()}
      <div class="overview-tabs" role="tablist" aria-label="Course sections"><button role="tab" data-overview-tab="curriculum" aria-selected="${tab === "curriculum"}">Lessons</button><button role="tab" data-overview-tab="about" aria-selected="${tab === "about"}">About</button></div>
      <div class="overview-panel" role="tabpanel">${tab === "curriculum" ? curriculum() : about()}</div>`;
    view.querySelectorAll("[data-overview-tab]").forEach((b) => { b.onclick = () => { tab = b.dataset.overviewTab; paint(); view.querySelector(`[data-overview-tab="${tab}"]`).focus(); }; });
    const req = view.querySelector("#request-reassessment");
    if (req) req.onclick = () => action(req, async () => { request = (await api(`/enrollments/${id}/reassessment`, { method: "POST" })).request; if (view.isConnected) paint(); }, { busyText: "Requesting…" });
  };
  paint();
}
