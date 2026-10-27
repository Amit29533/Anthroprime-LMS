import {
  api,
  esc,
  icon,
  progress,
  tag,
  toast,
  action,
  field,
  dialog,
  formatDate,
} from "./ui.js";
import { courseEditor } from "./editor.js";

let user = null;
let eodUrl = "";
let renderId = 0;
let filter = "";
let libraryType = "all";
const root = document.getElementById("app");
const go = (route) => {
  if (location.hash === route) render();
  else location.hash = route;
};
const firstName = (name) => name.split(" ")[0];
const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
const brand = `<img class="brand-logo" src="/assets/anthroprime-logo.jpg" alt="" width="64" height="50"><span class="brand-name">Anthro<em>Prime</em><small>LEARNING · HUMAN FIRST</small></span>`;
const isAdmin = () => user?.role === "admin";
const empty = (title, text) =>
  `<div class="empty"><span class="empty-icon">${icon("book")}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
const kindLabel = (kind) =>
  ({ article: "Read", video: "Watch", resource: "Explore", quiz: "Practice" })[
    kind
  ];

function shell(hash) {
  const admin = isAdmin();
  const nav = admin
    ? [
        ["#/home", "Overview", "home"],
        ["#/studio", "Course studio", "book"],
        ["#/paths", "Learning paths", "path"],
        ["#/learners", "Learners", "users"],
        ["#/requests", "Reassessment", "chart"],
        ["#/activity", "Activity log", "clock"],
      ]
    : [
        ["#/home", "Learning home", "home"],
        ["#/catalog", "Course library", "book"],
        ["#/learning", "My learning", "path"],
        ["#/results", "My assessments", "chart"],
      ];
  root.innerHTML = `<div class="workspace"><aside class="sidebar" id="sidebar"><a class="brand" href="#/home">${brand}</a>
    <div class="nav-caption">${admin ? "MANAGE LEARNING" : "YOUR WORKSPACE"}</div><nav aria-label="Primary navigation">${nav.map(([href, text, ico]) => `<a href="${href}" class="nav-item ${hash === href ? "active" : ""}" ${hash === href ? 'aria-current="page"' : ""}>${icon(ico)}<span>${text}</span>${hash === href ? '<span class="nav-dot"></span>' : ""}</a>`).join("")}</nav>
    <div class="sidebar-note">${icon("path")}<strong>Potential, in progress.</strong><p>Small steps. Stronger capabilities.</p><a href="${esc(eodUrl)}" target="_blank" rel="noopener">Assessment platform ${icon("external")}</a></div>
    <div class="sidebar-profile"><span class="avatar">${esc(initials(user.name))}</span><div><strong>${esc(user.name)}</strong><small>${admin ? "Learning administrator" : "Candidate workspace"}</small></div><button id="logout" title="Sign out" aria-label="Sign out">${icon("logout")}</button></div></aside>
    <div class="workspace-main"><header class="topbar"><div class="topbar-context"><button class="mobile-menu" id="mobile-menu" aria-label="Open navigation" aria-expanded="false">☰</button><span>WORKSPACE</span><b>/</b><strong>${admin ? "Learning management" : "Personal development"}</strong></div><div class="topbar-tools"><span class="connected"><i></i>EOD connected</span><button id="theme" class="round-button" aria-label="Switch light and dark theme">◐</button><span class="avatar small-avatar">${esc(initials(user.name))}</span><button id="header-logout" class="logout-button" type="button">${icon("logout")}<span>Log out</span></button></div></header><main id="main-content" tabindex="-1"><div class="page-loading">Loading your workspace…</div></main><footer class="footer"><span>AnthroPrime Learning</span><span>Learn with purpose. Grow with evidence.</span></footer></div></div>`;
  const signOut = (event) =>
    action(event.currentTarget, async () => {
      event.currentTarget.textContent = "Signing out…";
      await api("/logout", { method: "POST" });
      user = null;
      go("#/");
    });
  document.getElementById("logout").onclick = signOut;
  document.getElementById("header-logout").onclick = signOut;
  document.getElementById("theme").onclick = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]').content =
      next === "dark" ? "#15161b" : "#f5f4f1";
    try {
      localStorage.setItem("lms-theme", next);
    } catch {
      /* Optional persistence. */
    }
  };
  document.getElementById("mobile-menu").onclick = (event) => {
    const open = document.getElementById("sidebar").classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  };
  return document.getElementById("main-content");
}
function login(message = "") {
  root.innerHTML = `<main class="signin"><section class="signin-story"><a class="brand" href="#/">${brand}</a><div class="signin-copy"><div class="eyebrow">THE NEXT CHAPTER IS YOURS</div><h1>Turn potential <br>into <em>progress.</em></h1><p>A personal space to build the capabilities that move you forward.</p><div class="journey-visual" aria-hidden="true"><span>01 <b>Discover</b></span><i></i><span>02 <b>Learn</b></span><i></i><span>03 <b>Grow</b></span></div></div><small>ANTHROPRIME · CAPABILITY DEVELOPMENT</small></section>
    <section class="signin-form"><div class="signin-form-inner"><span class="eyebrow">WELCOME TO ANTHROPRIME LEARNING</span><h2>A little learning.<br>A bigger future.</h2><p>Sign in with your existing EOD account.</p><form id="login-form">${field("Username or email", "username", "", { required: true, max: 200 })}${field("Password", "password", "", { type: "password", required: true })}${field("Authenticator or backup code", "otp")}<p class="help">Only needed if authenticator protection is enabled.</p><p class="form-error" role="alert" ${message ? "" : "hidden"}>${esc(message)}</p><button class="button primary signin-submit" type="submit">Sign in to learning ${icon("arrow")}</button></form><div class="account-note">${icon("lock")}<span>One account, across assessment and learning.<br>Your password is verified by EOD.</span></div><a href="${esc(eodUrl)}" class="text-link" target="_blank" rel="noopener">Open assessment platform ${icon("external")}</a></div></section></main>`;
  const form = document.getElementById("login-form");
  form.elements.username.autocomplete = "username";
  form.elements.password.autocomplete = "current-password";
  form.onsubmit = async (event) => {
    event.preventDefault();
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    b.textContent = "Signing in…";
    const error = form.querySelector(".form-error");
    error.hidden = true;
    try {
      const data = await api("/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      user = data.user;
      go("#/home");
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      b.disabled = false;
      b.innerHTML = `Sign in to learning ${icon("arrow")}`;
    }
  };
}
function courseCard(course, index, enrollment, recommendation = false) {
  return `<article class="course-card"><div class="course-art art-${index % 4}"><span class="art-label">ANTHROPRIME / ${esc(course.level || "foundation")}</span><div class="art-geometry" aria-hidden="true"><i></i><i></i><i></i></div><span class="art-symbol">${icon(index % 2 ? "path" : "book")}</span></div><div class="course-card-body"><div class="course-tags">${tag(course.level || "Foundation")}${recommendation && course.gap_names?.length ? tag("Recommended for you", "green") : ""}</div><h3>${esc(course.title)}</h3><p>${esc(course.summary)}</p>${course.gap_names?.length ? `<div class="gap-match">${icon("star")} Builds ${esc(course.gap_names.slice(0, 2).join(" & "))}</div>` : ""}<div class="course-meta"><span>${icon("clock")}${course.duration_minutes} min</span><span>${course.lesson_count} lessons</span></div>${enrollment ? `<div class="progress-label"><span>${enrollment.progress.complete ? "Completed" : `${enrollment.progress.completed} of ${enrollment.progress.total} lessons`}</span><b>${enrollment.progress.percent}%</b></div>${progress(enrollment.progress.percent)}` : ""}<button class="button ${enrollment ? "primary" : "outline"} full" ${enrollment ? `data-open="${enrollment.id}"` : `data-enroll="${course.id}"`}>${enrollment ? (enrollment.progress.complete ? "Revisit course" : "Continue learning") : "Start course"}${icon("arrow")}</button></div></article>`;
}
function pathCard(path, index, enrolled) {
  const courses = enrolled
    ? enrolled.enrollments.map((e) => e.course)
    : path.courses;
  const next =
    enrolled?.enrollments.find((e) => !e.progress.complete) ||
    enrolled?.enrollments[0];
  return `<article class="path-card"><div class="path-rail">${icon("path")}<span>LEARNING PATH ${String(index + 1).padStart(2, "0")}</span></div><div class="path-body"><h3>${esc(path.title)}</h3><p>${esc(path.summary)}</p><ol>${(courses || []).map((c) => `<li>${esc(c.title)}</li>`).join("")}</ol>${enrolled ? `<div class="progress-label"><span>${enrolled.completed_courses} of ${enrolled.enrollments.length} courses complete</span><b>${enrolled.percent}%</b></div>${progress(enrolled.percent, "Learning path progress")}` : ""}<button class="button ${enrolled ? "primary" : "outline"}" ${next ? `data-open="${next.id}"` : `data-path="${path.id}"`}>${enrolled ? "Continue path" : "Start learning path"}${icon("arrow")}</button></div></article>`;
}
function wireLearning(view) {
  view.querySelectorAll("[data-open]").forEach((b) => {
    b.onclick = () => go(`#/course/${b.dataset.open}`);
  });
  view.querySelectorAll("[data-enroll]").forEach((b) => {
    b.onclick = () =>
      action(b, async () => {
        const { enrollment } = await api(
          `/courses/${b.dataset.enroll}/enroll`,
          { method: "POST" },
        );
        go(`#/course/${enrollment.id}`);
      });
  });
  view.querySelectorAll("[data-path]").forEach((b) => {
    b.onclick = () =>
      action(b, async () => {
        const { path_enrollment } = await api(
          `/paths/${b.dataset.path}/enroll`,
          { method: "POST" },
        );
        go(
          `#/course/${path_enrollment.enrollments.find((e) => !e.progress.complete)?.id || path_enrollment.enrollments[0].id}`,
        );
      });
  });
}
function learnerView(view, data, hash) {
  const { enrollments: enrolled, courses, paths } = data;
  const courseMap = new Map(enrolled.map((e) => [e.course_id, e]));
  const active = enrolled.filter((e) => !e.progress.complete);
  const completed = enrolled.filter((e) => e.progress.complete);
  const continueCourse =
    active.find((e) => e.progress.completed > 0) || active[0];
  const title =
    hash === "#/catalog"
      ? "A little curiosity. A lot of possibility."
      : hash === "#/learning"
        ? "Your learning, at your pace."
        : `Good to see you, ${firstName(data.name)}.`;
  view.innerHTML = `<div class="page-head"><div><div class="eyebrow">${hash === "#/catalog" ? "EXPLORE & DEVELOP" : "YOUR DEVELOPMENT SPACE"}</div><h1>${esc(title)}</h1><p>${hash === "#/learning" ? "Pick up where you left off. Every step is saved." : "Build on your strengths. Work on what comes next."}</p></div>${hash !== "#/catalog" ? '<a class="button outline" href="#/catalog">Explore library ' + icon("arrow") + "</a>" : ""}</div>`;
  if (hash === "#/results") {
    view.innerHTML = `<div class="page-head"><div><div class="eyebrow">ASSESS → LEARN → GROW</div><h1>Your capability snapshot.</h1><p>Results from EOD help you choose what to learn next.</p></div><a class="button outline" href="${esc(eodUrl)}" target="_blank" rel="noopener">Open EOD ${icon("external")}</a></div><div class="results-grid">${data.reports.map((report) => `<article class="report-card"><span class="eyebrow">LATEST FINALIZED ASSESSMENT</span><h2>${esc(report.role_name)}</h2><div class="report-score">${report.overall_pct}<small>%</small></div><h3>Where to focus next</h3>${report.gaps.length ? report.gaps.map((gap) => `<div class="gap-row"><span>${esc(gap.name)}</span>${tag(`${gap.gap} level gap`, gap.severity === "critical_gap" ? "amber" : "")}</div>`).join("") : "<p>Your assessed competencies meet their targets.</p>"}<a class="button primary" href="#/catalog">Find learning for my goals ${icon("arrow")}</a></article>`).join("") || empty("Your first chapter starts with assessment", "Complete an EOD assessment to see your capability snapshot and personalized recommendations.")}</div>`;
    return;
  }
  if (hash === "#/home") {
    view.innerHTML += `<section class="learning-hero"><div><span class="eyebrow">A CLEARER PATH FORWARD</span><h2>${continueCourse ? "Keep your<br><em>momentum.</em>" : "Your next chapter<br>starts <em>here.</em>"}</h2><p>${continueCourse ? esc(continueCourse.course.title) : "Thoughtful courses. Small moments of practice. Meaningful progress, one lesson at a time."}</p>${continueCourse ? `<button class="button warm" data-open="${continueCourse.id}">Continue learning ${icon("arrow")}</button><div class="hero-progress">${progress(continueCourse.progress.percent)}<span>${continueCourse.progress.percent}% complete</span></div>` : '<a class="button warm" href="#/catalog">Find your next course ' + icon("arrow") + "</a>"}</div><div class="hero-illustration" aria-hidden="true"><div class="observatory-topline">YOUR CONNECTED LEARNING JOURNEY</div><svg class="observatory-network" viewBox="0 0 340 260" fill="none"><path class="network-line" d="M40 55 116 28 214 46 300 80 273 170 181 220 75 183 40 55 168 112 300 80M116 28 168 112 214 46 273 170 168 112 75 183 181 220M40 55 214 46M75 183 273 170M116 28 181 220"/><g class="network-dot"><circle cx="40" cy="55" r="2"/><circle cx="116" cy="28" r="2.5"/><circle cx="214" cy="46" r="2"/><circle cx="300" cy="80" r="2"/><circle cx="273" cy="170" r="2"/><circle cx="181" cy="220" r="2.5"/><circle cx="75" cy="183" r="2"/><circle cx="62" cy="110" r="1.3"/><circle cx="251" cy="110" r="1.3"/><circle cx="150" cy="60" r="1.3"/><circle cx="210" cy="190" r="1.3"/></g></svg><div class="observatory-orbit"></div><div class="observatory-orbit second"></div><div class="observatory-core"><img src="/assets/anthroprime-logo.jpg" alt="" width="67" height="53"></div><span class="observatory-node node-learn">${icon("book")} Learn <small>01</small></span><span class="observatory-node node-practice">${icon("quiz")} Practice <small>02</small></span><span class="observatory-node node-grow">${icon("chart")} Grow <small>03</small></span><div class="observatory-bottomline"><span>HUMAN POTENTIAL</span><span>CONNECTED CAPABILITY</span></div></div></section>
    <div class="stats"><div><span class="stat-icon">${icon("book")}</span><strong>${active.length}</strong><span>Courses in progress</span></div><div><span class="stat-icon green-text">${icon("check")}</span><strong>${completed.length}</strong><span>Courses completed</span></div><div><span class="stat-icon gold-text">${icon("path")}</span><strong>${enrolled.reduce((sum, e) => sum + e.progress.completed, 0)}</strong><span>Lessons completed</span></div></div>`;
  }
  if (hash === "#/catalog") {
    view.innerHTML += `<div class="library-toolbar"><label class="search"><span class="sr-only">Search courses and paths</span><input id="course-search" type="search" placeholder="Find your next skill…" value="${esc(filter)}"></label><div class="tabs" aria-label="Content type">${[
      ["all", "All learning"],
      ["courses", "Courses"],
      ["paths", "Learning paths"],
    ]
      .map(
        ([id, text]) =>
          `<button data-type="${id}" class="${libraryType === id ? "active" : ""}" aria-pressed="${libraryType === id}">${text}</button>`,
      )
      .join("")}</div></div><div id="library-results"></div>`;
    const paint = () => {
      const q = filter.toLowerCase();
      const selected = courses.filter((c) =>
        `${c.title} ${c.summary} ${(c.gap_names || []).join(" ")}`
          .toLowerCase()
          .includes(q),
      );
      const selectedPaths = paths.filter((p) =>
        `${p.title} ${p.summary}`.toLowerCase().includes(q),
      );
      const target = view.querySelector("#library-results");
      target.innerHTML = `${libraryType !== "paths" && selected.length ? `<div class="section-head"><h2>Courses for your development</h2><span>${selected.length} courses</span></div><div class="course-grid">${selected.map((c, i) => courseCard(c, i, courseMap.get(c.id), true)).join("")}</div>` : ""}${
        libraryType !== "courses" && selectedPaths.length
          ? `<div class="section-head"><h2>Go further with a learning path</h2></div><div class="path-grid">${selectedPaths
              .map((p, i) =>
                pathCard(
                  p,
                  i,
                  data.path_enrollments.find((e) => e.path.id === p.id),
                ),
              )
              .join("")}</div>`
          : ""
      }`;
      if (!target.innerHTML)
        target.innerHTML = empty(
          q ? "No matching learning found" : "Your library is taking shape",
          q
            ? "Try a different title or capability."
            : data.has_report
              ? "Your learning administrator can publish courses for your assessment track."
              : "Complete your baseline assessment for recommendations, or ask your administrator to assign a course.",
        );
      wireLearning(target);
    };
    view.querySelector("#course-search").oninput = (event) => {
      filter = event.target.value;
      paint();
    };
    view.querySelectorAll("[data-type]").forEach((b) => {
      b.onclick = () => {
        libraryType = b.dataset.type;
        view.querySelectorAll("[data-type]").forEach((other) => {
          other.classList.toggle("active", other === b);
          other.setAttribute("aria-pressed", String(other === b));
        });
        paint();
      };
    });
    paint();
    return;
  }
  if (hash === "#/learning") {
    view.innerHTML += `<div class="section-head"><h2>Your learning paths</h2></div><div class="path-grid">${data.path_enrollments.map((p, i) => pathCard(p.path, i, p)).join("") || empty("Make the journey your own", "Start an ordered learning path from the library, or ask your administrator for an assignment.")}</div><div class="section-head"><h2>All your courses</h2><span>${enrolled.length} enrolled</span></div><div class="course-grid">${enrolled.map((e, i) => courseCard(e.course, i, e)).join("") || empty("Your next course is waiting", "Explore your library to start learning.")}</div>`;
  } else {
    const recommended = courses
      .filter((c) => !courseMap.get(c.id)?.progress.complete)
      .slice(0, 3);
    view.innerHTML += `<div class="section-head"><div><span class="eyebrow">CHOSEN FOR YOUR NEXT STEP</span><h2>Build the skills that matter.</h2></div><a href="#/catalog" class="text-link">View all courses ${icon("arrow")}</a></div><div class="course-grid">${
      recommended
        .map((c, i) => courseCard(c, i, courseMap.get(c.id), true))
        .join("") ||
      (enrolled.length
        ? enrolled
            .slice(0, 3)
            .map((e, i) => courseCard(e.course, i, e))
            .join("")
        : empty(
            "A personal plan starts with your assessment",
            "Complete your baseline assessment in EOD, or ask your administrator to assign your first course.",
          ))
    }</div>${
      paths.length
        ? `<div class="section-head"><h2>A path with purpose.</h2><a href="#/catalog" class="text-link">Explore learning paths ${icon("arrow")}</a></div><div class="path-grid">${paths
            .slice(0, 2)
            .map((p, i) =>
              pathCard(
                p,
                i,
                data.path_enrollments.find((e) => e.path.id === p.id),
              ),
            )
            .join("")}</div>`
        : ""
    }`;
  }
  wireLearning(view);
}

