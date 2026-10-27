import { api as defaultApi, esc, icon, progress, tag } from "./ui.js";

export async function courseOverview(view, id, { api = defaultApi } = {}) {
  const data = await api(`/enrollments/${id}`);
  if (!view.isConnected) return;
  const { course, enrollment } = data;
  const done = new Set(data.completed_lessons);
  const lessons = course.curriculum.flatMap((m) => m.lessons);
  const next = enrollment.progress.next_lesson_id || lessons[0]?.id;
  const allChecked = lessons.length > 0 && lessons.every((l) => l.quiz?.questions.length === 3);
  const href = (lesson) => `#/course/${id}?lesson=${encodeURIComponent(lesson)}`;
  let tab = "modules";
  const paint = () => {
    const unlocked = lessons.findIndex((l) => !done.has(l.id));
    const canOpen = (l) => unlocked < 0 || lessons.indexOf(l) <= unlocked;
    view.innerHTML = `<a class="breadcrumb" href="#/learning">← My learning</a><section class="course-overview-hero"><div><span class="eyebrow">ANTHROPRIME / ${esc(course.level)}</span><h1>${esc(course.title)}</h1><p>Learn in short sections. Apply each idea${allChecked ? ", then pass a three-question check before moving on." : " and complete each lesson at your own pace."}</p>${next ? `<a class="button primary" href="${href(next)}">${enrollment.progress.complete ? "Review course" : done.size ? "Continue course" : "Start course"} ${icon("arrow")}</a>` : ""}</div><div class="overview-progress"><strong>${enrollment.progress.percent}<span>% complete</span></strong>${progress(enrollment.progress.percent)}<dl><div><dt>Modules</dt><dd>${course.curriculum.length}</dd></div><div><dt>Completed</dt><dd>${done.size}</dd></div><div><dt>Remaining</dt><dd>${lessons.length - done.size}</dd></div></dl></div></section>
      <div class="overview-tabs" aria-label="Course view"><button data-overview-tab="modules" aria-pressed="${tab === "modules"}">Modules</button><button data-overview-tab="lessons" aria-pressed="${tab === "lessons"}">All lessons</button><span>${lessons.length} lessons · Progress saved as you complete lessons</span></div>
      ${tab === "modules" ? `<div class="module-card-grid">${course.curriculum.map((module, i) => {
        const completed = module.lessons.filter((l) => done.has(l.id)).length;
        const target = module.lessons.find((l) => !done.has(l.id)) || module.lessons[0];
        const available = target && canOpen(target);
        const code = module.title.split(" · ")[0];
        const title = module.title.includes(" · ") ? module.title.split(" · ").slice(1).join(" · ") : module.title;
        return `<article class="module-card"><div class="module-cover cover-${i % 4}"><span>MODULE ${String(i + 1).padStart(2, "0")}</span><b>${esc(code)}</b>${icon(["storage", "path", "chart", "book"][i % 4])}</div><div class="module-card-content">${tag(completed === module.lessons.length ? "Completed" : available ? completed ? "In progress" : "Ready to start" : "Locked", completed === module.lessons.length ? "green" : "")}<h2>${esc(title)}</h2><p>${module.lessons.length} lessons · ${module.lessons.reduce((n, l) => n + l.minutes, 0)} min</p><div class="module-card-progress">${progress(Math.round(completed / Math.max(1, module.lessons.length) * 100), module.title)}<span>${completed}/${module.lessons.length} complete</span></div>${available ? `<a class="button outline" href="${href(target.id)}">${completed === module.lessons.length ? "Review module" : completed ? "Continue module" : "Open module"} ${icon("arrow")}</a>` : `<span class="module-locked">${icon("lock")} Complete earlier lessons to unlock</span>`}</div></article>`;
      }).join("")}</div>` : `<div class="overview-lesson-list">${course.curriculum.map((m) => `<section><h2>${esc(m.title)}</h2>${m.lessons.map((l) => `<div class="overview-lesson-row"><span class="overview-state ${done.has(l.id) ? "done" : ""}">${icon(done.has(l.id) ? "check" : canOpen(l) ? "book" : "lock")}</span><div><strong>${esc(l.title)}</strong><small>${l.minutes} min${l.quiz ? ` · ${l.quiz.questions.length}-question check` : ""}</small></div>${canOpen(l) ? `<a class="text-link" href="${href(l.id)}">${done.has(l.id) ? "Review" : "Open"} ${icon("arrow")}</a>` : '<span class="sr-only">Locked</span>'}</div>`).join("")}</section>`).join("")}</div>`}`;
    view.querySelectorAll("[data-overview-tab]").forEach((b) => { b.onclick = () => { tab = b.dataset.overviewTab; paint(); view.querySelector(`[data-overview-tab="${tab}"]`).focus(); }; });
  };
  paint();
}
