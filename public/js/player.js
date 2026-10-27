import { api as defaultApi, esc, icon, progress, tag, action } from "./ui.js";
import { lessonContent } from "./lesson-content.js";
import { passNeeded } from "./course-overview.js";

const score = (value) => Number.isFinite(value) ? `${value}%` : "—";
export const minimumCorrect = passNeeded;
/** Escaped lesson markup; kept as a named export for callers that only need the HTML. */
export const lessonText = (body) => lessonContent(body).html;
const noteKey = (enrollment, lesson) => `lms-notes:${enrollment}:${lesson}`;
const readNote = (key) => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };
const writeNote = (key, value) => { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); return true; } catch { return false; } };

function scoreRing(correct, total, passed) {
  const r = 52, c = 2 * Math.PI * r, share = total ? correct / total : 0;
  return `<svg class="score-ring ${passed ? "passed" : "review"}" viewBox="0 0 128 128" aria-hidden="true"><circle class="ring-track" cx="64" cy="64" r="${r}"/><circle class="ring-value" cx="64" cy="64" r="${r}" stroke-dasharray="${(c * share).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 64 64)"/></svg><div class="ring-label"><span>Score</span><strong>${correct}</strong><span>out of ${total}</span></div>`;
}

function questionsMarkup(quiz, result, answers) {
  const marked = new Map((result?.feedback || []).map((f) => [f.id, f]));
  return quiz.questions.map((q, qi) => {
    const feedback = marked.get(q.id);
    return `<fieldset class="quiz-question" ${result ? "disabled" : ""}><legend><span class="question-number">Question ${qi + 1}</span><span class="question-prompt">${esc(q.prompt)}</span></legend><div class="quiz-options">${q.options.map((option, oi) => {
      const correct = feedback?.correct_option_id === option.id;
      const chosen = answers[q.id] === option.id;
      const wrong = Boolean(feedback && chosen && !correct);
      return `<label class="quiz-option ${correct ? "is-correct" : wrong ? "is-incorrect" : ""} ${chosen ? "is-chosen" : ""}"><input type="radio" name="${esc(q.id)}" value="${esc(option.id)}" ${chosen ? "checked" : ""} required><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + oi)}</span><span class="option-copy">${esc(option.label)}</span>${correct || wrong ? `<span class="option-verdict">${icon(correct ? "check" : "close")} ${correct ? (chosen ? "Your answer · correct" : "Correct answer") : "Your answer"}</span>` : ""}</label>`;
    }).join("")}</div>${feedback ? `<p class="quiz-feedback ${feedback.correct ? "correct" : "incorrect"}">${icon(feedback.correct ? "check" : "review")}<span><strong>${feedback.correct ? "Correct." : "Not quite."}</strong> ${esc(feedback.explanation)}</span></p>` : ""}</fieldset>`;
  }).join("");
}

let releasePlayer = () => {};
export function closeLearningWindow() { releasePlayer(); releasePlayer = () => {}; }