async function player(view, id) {
  const data = await api(`/enrollments/${id}`);
  let done = new Set(data.completed_lessons);
  let enrollment = data.enrollment;
  let request = data.request;
  const course = data.course;
  const lessons = course.curriculum.flatMap((m) => m.lessons);
  let selected =
    new URLSearchParams(location.hash.split("?")[1] || "").get("lesson") ||
    enrollment.progress.next_lesson_id ||
    lessons[0]?.id;
  if (!lessons.some((l) => l.id === selected)) selected = lessons[0]?.id;
  let quizResult = null;
  const paint = () => {
    const lesson = lessons.find((l) => l.id === selected);
    const index = lessons.indexOf(lesson);
    const locked = lessons.slice(0, index).some((l) => !done.has(l.id));
    const unlocked = lessons.findIndex((l) => !done.has(l.id));
    view.innerHTML = `<a class="breadcrumb" href="#/learning">← Back to my learning</a><div class="player-heading"><div><span class="eyebrow">${esc(course.level)} COURSE</span><h1>${esc(course.title)}</h1></div><div class="player-progress"><strong>${enrollment.progress.percent}% complete</strong>${progress(enrollment.progress.percent)}</div></div><div class="player-layout"><aside class="curriculum"><div class="curriculum-head"><h2>Your course</h2><span>${done.size}/${lessons.length} lessons</span></div>${course.curriculum
      .map(
        (m, mi) =>
          `<div class="curriculum-module"><h3><span>${String(mi + 1).padStart(2, "0")}</span>${esc(m.title)}</h3>${m.lessons
            .map((l) => {
              const li = lessons.indexOf(l);
              const disabled = unlocked >= 0 && li > unlocked;
              return `<button data-lesson="${l.id}" class="lesson-nav ${selected === l.id ? "selected" : ""} ${done.has(l.id) ? "done" : ""}" ${disabled ? "disabled" : ""} ${selected === l.id ? 'aria-current="step"' : ""}><span class="lesson-state">${icon(done.has(l.id) ? "check" : disabled ? "lock" : l.kind === "quiz" ? "quiz" : l.kind === "video" ? "play" : "book")}</span><span>${esc(l.title)}<small>${kindLabel(l.kind)} · ${l.minutes} min</small></span></button>`;
            })
            .join("")}</div>`,
      )
      .join(
        "",
      )}</aside><article class="lesson-content"><div class="lesson-kicker"><span>${kindLabel(lesson.kind)} / LESSON ${index + 1} OF ${lessons.length}</span>${done.has(lesson.id) ? tag("Completed", "green") : tag(`${lesson.minutes} min`)}</div><h2 tabindex="-1" id="lesson-title">${esc(lesson.title)}</h2>${locked ? "<p>Complete the earlier lessons to unlock this lesson.</p>" : `${lesson.body ? `<div class="lesson-prose">${esc(lesson.body)}</div>` : ""}${lesson.kind === "video" ? `<video class="lesson-video" controls preload="metadata" src="${esc(lesson.resource_url)}" aria-label="${esc(lesson.title)}"></video><p class="help">If this resource is not a direct video file, use the resource link below.</p>` : ""}${["video", "resource"].includes(lesson.kind) ? `<a class="button outline" href="${esc(lesson.resource_url)}" target="_blank" rel="noopener noreferrer">Open learning resource ${icon("external")}</a>` : ""}${lesson.kind === "quiz" ? `<p class="quiz-intro">A short check to put your learning into practice. Reach ${lesson.quiz.pass_percent}% to complete this lesson. You can retry.</p><form id="practice-form">${lesson.quiz.questions.map((q, qi) => `<fieldset class="quiz-question"><legend><span>${String(qi + 1).padStart(2, "0")}</span>${esc(q.prompt)}</legend>${q.options.map((option) => `<label class="quiz-option"><input type="radio" name="${q.id}" value="${option.id}" required><span>${esc(option.label)}</span></label>`).join("")}${quizResult ? `<p class="quiz-feedback ${quizResult.feedback[qi].correct ? "correct" : "incorrect"}">${quizResult.feedback[qi].correct ? "Correct." : `Correct answer: ${esc((q.options.find((o) => o.id === quizResult.feedback[qi].correct_option_id)?.label || "").replace(/[.!?]$/, ""))}.`} ${esc(quizResult.feedback[qi].explanation)}</p>` : ""}</fieldset>`).join("")}<div class="quiz-footer">${quizResult ? `<strong>${quizResult.percent}% · ${quizResult.correct}/${quizResult.total} correct · ${quizResult.passed ? "Passed" : "Keep practicing"}</strong>` : ""}<button type="submit" class="button primary">${quizResult ? "Try again" : "Check my answers"} ${icon("arrow")}</button></div></form>` : ""}<div class="lesson-bottom"><span>${icon("lock")}Your progress is saved when you complete a lesson.</span>${lesson.kind === "quiz" && !done.has(lesson.id) ? "" : `<button id="complete-lesson" class="button primary">${done.has(lesson.id) ? (index === lessons.length - 1 ? "Course complete" : "Next lesson") : "Mark complete & continue"} ${icon(done.has(lesson.id) && index === lessons.length - 1 ? "check" : "arrow")}</button>`}</div>`}${enrollment.progress.complete ? `<section class="completion-panel"><span class="completion-icon">${icon("check")}</span><div><span class="eyebrow">A STEP WORTH CELEBRATING</span><h3>You completed this course.</h3><p>Put your new capability into practice. When you’re ready, request a formal reassessment.</p>${request?.assessment_id ? `<a href="${esc(eodUrl)}/#/assessments/${request.assessment_id}/quiz" target="_blank" rel="noopener" class="button primary">Open reassessment ${icon("external")}</a>` : request ? tag("Reassessment requested · awaiting allocation", "green") : '<button id="request-reassessment" class="button outline">Request reassessment ' + icon("arrow") + "</button>"}</div></section>` : ""}</article></div>`;
    view.querySelectorAll("[data-lesson]").forEach((b) => {
      b.onclick = () => {
        selected = b.dataset.lesson;
        quizResult = null;
        history.replaceState(null, "", `#/course/${id}?lesson=${selected}`);
        paint();
        view.querySelector("#lesson-title")?.focus({ preventScroll: true });
      };
    });
    const next = view.querySelector("#complete-lesson");
    if (next) {
      if (done.has(lesson.id) && index === lessons.length - 1)
        next.disabled = true;
      next.onclick = () =>
        action(next, async () => {
          if (!done.has(lesson.id)) {
            const result = await api(`/enrollments/${id}/complete`, {
              method: "POST",
              body: { lesson_id: lesson.id },
            });
            enrollment = result.enrollment;
            done = new Set(result.completed_lessons);
          }
          if (index + 1 < lessons.length) selected = lessons[index + 1].id;
          quizResult = null;
          history.replaceState(null, "", `#/course/${id}?lesson=${selected}`);
          paint();
          view.querySelector("#lesson-title")?.focus({ preventScroll: true });
        });
    }
    const practice = view.querySelector("#practice-form");
    if (practice)
      practice.onsubmit = (event) => {
        event.preventDefault();
        const answers = Object.fromEntries(new FormData(practice));
        action(practice.querySelector("[type=submit]"), async () => {
          const result = await api(`/enrollments/${id}/quiz`, {
            method: "POST",
            body: { lesson_id: lesson.id, answers },
          });
          quizResult = result.result;
          enrollment = result.enrollment;
          done = new Set(result.completed_lessons);
          paint();
          for (const [name, value] of Object.entries(answers)) {
            const radio = [...view.querySelectorAll("input[type=radio]")].find(
              (input) => input.name === name && input.value === value,
            );
            if (radio) radio.checked = true;
          }
          toast(
            quizResult.passed
              ? "Practice complete. Your progress is saved."
              : "Review the explanations and try again.",
          );
        });
      };
    const requestButton = view.querySelector("#request-reassessment");
    if (requestButton)
      requestButton.onclick = () =>
        action(requestButton, async () => {
          request = (
            await api(`/enrollments/${id}/reassessment`, { method: "POST" })
          ).request;
          paint();
        });
  };
  paint();
}

