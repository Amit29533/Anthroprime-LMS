import { api as defaultApi, esc, icon, progress, tag, action } from "./ui.js";
import { lessonPages, readingMarkup } from "./lesson-pages.js";

const score = (value) => Number.isFinite(value) ? `${value}%` : "—";
export const minimumCorrect = (quiz) => Array.from({ length: quiz.questions.length + 1 }, (_, n) => n)
  .find((n) => Math.round(n / quiz.questions.length * 100) >= quiz.pass_percent);
export function lessonText(body) {
  return body.split(/\n\n/).map((block) => {
    if (block.startsWith("## ")) return `<h3>${esc(block.slice(3))}</h3>`;
    if (block.startsWith("Source:")) return `<details class="lesson-source"><summary>Lesson source</summary><p>${esc(block.slice(7).trim())}</p></details>`;
    return `<p>${esc(block).replaceAll("\n", "<br>")}</p>`;
  }).join("");
}

export function quizMarkup(quiz, result, answers = {}) {
  const marked = new Map((result?.feedback || []).map((f) => [f.id, f]));
  return `<section class="lesson-check" aria-labelledby="lesson-check-title"><div class="check-heading"><span class="check-icon">${icon("quiz")}</span><div><h3 id="lesson-check-title" tabindex="-1">Check your understanding</h3><p>${quiz.questions.length} questions · ${minimumCorrect(quiz)} correct to pass · Unlimited retries</p></div></div>
    ${result ? `<div class="quiz-result ${result.passed ? "passed" : "review"}" role="status" tabindex="-1"><span class="result-icon">${icon(result.passed ? "check" : "review")}</span><div><strong>${result.passed ? "Lesson complete. Nicely done." : "A little review, then try again."}</strong><p>${result.correct} of ${result.total} correct (${result.percent}%). ${result.passed ? "Your progress is saved. You can continue to the next lesson." : "Read the explanations below. Your earlier progress stays saved."}</p></div></div>` : ""}
    <form id="practice-form" aria-labelledby="lesson-check-title">${quiz.questions.map((q, qi) => {
      const feedback = marked.get(q.id);
      return `<fieldset class="quiz-question" ${result ? "disabled" : ""}><legend><span class="question-number">${qi + 1}</span>${esc(q.prompt)}</legend>${q.options.map((option, oi) => {
        const correct = feedback?.correct_option_id === option.id;
        const chosen = answers[q.id] === option.id;
        const wrong = Boolean(feedback && chosen && !correct);
        return `<label class="quiz-option ${correct ? "is-correct" : wrong ? "is-incorrect" : ""}"><input type="radio" name="${esc(q.id)}" value="${esc(option.id)}" ${chosen ? "checked" : ""} required><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + oi)}</span><span class="option-copy">${esc(option.label)}</span>${correct || wrong ? `<span class="option-verdict">${icon(correct ? "check" : "close")} ${correct ? "Correct answer" : "Your answer"}</span>` : ""}</label>`;
      }).join("")}${feedback ? `<p class="quiz-feedback ${feedback.correct ? "correct" : "incorrect"}">${icon(feedback.correct ? "check" : "review")}<span><strong>${feedback.correct ? "Correct." : "Needs review."}</strong> ${esc(feedback.explanation)}</span></p>` : ""}</fieldset>`;
    }).join("")}<div class="quiz-footer">${result ? `<span class="quiz-colour-key"><i class="answer-key-dot right"></i>Correct answer <i class="answer-key-dot wrong"></i>Incorrect choice</span><button type="button" id="retry-practice" class="button outline">${result.passed ? "Practice again" : "Try again"} ${icon("refresh")}</button>` : `<p id="answer-count" role="status" aria-live="polite">${Object.keys(answers).length} of ${quiz.questions.length} answered</p><button type="submit" class="button primary" ${Object.keys(answers).length < quiz.questions.length ? "disabled" : ""}>Check my answers ${icon("arrow")}</button>`}</div><p id="practice-error" class="form-error" role="alert" hidden></p></form></section>`;
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
  let done = new Set(data.completed_lessons), enrollment = data.enrollment, training = data.training, request = data.request;
  let selected = new URLSearchParams(location.hash.split("?")[1] || "").get("lesson") || enrollment.progress.next_lesson_id || lessons[0].id;
  if (!lessons.some((l) => l.id === selected)) selected = lessons[0].id;
  let mode = lessons.find((l) => l.id === selected).kind === "quiz" ? "quiz-intro" : "read";
  let pageIndex = 0, questionIndex = 0, submitting = false, quizError = "", expanded = false;
  let outlineOpen = !window.matchMedia?.("(max-width: 900px)").matches;
  const attempts = new Map(), drafts = new Map();
  document.body.classList.add("learning-window-open");
  view.innerHTML = '<section id="learning-workspace" class="learning-workspace" aria-label="Course learning window"><header class="learn-toolbar"></header><div class="learn-layout"><aside class="learn-outline" id="learn-outline" aria-label="Course contents"></aside><button class="learn-outline-scrim" aria-label="Close course outline" hidden></button><div class="learn-stage"><div class="learn-scroll"></div><footer class="learn-footer"></footer></div></div><p class="learn-notice" role="status" hidden></p></section>';
  const workspace = view.querySelector("#learning-workspace");
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
  document.addEventListener("fullscreenchange", onFullscreen);
  document.addEventListener("keydown", onKey);
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
    const element = workspace.querySelector(selector);
    element?.focus({ preventScroll: true });
    workspace.querySelector(".learn-scroll").scrollTop = 0;
  };
  const select = (lessonId, part = "read") => {
    if (submitting) return;
    selected = lessonId; pageIndex = 0; questionIndex = 0; quizError = "";
    mode = part === "check" || lessons.find((l) => l.id === selected).kind === "quiz" ? "quiz-intro" : "read";
    history.replaceState(null, "", `#/course/${id}?lesson=${encodeURIComponent(selected)}`);
    if (mobile()) outlineOpen = false;
    paint(); reveal();
  };
  const nextLesson = () => {
    const index = lessons.findIndex((l) => l.id === selected);
    if (index + 1 < lessons.length) select(lessons[index + 1].id);
  };
  const paint = () => {
    if (!view.isConnected) return;
    const lesson = lessons.find((l) => l.id === selected);
    const module = course.curriculum.find((m) => m.lessons.some((l) => l.id === selected));
    const index = lessons.indexOf(lesson), unlocked = lessons.findIndex((l) => !done.has(l.id));
    const locked = lessons.slice(0, index).some((l) => !done.has(l.id));
    const attempt = attempts.get(selected), answers = drafts.get(selected) || attempt?.answers || {};
    const presentation = lessonPages(lesson);
    pageIndex = Math.min(pageIndex, presentation.pages.length - 1);
    const page = presentation.pages[pageIndex];
    const stats = training?.lessons.find((l) => l.id === selected);
    workspace.querySelector(".learn-toolbar").innerHTML = `<div class="learn-toolbar-title"><button id="toggle-course-outline" class="learn-icon-button" aria-label="Toggle course outline" aria-controls="learn-outline" aria-expanded="${outlineOpen}">${icon("menu")}</button><div><span>${mode === "read" ? "READING" : "KNOWLEDGE CHECK"}</span><strong>${esc(lesson.title)}</strong></div></div><div class="learn-toolbar-actions"><a href="#/course/${id}" class="button outline">Course overview</a><button id="toggle-learning-fullscreen" class="button outline" aria-pressed="false"></button></div>`;
    workspace.querySelector(".learn-outline").innerHTML = `<div class="learn-course-summary"><a href="#/course/${id}">← Back to course</a><button id="close-course-outline" class="learn-icon-button" aria-label="Close course outline">${icon("close")}</button><h2>${esc(course.title)}</h2><div class="player-progress">${progress(enrollment.progress.percent)}<strong>${enrollment.progress.percent}% complete</strong><span>${done.size} of ${lessons.length} lessons</span></div></div><nav aria-label="Lessons">${course.curriculum.map((m, mi) => `<details class="learn-module" ${m.id === module.id ? "open" : ""}><summary><span>${String(mi + 1).padStart(2, "0")}</span><b>${esc(m.title)}</b><small>${m.lessons.filter((l) => done.has(l.id)).length}/${m.lessons.length}</small></summary>${m.lessons.map((l) => {
      const disabled = unlocked >= 0 && lessons.indexOf(l) > unlocked;
      return `<button data-lesson="${esc(l.id)}" data-part="read" class="learn-lesson ${selected === l.id && mode === "read" ? "selected" : ""}" ${disabled || submitting ? "disabled" : ""} ${selected === l.id && mode === "read" ? 'aria-current="step"' : ""}>${icon(done.has(l.id) ? "check" : disabled ? "lock" : "book")}<span>${esc(l.title)}<small>${l.minutes} min</small></span></button>${l.quiz ? `<button data-lesson="${esc(l.id)}" data-part="check" class="learn-lesson learn-check-link ${selected === l.id && mode !== "read" ? "selected" : ""}" ${disabled || submitting ? "disabled" : ""} ${selected === l.id && mode !== "read" ? 'aria-current="step"' : ""}>${icon(done.has(l.id) ? "check" : disabled ? "lock" : "quiz")}<span>Knowledge check<small>${l.quiz.questions.length} MCQs · ${minimumCorrect(l.quiz)} to pass</small></span></button>` : ""}`;
    }).join("")}</details>`).join("")}</nav>`;
    let content = "", footer = "";
    if (locked) {
      content = `<div class="reader-empty">${icon("lock")}<h1 id="lesson-title" tabindex="-1">Complete the earlier lessons first</h1><p>Your progress is saved. Return to the current lesson to continue.</p><button id="resume-lesson" class="button primary">Resume learning ${icon("arrow")}</button></div>`;
    } else if (mode === "read") {
      content = `<article class="reading-page"><div class="reader-eyebrow">${esc(module.title.split(" · ")[0])} / SECTION ${pageIndex + 1} OF ${presentation.pages.length}</div><h1 id="lesson-title" tabindex="-1">${esc(page.title)}</h1>${readingMarkup(page)}${pageIndex === 0 && lesson.kind === "video" ? `<video class="lesson-video" controls preload="metadata" src="${esc(lesson.resource_url)}"></video>` : ""}${pageIndex === 0 && ["video", "resource"].includes(lesson.kind) ? `<a class="button outline" href="${esc(lesson.resource_url)}" target="_blank" rel="noopener noreferrer">Open resource ${icon("external")}</a>` : ""}<details class="reader-notes"><summary>Full lesson notes & sources</summary><div>${lessonText(presentation.original || "")}</div></details></article>`;
      footer = `<div class="reader-page-status"><span>Section ${pageIndex + 1} / ${presentation.pages.length}</span><div class="reading-page-dots">${presentation.pages.map((_, i) => `<button data-page="${i}" aria-label="Reading section ${i + 1}" aria-current="${pageIndex === i ? "step" : "false"}" class="${pageIndex === i ? "active" : ""}"></button>`).join("")}</div></div><div class="reader-actions">${pageIndex > 0 ? '<button id="previous-section" class="button outline">← Previous</button>' : ""}${pageIndex < presentation.pages.length - 1 ? '<button id="next-section" class="button primary">Next section ' + icon("arrow") + '</button>' : lesson.quiz ? '<button id="open-knowledge-check" class="button primary">Knowledge check ' + icon("arrow") + '</button>' : '<button id="complete-lesson" class="button primary">Complete lesson ' + icon("check") + '</button>'}</div>`;
    } else if (mode === "quiz-intro") {
      content = `<section class="quiz-start"><span class="quiz-start-icon">${icon("quiz")}</span><p class="reader-eyebrow">${esc(lesson.title)}</p><h1 id="lesson-title" tabindex="-1">A quick check before you continue</h1><p>Answer one question at a time. You can review your choices before submitting.</p><div class="quiz-facts"><div>${icon("quiz")}<strong>${lesson.quiz.questions.length}</strong><span>Questions</span></div><div>${icon("check")}<strong>${minimumCorrect(lesson.quiz)} / ${lesson.quiz.questions.length}</strong><span>To pass</span></div><div>${icon("refresh")}<strong>Unlimited</strong><span>Attempts</span></div></div>${stats?.attempts ? `<p class="saved-check-summary">${stats.attempts} attempt(s) · Best ${score(stats.best_percent)} · Latest ${score(stats.latest_percent)}</p>` : ""}<p class="quiz-pass-note">${done.has(lesson.id) ? "Your earlier pass is saved. Practising again will not remove it." : "Pass this check to complete the lesson and unlock the next one."}</p><button id="start-quiz" class="button primary">${attempt ? "Review answers" : Object.keys(answers).length ? "Resume quiz" : "Start quiz"} ${icon("arrow")}</button></section>`;
      footer = `<button id="back-to-reading" class="button outline">← Back to reading</button>${done.has(lesson.id) && index < lessons.length - 1 ? '<button id="next-lesson" class="button primary">Next lesson ' + icon("arrow") + '</button>' : ""}`;
    } else {
      content = `<section class="quiz-wizard"><div class="wizard-heading"><span class="reader-eyebrow">${mode === "review" ? "REVIEW YOUR ANSWERS" : "KNOWLEDGE CHECK"}</span><div class="question-tabs" aria-label="Questions">${lesson.quiz.questions.map((q, i) => {
        const feedback = attempt?.result.feedback.find((f) => f.id === q.id);
        return `<button type="button" data-question="${i}" class="${i === questionIndex ? "active" : ""} ${feedback ? feedback.correct ? "right" : "wrong" : answers[q.id] ? "answered" : ""}" aria-label="Question ${i + 1}${feedback ? feedback.correct ? ', correct' : ', needs review' : ''}" aria-current="${i === questionIndex ? "step" : "false"}" ${submitting ? "disabled" : ""}>${i + 1}</button>`;
      }).join("")}</div></div><h1 id="lesson-title" class="wizard-title" tabindex="-1">${mode === "review" ? "Your knowledge check" : `Question ${questionIndex + 1} of ${lesson.quiz.questions.length}`}</h1>${quizMarkup(lesson.quiz, mode === "review" ? attempt?.result : null, answers)}${stats?.attempts ? `<p class="attempt-history compact">Saved scores · First ${score(stats.first_percent)} · Best ${score(stats.best_percent)} · Latest ${score(stats.latest_percent)} · ${stats.attempts} attempt(s)</p>` : ""}${enrollment.progress.complete ? `<section class="reader-complete">${icon("check")}<h2>Course complete</h2><p>You’ve completed every lesson. Formal reassessment is a separate next step.</p>${request?.assessment_id ? `<a class="button primary" href="${esc(eodUrl)}/#/assessments/${esc(request.assessment_id)}/quiz" target="_blank" rel="noopener">Open reassessment ${icon("external")}</a>` : request ? tag("Reassessment requested · awaiting allocation", "green") : '<button id="request-reassessment" class="button primary">Request reassessment</button>'}</section>` : ""}</section>`;
      footer = `<button id="back-to-reading" class="button outline">← Back to reading</button>${done.has(lesson.id) ? index < lessons.length - 1 ? '<button id="next-lesson" class="button primary">Next lesson ' + icon("arrow") + '</button>' : `<a class="button primary" href="#/course/${id}">Course overview ${icon("check")}</a>` : '<span class="reader-pass-required">' + icon("lock") + ' Pass the check to unlock the next lesson</span>'}`;
    }
    workspace.querySelector(".learn-scroll").innerHTML = content;
    workspace.querySelector(".learn-footer").innerHTML = footer;
    workspace.querySelector("#toggle-course-outline").onclick = () => { setOutline(!outlineOpen); if (outlineOpen && mobile()) workspace.querySelector(".learn-outline a")?.focus(); };
    workspace.querySelector("#close-course-outline").onclick = () => { setOutline(false); workspace.querySelector("#toggle-course-outline").focus(); };
    workspace.querySelector(".learn-outline-scrim").onclick = () => { setOutline(false); workspace.querySelector("#toggle-course-outline").focus(); };
    workspace.querySelector("#toggle-learning-fullscreen").onclick = fullscreen;
    workspace.querySelectorAll("[data-lesson]").forEach((b) => { b.onclick = () => select(b.dataset.lesson, b.dataset.part); });
    workspace.querySelectorAll("[data-page]").forEach((b) => { b.onclick = () => { pageIndex = Number(b.dataset.page); paint(); reveal(); }; });
    const bind = (selector, fn) => { const element = workspace.querySelector(selector); if (element) element.onclick = fn; };
    bind("#resume-lesson", () => select(lessons[unlocked]?.id || lessons[0].id));
    bind("#previous-section", () => { pageIndex--; paint(); reveal(); });
    bind("#next-section", () => { pageIndex++; paint(); reveal(); });
    bind("#open-knowledge-check", () => { mode = "quiz-intro"; paint(); reveal(); });
    bind("#back-to-reading", () => { mode = "read"; paint(); reveal(); });
    bind("#next-lesson", nextLesson);
    bind("#start-quiz", () => { mode = attempts.has(selected) ? "review" : "quiz"; questionIndex = 0; paint(); reveal(); });
    bind("#complete-lesson", () => action(workspace.querySelector("#complete-lesson"), async () => {
      const result = await api(`/enrollments/${id}/complete`, { method: "POST", body: { lesson_id: selected } });
      enrollment = result.enrollment; training = result.training; done = new Set(result.completed_lessons);
      if (view.isConnected) { if (index < lessons.length - 1) nextLesson(); else paint(); }
    }, { busyText: "Saving…" }));
    bind("#retry-practice", () => { attempts.delete(selected); drafts.delete(selected); questionIndex = 0; mode = "quiz"; quizError = ""; paint(); reveal(); });
    bind("#request-reassessment", () => action(workspace.querySelector("#request-reassessment"), async () => { request = (await api(`/enrollments/${id}/reassessment`, { method: "POST" })).request; if (view.isConnected) paint(); }, { busyText: "Requesting…" }));
    workspace.querySelectorAll("[data-question]").forEach((b) => { b.onclick = () => { questionIndex = Number(b.dataset.question); paint(); reveal(); }; });
    const form = workspace.querySelector("#practice-form");
    if (form) {
      form.noValidate = true;
      const fields = [...form.querySelectorAll(".quiz-question")];
      fields.forEach((f, i) => { f.hidden = i !== questionIndex; });
      const nav = document.createElement("div"); nav.className = "wizard-question-navigation";
      nav.innerHTML = `${questionIndex > 0 ? '<button type="button" id="previous-question" class="button outline">← Previous question</button>' : ""}${mode === "review" && questionIndex < fields.length - 1 ? '<button type="button" id="next-review-question" class="button primary">Next answer ' + icon("arrow") + '</button>' : ""}`;
      form.querySelector(".quiz-footer").before(nav);
      bind("#previous-question", () => { questionIndex--; paint(); reveal(); });
      bind("#next-review-question", () => { questionIndex++; paint(); reveal(); });
      const submit = form.querySelector("[type=submit]");
      const updateSubmit = () => {
        if (!submit) return;
        submit.textContent = submitting ? "Checking answers…" : questionIndex < fields.length - 1 ? "Next question →" : "Submit answers";
        submit.disabled = submitting || !drafts.get(selected)?.[lesson.quiz.questions[questionIndex].id];
      };
      if (mode !== "review") {
        form.onchange = () => { drafts.set(selected, Object.fromEntries(new FormData(form))); form.querySelector("#answer-count").textContent = `${Object.keys(drafts.get(selected)).length} of ${fields.length} answered`; updateSubmit(); };
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
      }
      const error = form.querySelector("#practice-error");
      if (quizError) { error.textContent = quizError; error.hidden = false; error.tabIndex = -1; }
    }
    setOutline(outlineOpen); syncFullscreen();
  };
  paint();
}