export async function player(view, id, { api = defaultApi, eodUrl = "" } = {}) {
  const data = await api(`/enrollments/${id}`);
  if (!view.isConnected) return;
  closeLearningWindow();
  const course = data.course;
  const lessons = course.curriculum.flatMap((m) => m.lessons);
  if (!lessons.length) throw new Error("This assignment has no lessons. Please contact your learning administrator.");
  // Every lesson has a reading step, a knowledge-check step, or both.
  const steps = lessons.flatMap((l) => [...(l.kind !== "quiz" ? [{ lesson: l, part: "read" }] : []), ...(l.quiz ? [{ lesson: l, part: "check" }] : [])]);
  let done = new Set(data.completed_lessons), enrollment = data.enrollment, training = data.training, request = data.request;
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let selected = params.get("lesson") || enrollment.progress.next_lesson_id || lessons[0].id;
  if (!lessons.some((l) => l.id === selected)) selected = lessons[0].id;
  const first = lessons.find((l) => l.id === selected);
  let mode = params.get("part") === "check" && first.quiz || first.kind === "quiz" ? "quiz-intro" : "read";
  let questionIndex = 0, submitting = false, quizError = "", expanded = false, notesOpen = false;
  let outlineOpen = !window.matchMedia?.("(max-width: 900px)").matches;
  const attempts = new Map(), drafts = new Map();
  document.body.classList.add("learning-window-open");
  view.innerHTML = '<section id="learning-workspace" class="learning-workspace" aria-label="Course learning window"><header class="learn-toolbar"></header><div class="learn-layout"><aside class="learn-outline" id="learn-outline" aria-label="Course contents"></aside><button class="learn-outline-scrim" aria-label="Close course outline" hidden></button><div class="learn-stage"><div class="learn-progressbar" aria-hidden="true"><span></span></div><div class="learn-scroll"></div><footer class="learn-footer"></footer></div><aside class="learn-notes" id="learn-notes" aria-label="My notes" hidden></aside></div><p class="learn-notice" role="status" hidden></p></section>';
  const workspace = view.querySelector("#learning-workspace");
  const scroller = workspace.querySelector(".learn-scroll");
  const mobile = () => window.matchMedia?.("(max-width: 900px)").matches;
  const setOutline = (open) => {
    outlineOpen = open;
    workspace.classList.toggle("outline-open", open);
    workspace.querySelector("#toggle-course-outline")?.setAttribute("aria-expanded", String(open));
    workspace.querySelector(".learn-outline-scrim").hidden = !(open && mobile());
    workspace.querySelector(".learn-stage").inert = open && mobile();
    workspace.querySelector(".learn-outline").inert = !open;
  };
  const syncFullscreen = () => {
    const active = document.fullscreenElement === workspace || expanded;
    workspace.classList.toggle("is-expanded", expanded);
    const button = workspace.querySelector("#toggle-learning-fullscreen");
    if (button) { button.innerHTML = `${icon(active ? "minimize" : "maximize")}<span>${active ? "Exit full screen" : "Full screen"}</span>`; button.setAttribute("aria-pressed", String(active)); button.setAttribute("aria-label", active ? "Exit full screen" : "Full screen"); }
  };
  const exitFullscreen = async () => {
    if (document.fullscreenElement === workspace) await document.exitFullscreen?.().catch(() => {});
    expanded = false; workspace.querySelector(".learn-notice").hidden = true; syncFullscreen();
  };
  const fullscreen = async () => {
    if (document.fullscreenElement === workspace || expanded) return exitFullscreen();
    if (workspace.requestFullscreen) {
      try { await workspace.requestFullscreen(); syncFullscreen(); return; } catch { /* Embedded browsers can provide the expanded workspace below. */ }
    }
    expanded = true; syncFullscreen();
    const notice = workspace.querySelector(".learn-notice"); notice.hidden = false; notice.textContent = "Learning window expanded. Press Esc or use Exit full screen to return.";
  };
  const onFullscreen = () => { expanded = false; syncFullscreen(); };
  const onKey = (event) => {
    if (event.key === "Escape") {
      if (outlineOpen && mobile()) { setOutline(false); workspace.querySelector("#toggle-course-outline")?.focus(); }
      else if (notesOpen) { notesOpen = false; paintNotes(); workspace.querySelector("#toggle-notes")?.focus(); }
      else if (expanded || document.fullscreenElement === workspace) exitFullscreen();
    }
    if (event.key === "Tab" && outlineOpen && mobile()) {
      const items = [...workspace.querySelectorAll('.learn-outline a[href], .learn-outline summary, .learn-outline button:not([disabled])')].filter((element) => {
        const details = element.closest("details");
        return !details || details.open || element === details.querySelector("summary");
      });
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    }
  };
  const onScroll = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    workspace.querySelector(".learn-progressbar span").style.width = `${max > 0 ? Math.min(100, scroller.scrollTop / max * 100) : 0}%`;
    const links = [...workspace.querySelectorAll(".lesson-toc a")];
    if (!links.length) return;
    let current = links[0];
    for (const link of links) {
      const target = workspace.querySelector(link.getAttribute("href"));
      if (target && target.getBoundingClientRect().top - scroller.getBoundingClientRect().top < 120) current = link;
    }
    links.forEach((link) => link.classList.toggle("active", link === current));
  };
  document.addEventListener("fullscreenchange", onFullscreen);
  document.addEventListener("keydown", onKey);
  scroller.addEventListener("scroll", onScroll, { passive: true });
  const resize = () => setOutline(mobile() ? false : outlineOpen);
  window.addEventListener("resize", resize);
  releasePlayer = () => {
    document.removeEventListener("fullscreenchange", onFullscreen);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", resize);
    document.body.classList.remove("learning-window-open");
    if (document.fullscreenElement === workspace) document.exitFullscreen?.().catch(() => {});
  };
  const reveal = (selector = "#lesson-title") => {
    scroller.scrollTop = 0;
    workspace.querySelector(selector)?.focus({ preventScroll: true });
    onScroll();
  };
  const stepIndex = () => steps.findIndex((s) => s.lesson.id === selected && (s.part === "check") === (mode !== "read"));
  const go = (step) => {
    if (submitting || !step) return;
    selected = step.lesson.id; questionIndex = 0; quizError = "";
    mode = step.part === "check" ? "quiz-intro" : "read";
    history.replaceState(null, "", `#/course/${id}?lesson=${encodeURIComponent(selected)}${mode === "read" ? "" : "&part=check"}`);
    if (mobile()) outlineOpen = false;
    paint(); reveal();
  };
  const select = (lessonId, part = "read") => go(steps.find((s) => s.lesson.id === lessonId && s.part === part) || steps.find((s) => s.lesson.id === lessonId));
  const nextLesson = () => {
    const index = lessons.findIndex((l) => l.id === selected);
    if (index + 1 < lessons.length) select(lessons[index + 1].id);
  };

  function paintNotes() {
    const panel = workspace.querySelector(".learn-notes");
    const key = noteKey(id, selected);
    panel.hidden = !notesOpen;
    workspace.classList.toggle("notes-open", notesOpen);
    workspace.querySelector("#toggle-notes")?.setAttribute("aria-expanded", String(notesOpen));
    if (!notesOpen) return;
    const lesson = lessons.find((l) => l.id === selected);
    panel.innerHTML = `<div class="notes-head"><div><span>My notes</span><strong>${esc(lesson.title)}</strong></div><button id="close-notes" class="learn-icon-button" aria-label="Close notes">${icon("close")}</button></div><label class="sr-only" for="lesson-notes">Notes for ${esc(lesson.title)}</label><textarea id="lesson-notes" placeholder="Write key points, questions to ask, or how this applies to your work…">${esc(readNote(key))}</textarea><p class="notes-status" role="status">Saved on this device only.</p>`;
    const area = panel.querySelector("#lesson-notes"), status = panel.querySelector(".notes-status");
    let timer;
    area.oninput = () => { clearTimeout(timer); status.textContent = "Saving…"; timer = setTimeout(() => { status.textContent = writeNote(key, area.value) ? "Saved on this device only." : "Notes can’t be saved in this browser."; }, 400); };
    panel.querySelector("#close-notes").onclick = () => { notesOpen = false; paintNotes(); workspace.querySelector("#toggle-notes")?.focus(); };
  }

  const paint = () => {
    if (!view.isConnected) return;
    const lesson = lessons.find((l) => l.id === selected);
    const module = course.curriculum.find((m) => m.lessons.some((l) => l.id === selected));
    const moduleNumber = course.curriculum.indexOf(module) + 1;
    const index = lessons.indexOf(lesson), unlocked = lessons.findIndex((l) => !done.has(l.id));
    const locked = lessons.slice(0, index).some((l) => !done.has(l.id));
    const attempt = attempts.get(selected), answers = drafts.get(selected) || attempt?.answers || {};
    const stats = training?.lessons.find((l) => l.id === selected);
    const at = stepIndex(), previous = steps[at - 1], following = steps[at + 1];
    const stepLabel = (s) => s.part === "check" ? `${s.lesson.title} · Knowledge check` : s.lesson.title;
    document.title = `${mode === "read" ? lesson.title : `Knowledge check · ${lesson.title}`} · ECOD Learning`;
    const [moduleCode, moduleTitle] = module.title.includes(" · ") ? [module.title.split(" · ")[0], module.title.split(" · ").slice(1).join(" · ")] : [`Module ${moduleNumber}`, module.title];

    workspace.querySelector(".learn-toolbar").innerHTML = `<div class="learn-toolbar-title"><button id="toggle-course-outline" class="learn-icon-button" aria-label="Toggle course outline" aria-controls="learn-outline" aria-expanded="${outlineOpen}">${icon("menu")}</button><div><span>${esc(moduleCode)} · ${esc(moduleTitle)}</span><strong>${esc(mode === "read" ? lesson.title : `${lesson.title} · Knowledge check`)}</strong></div></div><div class="learn-toolbar-actions"><button id="toggle-notes" class="button outline" aria-controls="learn-notes" aria-expanded="${notesOpen}">${icon("note")}<span>Notes</span></button><a href="#/course/${id}" class="button outline course-link">${icon("book")}<span>Course overview</span></a><button id="toggle-learning-fullscreen" class="button outline" aria-pressed="false"></button></div>`;

    workspace.querySelector(".learn-outline").innerHTML = `<div class="learn-course-summary"><div class="summary-top"><a href="#/course/${id}" class="learn-back">${icon("back")} Back to course</a><button id="close-course-outline" class="learn-icon-button" aria-label="Close course outline">${icon("close")}</button></div><h2>${esc(course.title)}</h2><div class="player-progress">${progress(enrollment.progress.percent)}<strong>${enrollment.progress.percent}% complete</strong><span>${done.size} of ${lessons.length} lessons</span></div></div><nav aria-label="Lessons">${course.curriculum.map((m, mi) => `<details class="learn-module" ${m.id === module.id ? "open" : ""}><summary><span class="learn-module-num">${String(mi + 1).padStart(2, "0")}</span><b>${esc(m.title.includes(" · ") ? m.title.split(" · ").slice(1).join(" · ") : m.title)}</b><small>${m.lessons.filter((l) => done.has(l.id)).length}/${m.lessons.length}</small></summary>${m.lessons.map((l) => {
      const disabled = unlocked >= 0 && lessons.indexOf(l) > unlocked;
      const status = (finished) => `<span class="learn-status ${finished ? "is-done" : disabled ? "is-locked" : ""}">${icon(finished ? "checkCircle" : disabled ? "lock" : "circle")}</span>`;
      const item = (part) => {
        const current = selected === l.id && (part === "check") === (mode !== "read");
        const check = part === "check";
        return `<button data-lesson="${esc(l.id)}" data-part="${part}" class="learn-lesson ${check ? "learn-check-link" : ""} ${current ? "selected" : ""}" ${disabled || submitting ? "disabled" : ""} ${current ? 'aria-current="step"' : ""}>${icon(check ? "help" : "doc", "kind")}<span>${check ? "Knowledge check" : esc(l.title)}<small>${check ? `${l.quiz.questions.length} questions · ${minimumCorrect(l.quiz)} to pass` : `${l.minutes} min`}</small></span>${status(done.has(l.id))}</button>`;
      };
      return (l.kind !== "quiz" ? item("read") : "") + (l.quiz ? item("check") : "");
    }).join("")}</details>`).join("")}</nav>`;

    let content = "", footer = "";
    const prevButton = previous ? `<button id="previous-step" class="button outline footer-prev" title="${esc(stepLabel(previous))}">${icon("back")}<span>Previous</span></button>` : "<span></span>";
    if (locked) {
      content = `<div class="reader-empty">${icon("lock")}<h1 id="lesson-title" tabindex="-1">Finish the earlier lessons first</h1><p>Lessons unlock in order. Your progress is saved, so you can pick up right where you left off.</p><button id="resume-lesson" class="button primary">Go to my current lesson ${icon("arrow")}</button></div>`;
    } else if (mode === "read") {
      const body = lessonContent(lesson.body || "");
      const media = `${lesson.kind === "video" && lesson.resource_url ? `<video class="lesson-video" controls preload="metadata" src="${esc(lesson.resource_url)}"></video>` : ""}${["video", "resource"].includes(lesson.kind) && lesson.resource_url ? `<a class="button outline" href="${esc(lesson.resource_url)}" target="_blank" rel="noopener noreferrer">Open resource ${icon("external")}</a>` : ""}`;
      const lessonNumber = module.lessons.indexOf(lesson) + 1;
      const end = lesson.quiz
        ? `<section class="lesson-end"><span class="lesson-end-icon">${icon("help")}</span><div><h2>${done.has(lesson.id) ? "You passed this lesson’s check" : "Check your understanding"}</h2><p>${lesson.quiz.questions.length} questions · get ${minimumCorrect(lesson.quiz)} right to ${done.has(lesson.id) ? "pass. You can practise again any time." : "unlock the next lesson."}</p></div><button data-act="check" class="button primary">${done.has(lesson.id) ? "Practise again" : "Start knowledge check"} ${icon("arrow")}</button></section>`
        : done.has(lesson.id) ? `<section class="lesson-end done"><span class="lesson-end-icon">${icon("check")}</span><div><h2>Lesson complete</h2><p>Nice work. Carry on to the next lesson.</p></div></section>` : "";
      content = `<div class="reading-layout"><article class="reading-page"><header class="lesson-head"><p class="lesson-eyebrow">${esc(moduleCode)} · Lesson ${lessonNumber} of ${module.lessons.length}</p><h1 id="lesson-title" tabindex="-1">${esc(lesson.title)}</h1><p class="lesson-facts"><span>${icon("clock")}${lesson.minutes} min ${lesson.kind === "video" ? "watch" : "read"}</span>${lesson.quiz ? `<span>${icon("help")}Knowledge check after reading</span>` : ""}${done.has(lesson.id) ? `<span class="fact-done">${icon("checkCircle")}Completed</span>` : ""}</p></header>${media}<div class="lesson-body">${body.html || `<p>${lesson.kind === "video" ? "Watch the learning resource, then continue." : "This lesson has no written notes."}</p>`}</div>${end}</article>${body.toc.length > 2 ? `<nav class="lesson-toc" aria-label="On this page"><h2>On this page</h2>${body.toc.map((t, i) => `<a href="#${t.id}" class="${i === 0 ? "active" : ""}">${esc(t.title)}</a>`).join("")}</nav>` : ""}</div>`;
      const primary = lesson.quiz
        ? `<button id="open-knowledge-check" class="button primary">Knowledge check ${icon("arrow")}</button>`
        : !done.has(lesson.id) ? `<button id="complete-lesson" class="button primary">Mark complete &amp; continue ${icon("check")}</button>`
        : following ? `<button id="next-lesson" class="button primary">Next lesson ${icon("arrow")}</button>` : `<a class="button primary" href="#/course/${id}">Course overview ${icon("check")}</a>`;
      footer = `${prevButton}<span class="footer-status">${at + 1} of ${steps.length}</span>${primary}`;
    } else if (mode === "quiz-intro") {
      const intro = lesson.kind === "quiz" && lesson.body ? `<div class="lesson-body compact">${lessonContent(lesson.body).html}</div>` : "";
      content = `<section class="quiz-start"><span class="quiz-start-icon">${icon("help")}</span><p class="lesson-eyebrow">${esc(lesson.title)}</p><h1 id="lesson-title" tabindex="-1">Knowledge check</h1>${intro}<div class="quiz-facts"><div><span class="fact-icon">${icon("help")}</span><strong>${lesson.quiz.questions.length}</strong><span>Questions</span></div><div><span class="fact-icon ok">${icon("check")}</span><strong>${minimumCorrect(lesson.quiz)} / ${lesson.quiz.questions.length}</strong><span>To pass</span></div><div><span class="fact-icon gold">${icon("refresh")}</span><strong>Unlimited</strong><span>Attempts</span></div></div>${stats?.attempts ? `<p class="saved-check-summary">${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"} so far · Best ${score(stats.best_percent)} · Latest ${score(stats.latest_percent)}</p>` : ""}<p class="quiz-pass-note">${done.has(lesson.id) ? `${icon("checkCircle")} You’ve passed this check. Practising again won’t remove your pass.` : `${icon("lock")} Pass this check to unlock the next lesson.`}</p><button id="start-quiz" class="button primary large">${attempt ? "See my results" : Object.keys(answers).length ? "Resume" : done.has(lesson.id) ? "Practise again" : "Start quiz"} ${icon("arrow")}</button></section>`;
      footer = `${lesson.kind !== "quiz" ? `<button id="back-to-reading" class="button outline footer-prev">${icon("back")}<span>Back to lesson</span></button>` : prevButton}<span class="footer-status">${at + 1} of ${steps.length}</span>${done.has(lesson.id) && index < lessons.length - 1 ? `<button id="next-lesson" class="button primary">Next lesson ${icon("arrow")}</button>` : "<span></span>"}`;
    } else {
      const result = mode === "review" ? attempt?.result : null;
      const total = lesson.quiz.questions.length;
      const dots = `<div class="question-tabs" aria-label="Questions">${lesson.quiz.questions.map((q, i) => `<button type="button" data-question="${i}" class="${i === questionIndex ? "active" : ""} ${answers[q.id] ? "answered" : ""}" aria-label="Question ${i + 1}${answers[q.id] ? ", answered" : ""}" aria-current="${i === questionIndex ? "step" : "false"}" ${submitting ? "disabled" : ""}>${i + 1}</button>`).join("")}</div>`;
      const header = result
        ? `<div class="quiz-result ${result.passed ? "passed" : "review"}" role="status" tabindex="-1"><div class="ring-wrap">${scoreRing(result.correct, result.total, result.passed)}</div><div class="result-copy"><span class="result-badge">${icon(result.passed ? "check" : "review")}${result.passed ? "Passed" : "Not passed yet"}</span><h1 id="lesson-title" tabindex="-1">${result.passed ? "Nicely done." : "Almost there."}</h1><p>${result.correct} of ${result.total} correct (${result.percent}%). ${result.passed ? "Your progress is saved and the next lesson is unlocked." : `You need ${minimumCorrect(lesson.quiz)} correct to pass. Read the explanations below, then try again.`}</p><dl class="result-stats"><div><dt>Correct</dt><dd>${result.correct}</dd></div><div><dt>Incorrect</dt><dd>${result.total - result.correct}</dd></div><div><dt>To pass</dt><dd>${minimumCorrect(lesson.quiz)}</dd></div></dl><div class="result-actions"><button type="button" id="retry-practice" class="button ${result.passed ? "outline" : "primary"}">${icon("refresh")} ${result.passed ? "Practise again" : "Try again"}</button>${result.passed && following ? `<button type="button" data-act="next" class="button primary">Next lesson ${icon("arrow")}</button>` : ""}</div></div></div>`
        : `<div class="wizard-heading"><div><span class="lesson-eyebrow">Knowledge check · ${esc(lesson.title)}</span><h1 id="lesson-title" class="wizard-title" tabindex="-1">Question ${questionIndex + 1} <span>of ${total}</span></h1></div>${dots}</div><div class="wizard-bar">${progress(Math.round((questionIndex) / total * 100), "Quiz progress")}</div>`;
      const complete = enrollment.progress.complete && result?.passed ? `<section class="reader-complete">${icon("trophy")}<div><h2>Course complete</h2><p>You’ve finished every lesson. A formal reassessment in ECOD is the next step.</p></div>${request?.assessment_id ? `<a class="button primary" href="${esc(eodUrl || data.eod_web_url || "")}/#/assessments/${esc(request.assessment_id)}/quiz" target="_blank" rel="noopener">Open reassessment ${icon("external")}</a>` : request ? tag("Reassessment requested · awaiting allocation", "green") : '<button id="request-reassessment" class="button primary">Request reassessment</button>'}</section>` : "";
      content = `<section class="quiz-wizard ${result ? "is-review" : ""}">${header}${complete}${result ? `<h2 class="review-heading">Review your answers</h2>` : ""}<form id="practice-form" aria-labelledby="lesson-title">${questionsMarkup(lesson.quiz, result, answers)}<div class="quiz-footer">${result ? `<span class="quiz-colour-key"><i class="answer-key-dot right"></i>Correct answer <i class="answer-key-dot wrong"></i>Incorrect choice</span>` : `<p id="answer-count" role="status" aria-live="polite">${Object.keys(answers).length} of ${total} answered</p><button type="submit" class="button primary">Next question</button>`}</div><p id="practice-error" class="form-error" role="alert" hidden></p></form>${stats?.attempts ? `<p class="attempt-history">Saved scores · First ${score(stats.first_percent)} · Best ${score(stats.best_percent)} · Latest ${score(stats.latest_percent)} · ${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"}</p>` : ""}</section>`;
      footer = `${lesson.kind !== "quiz" ? `<button id="back-to-reading" class="button outline footer-prev">${icon("back")}<span>Back to lesson</span></button>` : prevButton}<span class="footer-status">${at + 1} of ${steps.length}</span>${done.has(lesson.id) ? index < lessons.length - 1 ? `<button id="next-lesson" class="button primary">Next lesson ${icon("arrow")}</button>` : `<a class="button primary" href="#/course/${id}">Course overview ${icon("check")}</a>` : `<span class="reader-pass-required">${icon("lock")} Pass to unlock the next lesson</span>`}`;
    }
    scroller.innerHTML = content;
    workspace.querySelector(".learn-footer").innerHTML = footer;
    workspace.querySelector("#toggle-course-outline").onclick = () => { setOutline(!outlineOpen); if (outlineOpen && mobile()) workspace.querySelector(".learn-outline a")?.focus(); };
    workspace.querySelector("#close-course-outline").onclick = () => { setOutline(false); workspace.querySelector("#toggle-course-outline").focus(); };
    workspace.querySelector(".learn-outline-scrim").onclick = () => { setOutline(false); workspace.querySelector("#toggle-course-outline").focus(); };
    workspace.querySelector("#toggle-learning-fullscreen").onclick = fullscreen;
    workspace.querySelector("#toggle-notes").onclick = () => { notesOpen = !notesOpen; paintNotes(); if (notesOpen) workspace.querySelector("#lesson-notes")?.focus(); };
    workspace.querySelectorAll("[data-lesson]").forEach((b) => { b.onclick = () => select(b.dataset.lesson, b.dataset.part); });
    workspace.querySelectorAll(".lesson-toc a").forEach((a) => { a.onclick = (event) => { event.preventDefault(); const target = workspace.querySelector(a.getAttribute("href")); if (target) scroller.scrollTo?.({ top: target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }; });
    const bind = (selector, fn) => workspace.querySelectorAll(selector).forEach((element) => { element.onclick = fn; });
    const openCheck = () => { mode = "quiz-intro"; history.replaceState(null, "", `#/course/${id}?lesson=${encodeURIComponent(selected)}&part=check`); paint(); reveal(); };
    bind("#resume-lesson", () => select(lessons[unlocked]?.id || lessons[0].id));
    bind("#previous-step", () => go(previous));
    bind("#open-knowledge-check, [data-act=check]", openCheck);
    bind("#back-to-reading", () => select(selected, "read"));
    bind("#next-lesson, [data-act=next]", nextLesson);
    bind("#start-quiz", () => { mode = attempts.has(selected) ? "review" : "quiz"; questionIndex = 0; paint(); reveal(mode === "review" ? ".quiz-result" : "#lesson-title"); });
    bind("#complete-lesson", (event) => action(event.currentTarget, async () => {
      const result = await api(`/enrollments/${id}/complete`, { method: "POST", body: { lesson_id: selected } });
      enrollment = result.enrollment; training = result.training; done = new Set(result.completed_lessons);
      if (view.isConnected) { if (index < lessons.length - 1) nextLesson(); else paint(); }
    }, { busyText: "Saving…" }));
    bind("#retry-practice", () => { attempts.delete(selected); drafts.delete(selected); questionIndex = 0; mode = "quiz"; quizError = ""; paint(); reveal(); });
    bind("#request-reassessment", (event) => action(event.currentTarget, async () => { request = (await api(`/enrollments/${id}/reassessment`, { method: "POST" })).request; if (view.isConnected) paint(); }, { busyText: "Requesting…" }));
    workspace.querySelectorAll("[data-question]").forEach((b) => { b.onclick = () => { questionIndex = Number(b.dataset.question); paint(); reveal(); }; });
    const form = workspace.querySelector("#practice-form");
    if (form && mode === "quiz") {
      form.noValidate = true;
      const fields = [...form.querySelectorAll(".quiz-question")];
      fields.forEach((f, i) => { f.hidden = i !== questionIndex; });
      const nav = document.createElement("div"); nav.className = "wizard-question-navigation";
      nav.innerHTML = questionIndex > 0 ? `<button type="button" id="previous-question" class="button outline">${icon("back")} Previous</button>` : "";
      form.querySelector(".quiz-footer").prepend(nav);
      bind("#previous-question", () => { questionIndex--; paint(); reveal(); });
      const submit = form.querySelector("[type=submit]");
      const updateSubmit = () => {
        submit.innerHTML = submitting ? "Checking answers…" : questionIndex < fields.length - 1 ? `Next question ${icon("arrow")}` : `Submit answers ${icon("check")}`;
        submit.disabled = submitting || !drafts.get(selected)?.[lesson.quiz.questions[questionIndex].id];
      };
      form.onchange = () => {
        drafts.set(selected, Object.fromEntries(new FormData(form)));
        form.querySelector("#answer-count").textContent = `${Object.keys(drafts.get(selected)).length} of ${fields.length} answered`;
        fields[questionIndex].querySelectorAll(".quiz-option").forEach((o) => o.classList.toggle("is-chosen", o.querySelector("input").checked));
        workspace.querySelector(`[data-question="${questionIndex}"]`)?.classList.add("answered");
        updateSubmit();
      };
      updateSubmit();
      form.onsubmit = async (event) => {
        event.preventDefault();
        if (submitting || !drafts.get(selected)?.[lesson.quiz.questions[questionIndex].id]) return;
        if (questionIndex < fields.length - 1) { questionIndex++; paint(); reveal(); return; }
        const answersToSend = drafts.get(selected) || {};
        const missing = lesson.quiz.questions.findIndex((q) => !answersToSend[q.id]);
        if (missing >= 0) { questionIndex = missing; paint(); reveal(); return; }
        submitting = true; updateSubmit(); form.setAttribute("aria-busy", "true");
        workspace.querySelectorAll("button:not(#toggle-learning-fullscreen)").forEach((b) => { b.disabled = true; });
        form.querySelectorAll("fieldset").forEach((f) => { f.disabled = true; });
        try {
          const result = await api(`/enrollments/${id}/quiz`, { method: "POST", body: { lesson_id: selected, answers: answersToSend } });
          enrollment = result.enrollment; training = result.training; done = new Set(result.completed_lessons);
          attempts.set(selected, { result: result.result, answers: answersToSend });
          mode = "review"; questionIndex = 0; quizError = ""; submitting = false; paint(); reveal(".quiz-result");
        } catch (error) {
          submitting = false; quizError = `${error.message} Your selected answers are kept. You can retry.`;
          if (view.isConnected) { paint(); reveal("#practice-error"); }
        }
      };
      const error = form.querySelector("#practice-error");
      if (quizError) { error.textContent = quizError; error.hidden = false; error.tabIndex = -1; }
    }
    setOutline(outlineOpen); syncFullscreen(); paintNotes();
  };
  paint();
}