function assignment(data, preset = null) {
  const options = [
    ...data.courses
      .filter((c) => c.status === "published")
      .map((c) => ({ key: `course:${c.id}`, label: `Course · ${c.title}` })),
    ...data.paths
      .filter((p) => p.status === "published")
      .map((p) => ({ key: `path:${p.id}`, label: `Path · ${p.title}` })),
  ];
  if (!options.length || !data.candidates.length)
    return toast(
      "Publish learning content and create a candidate in EOD before assigning.",
      true,
    );
  dialog(
    "Assign learning",
    `<p class="dialog-intro">Give a candidate a focused next step. Existing progress is preserved.</p><label class="field"><span>Candidate</span><select name="candidate_id" required><option value="">Choose a candidate</option>${data.candidates.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><label class="field"><span>Course or learning path</span><select name="item" required>${options.map((o) => `<option value="${o.key}" ${o.key === preset ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`,
    "Assign learning",
    async (form) => {
      const [kind, id] = form.get("item").split(":");
      await api("/admin/assign", {
        method: "POST",
        body: { kind, id, candidate_id: form.get("candidate_id") },
      });
      toast("Learning assigned.");
      render();
    },
  );
}
function pathEditor(data, existing = null) {
  if (!data.courses.length)
    return toast("Create a course before building a path.", true);
  const path = existing || {
    title: "",
    summary: "",
    role_id: data.tracks[0]?.id,
    status: "draft",
    course_ids: [],
  };
  const requestId = crypto.randomUUID();
  const el = dialog(
    existing ? "Edit learning path" : "Create learning path",
    `${field("Path title", "title", path.title, { required: true, max: 160 })}${field("What will this path help learners achieve?", "summary", path.summary, { area: true, required: true })}<label class="field"><span>Assessment track</span><select name="role_id">${data.tracks.map((t) => `<option value="${t.id}" ${t.id === path.role_id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label><label class="field"><span>Availability</span><select name="status">${["draft", "published", "archived"].map((s) => `<option ${s === path.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><h3>Build the course sequence</h3><p class="help">Select courses and set their order. Publish each course before publishing the path.</p><div id="path-choices"></div>`,
    "Save learning path",
    async (form, modal) => {
      const ids = [...modal.querySelectorAll("[data-course]:checked")]
        .map((input) => ({
          id: input.value,
          order: Number(
            modal.querySelector(`[data-order="${input.value}"]`).value,
          ),
        }))
        .sort((a, b) => a.order - b.order)
        .map((c) => c.id);
      await api(existing ? `/admin/paths/${existing.id}` : "/admin/paths", {
        method: existing ? "PUT" : "POST",
        body: {
          ...Object.fromEntries(form),
          course_ids: ids,
          request_id: requestId,
          version: existing?.version,
        },
      });
      toast("Learning path saved.");
      render();
    },
  );
  const paintChoices = () => {
    const roleId = el.querySelector("[name=role_id]").value;
    el.querySelector("#path-choices").innerHTML =
      data.courses
        .filter((c) => c.role_id === roleId)
        .map(
          (c, i) =>
            `<div class="path-choice"><label><input type="checkbox" data-course value="${c.id}" ${path.course_ids.includes(c.id) ? "checked" : ""}><span>${esc(c.title)}<small>${esc(c.status)}</small></span></label><label class="order-input"><span>Order</span><input type="number" min="1" max="20" value="${path.course_ids.includes(c.id) ? path.course_ids.indexOf(c.id) + 1 : i + 1}" data-order="${c.id}" aria-label="Order for ${esc(c.title)}"></label></div>`,
        )
        .join("") || "<p>No courses for this track yet.</p>";
  };
  el.querySelector("[name=role_id]").onchange = paintChoices;
  paintChoices();
}
function adminView(view, data, hash) {
  const published = data.courses.filter((c) => c.status === "published");
  const requests = data.requests.filter((r) => r.status === "requested");
  const complete = data.enrollments.filter((e) => e.progress.complete).length;
  const titles = {
    "#/home": [
      "LEARNING OPERATIONS",
      "A clearer view of growth.",
      "Create learning that closes capability gaps.",
    ],
    "#/studio": [
      "DESIGN FOR DEVELOPMENT",
      "Make knowledge actionable.",
      "Build courses with useful content and meaningful practice.",
    ],
    "#/paths": [
      "CONNECT THE NEXT STEPS",
      "Learning with direction.",
      "Sequence courses into a purposeful development journey.",
    ],
    "#/learners": [
      "SUPPORT EVERY JOURNEY",
      "Progress you can act on.",
      "Assign focused learning and follow candidate development.",
    ],
    "#/requests": [
      "CLOSE THE LEARNING LOOP",
      "Ready for the next assessment.",
      "Allocate formal reassessments in EOD after course completion.",
    ],
    "#/activity": [
      "A RECORD OF PROGRESS",
      "Every meaningful step.",
      "Course, learning and reassessment events are saved with the action.",
    ],
  };
  const [eyebrow, title, subtitle] = titles[hash] || titles["#/home"];
  view.innerHTML = `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="head-actions"><button class="button outline" id="assign-learning">Assign learning</button>${hash === "#/paths" ? '<button class="button primary" id="new-path">' + icon("plus") + " New path</button>" : '<a href="#/course-editor/new" class="button primary">' + icon("plus") + " Create course</a>"}</div></div>`;
  if (hash === "#/home") {
    view.innerHTML += `<div class="stats four"><div><span class="stat-icon">${icon("book")}</span><strong>${published.length}</strong><span>Published courses</span></div><div><span class="stat-icon">${icon("users")}</span><strong>${new Set(data.enrollments.map((e) => e.learner_id)).size}</strong><span>Enrolled candidates</span></div><div><span class="stat-icon green-text">${icon("check")}</span><strong>${complete}</strong><span>Completed enrollments</span></div><div><span class="stat-icon gold-text">${icon("chart")}</span><strong>${requests.length}</strong><span>Reassessment requests</span></div></div><div class="admin-welcome"><span class="eyebrow">BUILT AROUND CAPABILITY</span><h2>Assessment gives direction.<br>Learning creates momentum.</h2><p>Connect each course to the competencies it develops. Candidates discover relevant courses through their finalized EOD reports.</p><a href="#/studio" class="text-link">Open course studio ${icon("arrow")}</a></div><div class="section-head"><h2>Your course portfolio</h2><a class="text-link" href="#/studio">Manage courses ${icon("arrow")}</a></div>`;
  }
  if (["#/home", "#/studio"].includes(hash)) {
    view.innerHTML += `<div class="studio-grid">${data.courses.map((c, i) => `<article class="studio-card"><div class="studio-card-top art-${i % 4}">${icon("book")}${tag(c.status, c.status === "published" ? "green" : "")}</div><div class="studio-card-body"><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><div class="course-meta"><span>${c.lesson_count} lessons</span><span>${c.duration_minutes} min</span></div><div class="studio-actions"><a class="button outline" href="#/course-editor/${c.id}">Edit course</a>${c.status === "published" ? `<button class="button subtle" data-assign="course:${c.id}">Assign ${icon("arrow")}</button>` : ""}</div></div></article>`).join("") || empty("Build your first course", "Create a focused course, map it to an EOD competency, and add a short practice quiz.")}</div>`;
  }
  if (hash === "#/paths")
    view.innerHTML += `<div class="path-grid">${data.paths.map((p, i) => `<article class="path-card"><div class="path-rail">${icon("path")}<span>PATH ${i + 1} · ${esc(p.status)}</span></div><div class="path-body"><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><ol>${p.course_ids.map((id) => `<li>${esc(data.courses.find((c) => c.id === id)?.title || "Unavailable course")}</li>`).join("")}</ol><button class="button outline" data-edit-path="${p.id}">Edit path</button>${p.status === "published" ? `<button class="button subtle" data-assign="path:${p.id}">Assign path ${icon("arrow")}</button>` : ""}</div></article>`).join("") || empty("Connect courses into a journey", "Create an ordered path to help candidates develop a complete capability.")}</div>`;
  if (hash === "#/learners")
    view.innerHTML += `<div class="table-wrap"><table><caption>Learning assignments</caption><thead><tr><th>Candidate</th><th>Course</th><th>Progress</th><th>Status</th></tr></thead><tbody>${data.enrollments.map((e) => `<tr><td><strong>${esc(e.learner_name)}</strong></td><td>${esc(e.course.title)}</td><td><div class="table-progress">${progress(e.progress.percent)}<span>${e.progress.percent}%</span></div></td><td>${tag(e.progress.complete ? "Completed" : e.progress.completed ? "In progress" : "Assigned", e.progress.complete ? "green" : "")}</td></tr>`).join("")}</tbody></table>${data.enrollments.length ? "" : empty("No learning assignments yet", "Assign a course or path to an EOD candidate to get started.")}</div>`;
  if (hash === "#/requests")
    view.innerHTML += `<div class="table-wrap"><table><caption>Candidate reassessment requests</caption><thead><tr><th>Candidate</th><th>Completed learning</th><th>Requested</th><th>Next step</th></tr></thead><tbody>${data.requests.map((r) => `<tr><td><strong>${esc(r.learner_name)}</strong></td><td>${esc(r.course_title)}</td><td>${formatDate(r.created_at)}</td><td>${r.assessment_id ? `<a class="button subtle" href="${esc(eodUrl)}/#/assessments" target="_blank" rel="noopener">Allocated in EOD ${icon("external")}</a>` : `<button class="button primary small" data-allocate="${r.id}">Allocate reassessment</button>`}</td></tr>`).join("")}</tbody></table>${data.requests.length ? "" : empty("New growth needs new evidence", "Completed learners can request a reassessment. Their requests will appear here.")}</div>`;
  if (hash === "#/activity")
    view.innerHTML += `<div class="activity-list">${data.audit.map((a) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${esc(a.action.replaceAll("_", " "))}</strong><p>${esc(a.actor_name)}${a.details.title || a.details.course ? ` · ${esc(a.details.title || a.details.course)}` : ""}</p></div><time>${formatDate(a.created_at)}</time></div>`).join("") || empty("Your activity log starts here", "Course edits and learner progress will appear as they happen.")}</div>`;
  view.querySelector("#assign-learning").onclick = () => assignment(data);
  const newPath = view.querySelector("#new-path");
  if (newPath) newPath.onclick = () => pathEditor(data);
  view.querySelectorAll("[data-assign]").forEach((b) => {
    b.onclick = () => assignment(data, b.dataset.assign);
  });
  view.querySelectorAll("[data-edit-path]").forEach((b) => {
    b.onclick = () =>
      pathEditor(
        data,
        data.paths.find((p) => p.id === b.dataset.editPath),
      );
  });
  view.querySelectorAll("[data-allocate]").forEach((b) => {
    b.onclick = () =>
      action(b, async () => {
        await api(`/admin/requests/${b.dataset.allocate}/allocate`, {
          method: "POST",
        });
        toast("Reassessment allocated in EOD.");
        render();
      });
  });
}

async function render() {
  const current = ++renderId;
  if (!user) {
    login();
    return;
  }
  const hash = location.hash.split("?")[0] || "#/home";
  const view = shell(hash);
  try {
    if (hash.startsWith("#/course/") && !isAdmin()) {
      await player(view, hash.split("/")[2]);
      return;
    }
    if (hash.startsWith("#/course-editor/") && isAdmin()) {
      await courseEditor(view, hash.split("/")[2], go);
      return;
    }
    const data = await api(isAdmin() ? "/admin/overview" : "/learn");
    if (current !== renderId || !view.isConnected) return;
    if (isAdmin()) adminView(view, data, hash);
    else learnerView(view, data, hash);
  } catch (err) {
    if (current !== renderId || !view.isConnected) return;
    view.innerHTML = `<div class="error-state"><span>${icon("book")}</span><h1>Let’s get you back on track.</h1><p>${esc(err.message)}</p><button class="button primary" id="retry">Try again</button><a class="button subtle" href="#/home">Learning home</a></div>`;
    view.querySelector("#retry").onclick = render;
  }
}
window.addEventListener("hashchange", render);
window.addEventListener("session-ended", () => {
  user = null;
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.getElementById("sidebar")?.classList.remove("open");
    document
      .getElementById("mobile-menu")
      ?.setAttribute("aria-expanded", "false");
  }
});
document.querySelector(".skip").onclick = (event) => {
  event.preventDefault();
  document.getElementById("main-content")?.focus();
};
try {
  const session = await api("/session");
  user = session.user;
  eodUrl = session.eod_web_url;
  await render();
} catch (err) {
  login(err.message);
}
