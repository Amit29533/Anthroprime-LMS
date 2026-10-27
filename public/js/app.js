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
import { trainingDashboard } from "./training.js";
import { player, closeLearningWindow } from "./player.js";
import { courseOverview, hours } from "./course-overview.js";
import { cover, courseCode } from "./covers.js";
import { setupNavigation, closeNavigation, enterView, confirmNavigation, clearEditorGuard } from "./experience.js";

let user = null;
let eodUrl = "";
let renderId = 0;
let filter = "";
let libraryType = "all";
let learningFilter = "all";
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
const brand = `<img class="brand-logo" src="/assets/anthroprime-logo.jpg" alt="" width="64" height="50"><span class="brand-name">Anthro<em>Prime</em><small>ECOD · Learning</small></span>`;
const isAdmin = () => user?.role === "admin";
const empty = (title, text) =>
  `<div class="empty"><span class="empty-icon">${icon("book")}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
const kindLabel = (kind) =>
  ({ article: "Read", video: "Watch", resource: "Explore", quiz: "Practice" })[
    kind
  ];

function themeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  return `<button id="theme" class="round-button" aria-label="Switch to ${dark ? "light" : "dark"} theme">${icon(dark ? "sun" : "moon")}</button>`;
}
function learnerShell(hash) {
  const nav = [
    ["#/home", "Home", "home"],
    ["#/learning", "My learning", "path"],
    ["#/catalog", "Library", "book"],
    ["#/results", "Assessments", "chart"],
  ];
  return `<div class="workspace learner"><header class="lx-top"><div class="lx-top-inner"><button class="mobile-menu" id="mobile-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon("menu")}</button><a class="brand" href="#/home" aria-label="ECOD Learning home">${brand}</a>
    <aside class="lx-nav" id="sidebar" aria-label="Navigation"><div class="lx-nav-head"><span class="brand">${brand}</span><button class="sidebar-close" id="sidebar-close" aria-label="Close navigation">${icon("close")}</button></div><nav aria-label="Primary navigation">${nav.map(([href, text, ico]) => `<a href="${href}" class="nav-item ${hash === href ? "active" : ""}" ${hash === href ? 'aria-current="page"' : ""}>${icon(ico)}<span>${text}</span></a>`).join("")}</nav><a class="lx-nav-ext" href="${esc(eodUrl)}" target="_blank" rel="noopener">${icon("external")}<span>ECOD assessment platform</span></a></aside>
    <div class="lx-tools">${themeButton()}<span class="lx-profile" title="${esc(user.name)}"><span class="avatar">${esc(initials(user.name))}</span><span class="lx-profile-name">${esc(firstName(user.name))}</span></span><button id="header-logout" class="logout-button" type="button">${icon("logout")}<span>Log out</span></button></div></div></header><button class="nav-scrim" id="nav-scrim" aria-label="Close navigation" hidden></button>
    <div class="workspace-main"><main id="main-content" tabindex="-1" aria-busy="true"><div class="page-loading" role="status">Loading…</div></main></div></div>`;
}
function shell(hash) {
  const admin = isAdmin();
  const nav = admin
    ? [
        ["#/home", "Overview", "home"],
        ["#/studio", "Course studio", "book"],
        ["#/paths", "Learning paths", "path"],
        ["#/learners", "Learners", "users"],
        ["#/training", "Training Dashboard", "chart"],
        ["#/requests", "Reassessment", "chart"],
        ["#/activity", "Activity log", "clock"],
      ]
    : [
        ["#/home", "Learning home", "home"],
        ["#/catalog", "Course library", "book"],
        ["#/learning", "My learning", "path"],
        ["#/results", "My assessments", "chart"],
      ];
  if (!admin) root.innerHTML = learnerShell(hash);
  else root.innerHTML = `<div class="workspace"><aside class="sidebar" id="sidebar"><button class="sidebar-close" id="sidebar-close" aria-label="Close navigation">${icon("close")}</button><a class="brand" href="#/home">${brand}</a>
    <nav aria-label="Primary navigation">${nav.map(([href, text, ico]) => `<a href="${href}" class="nav-item ${hash === href ? "active" : ""}" ${hash === href ? 'aria-current="page"' : ""}>${icon(ico)}<span>${text}</span>${hash === href ? '<span class="nav-dot"></span>' : ""}</a>`).join("")}</nav>
    <a class="sidebar-link" href="${esc(eodUrl)}" target="_blank" rel="noopener">Assessment platform ${icon("external")}</a>
    <div class="sidebar-profile"><span class="avatar">${esc(initials(user.name))}</span><div><strong>${esc(user.name)}</strong><small>${admin ? "Administrator" : "Candidate"}</small></div></div></aside><button class="nav-scrim" id="nav-scrim" aria-label="Close navigation" hidden></button>
    <div class="workspace-main"><header class="topbar"><div class="topbar-context"><button class="mobile-menu" id="mobile-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">☰</button></div><div class="topbar-tools">${themeButton()}<button id="header-logout" class="logout-button" type="button">${icon("logout")}<span>Log out</span></button></div></header><main id="main-content" tabindex="-1" aria-busy="true"><div class="page-loading" role="status">Loading…</div></main></div></div>`;
  const signOut = async (event) => {
    const button = event.currentTarget;
    if (!(await confirmNavigation("#/"))) return;
    return action(button, async () => {
      button.textContent = "Signing out…";
      await api("/logout", { method: "POST" });
      user = null;
      go("#/");
    });
  };
  document.getElementById("header-logout").onclick = signOut;
  document.getElementById("theme").onclick = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.getElementById("theme").innerHTML = icon(next === "dark" ? "sun" : "moon");
    document.getElementById("theme").setAttribute("aria-label", `Switch to ${next === "dark" ? "light" : "dark"} theme`);
    document.querySelector('meta[name="theme-color"]').content =
      next === "dark" ? "#15161b" : "#f5f4f1";
    try {
      localStorage.setItem("lms-theme", next);
    } catch {
      /* Optional persistence. */
    }
  };
  setupNavigation(root);
  return document.getElementById("main-content");
}
function login(message = "") {
  closeNavigation();
  closeLearningWindow();
  clearEditorGuard();
  document.title = "Sign in · ECOD Learning";
  root.innerHTML = `<main class="signin" id="main-content"><section class="signin-aside" aria-hidden="true"><span class="brand on-dark">${brand}</span><div class="signin-pitch"><span class="signin-kicker">ECOD Learning</span><h2>Build the skills your next assessment looks for.</h2><p>Focused courses, short knowledge checks and progress that saves itself, all with your ECOD account.</p><ul class="signin-points"><li>${icon("book")}<div><strong>Structured courses</strong><span>Clear modules, one lesson at a time.</span></div></li><li>${icon("help")}<div><strong>Knowledge checks</strong><span>Three quick questions after each lesson, with explanations.</span></div></li><li>${icon("chart")}<div><strong>Progress you can see</strong><span>Pick up exactly where you left off.</span></div></li></ul></div><p class="signin-foot">Part of ECOD · Enterprise Capability on Demand by AnthroPrime</p></section>
    <section class="signin-form"><div class="signin-form-inner"><span class="brand signin-mobile-brand">${brand}</span><h1>Welcome back</h1><p class="signin-lead">Sign in with your ECOD username or email.</p><form id="login-form" novalidate><label class="field"><span>Username or email</span><input name="username" required maxlength="200" autocomplete="username" autocapitalize="none" spellcheck="false"></label><label class="field"><span>Password</span><span class="password-wrap"><input name="password" type="password" required maxlength="200" autocomplete="current-password"><button type="button" class="password-toggle" id="password-toggle" aria-label="Show password" aria-pressed="false">${icon("eye")}</button></span></label><details class="otp-toggle"><summary>I use an authenticator app</summary><label class="field"><span>Authenticator code</span><input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="100" placeholder="6-digit code"></label></details><p class="form-error" role="alert" ${message ? "" : "hidden"}>${esc(message)}</p><button class="button primary signin-submit" type="submit">Sign in ${icon("arrow")}</button></form><div class="signin-help"><p>${icon("shield")}<span>Training is by invitation. If you can’t sign in, ask your ECOD administrator for access.</span></p><a href="${esc(eodUrl)}" class="text-link" target="_blank" rel="noopener">Go to the ECOD assessment platform ${icon("external")}</a></div></div></section></main>`;
  const form = document.getElementById("login-form");
  const toggle = document.getElementById("password-toggle");
  toggle.onclick = () => {
    const show = form.elements.password.type === "password";
    form.elements.password.type = show ? "text" : "password";
    toggle.innerHTML = icon(show ? "eyeOff" : "eye");
    toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(show));
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const b = form.querySelector("[type=submit]");
    const error = form.querySelector(".form-error");
    if (!form.elements.username.value.trim() || !form.elements.password.value) {
      error.textContent = "Enter your username or email and your password.";
      error.hidden = false;
      (form.elements.username.value.trim() ? form.elements.password : form.elements.username).focus();
      return;
    }
    b.disabled = true;
    b.textContent = "Signing in…";
    b.setAttribute("aria-busy", "true");
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
      error.tabIndex = -1;
      error.focus();
    } finally {
      b.disabled = false;
      b.removeAttribute("aria-busy");
      b.innerHTML = `Sign in ${icon("arrow")}`;
    }
  };
}
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};
const lessonLink = (enrollment) =>
  enrollment.progress.next_lesson_id && !enrollment.progress.complete
    ? `#/course/${enrollment.id}?lesson=${encodeURIComponent(enrollment.progress.next_lesson_id)}`
    : `#/course/${enrollment.id}`;
function courseCard(course, index, enrollment, recommendation = false) {
  const state = enrollment
    ? enrollment.progress.complete ? ["Completed", "green"] : enrollment.progress.completed ? ["In progress", "blue"] : ["Not started", ""]
    : recommendation && course.gap_names?.length ? ["Recommended", "gold"] : null;
  return `<article class="course-card">${cover(course.id, courseCode(course.title))}<div class="course-card-body"><div class="course-tags">${state ? tag(state[0], state[1]) : ""}${course.level ? tag(course.level[0].toUpperCase() + course.level.slice(1)) : ""}</div><h3>${esc(course.title)}</h3><p>${esc(course.summary)}</p>${course.gap_names?.length ? `<div class="gap-match">${icon("target")} Builds ${esc(course.gap_names.slice(0, 2).join(" & "))}</div>` : ""}<div class="course-meta"><span>${icon("doc")}${course.lesson_count} lessons</span><span>${icon("clock")}${hours(course.duration_minutes)}</span></div>${enrollment ? `<div class="card-progress">${progress(enrollment.progress.percent)}<span>${enrollment.progress.percent}%</span></div>` : ""}<button class="button ${enrollment ? "primary" : "outline"} full" ${enrollment ? `data-open="${enrollment.id}"` : `data-enroll="${course.id}"`}>${enrollment ? (enrollment.progress.complete ? "Review course" : enrollment.progress.completed ? "Continue" : "Start course") : "Enroll"}</button></div></article>`;
}
function pathCard(path, index, enrolled) {
  const courses = enrolled
    ? enrolled.enrollments.map((e) => e.course)
    : path.courses;
  const next =
    enrolled?.enrollments.find((e) => !e.progress.complete) ||
    enrolled?.enrollments[0];
  return `<article class="path-card"><div class="path-rail">${icon("path")}<span>Learning path · ${(courses || []).length} courses</span></div><div class="path-body"><h3>${esc(path.title)}</h3><p>${esc(path.summary)}</p><ol>${(courses || []).map((c) => `<li>${esc(c.title)}</li>`).join("")}</ol>${enrolled ? `<div class="progress-label"><span>${enrolled.completed_courses} of ${enrolled.enrollments.length} courses complete</span><b>${enrolled.percent}%</b></div>${progress(enrolled.percent, "Learning path progress")}` : ""}<button class="button ${enrolled ? "primary" : "outline"}" ${next ? `data-open="${next.id}"` : `data-path="${path.id}"`}>${enrolled ? "Continue path" : "Start path"}</button></div></article>`;
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
const grid = (cards, emptyTitle, emptyText) => `<div class="course-grid">${cards || empty(emptyTitle, emptyText)}</div>`;
function learnerView(view, data, hash) {
  const { enrollments: enrolled, courses, paths } = data;
  const courseMap = new Map(enrolled.map((e) => [e.course_id, e]));
  const active = enrolled.filter((e) => !e.progress.complete);
  const completed = enrolled.filter((e) => e.progress.complete);
  const continueCourse =
    active.find((e) => e.progress.completed > 0) || active[0];
  if (hash === "#/results") {
    view.innerHTML = `<div class="page-head learner-head"><div><h1>My assessments</h1><p>Your latest ECOD results and the areas to focus on next.</p></div><a class="button outline" href="${esc(eodUrl)}" target="_blank" rel="noopener">Open ECOD ${icon("external")}</a></div><div class="results-grid">${data.reports.map((report) => `<article class="report-card"><span class="label">Latest result</span><h2>${esc(report.role_name)}</h2><div class="report-score">${report.overall_pct}<small>%</small></div><h3>Focus areas</h3>${report.gaps.length ? report.gaps.map((gap) => `<div class="gap-row"><span>${esc(gap.name)}</span>${tag(`${gap.gap} level gap`, gap.severity === "critical_gap" ? "amber" : "")}</div>`).join("") : "<p>All competencies meet their targets.</p>"}<a class="button primary" href="#/catalog">Find courses</a></article>`).join("") || empty("No assessment results yet", "Once you complete an ECOD assessment, your results and recommended courses appear here.")}</div>`;
    return;
  }
  if (hash === "#/home") {
    const lessonsDone = enrolled.reduce((sum, e) => sum + e.progress.completed, 0);
    view.innerHTML = `<section class="home-hero"><p class="home-date">${esc(new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date()))}</p><h1>${greeting()}, ${esc(firstName(data.name))}</h1><p>${active.length ? `You have ${active.length} course${active.length === 1 ? "" : "s"} in progress. Small steps every day add up.` : completed.length ? "You’re all caught up. Explore the library for your next course." : "Your assigned courses will appear here."}</p></section>
      ${continueCourse ? `<section class="continue-card">${cover(continueCourse.course.id, courseCode(continueCourse.course.title))}<div class="continue-body"><span class="label">${continueCourse.progress.completed ? "Continue learning" : "Ready to start"}</span><h2>${esc(continueCourse.course.title)}</h2>${continueCourse.progress.next_lesson_title ? `<p class="continue-next">${icon("doc")}<span>Next: <strong>${esc(continueCourse.progress.next_lesson_title)}</strong></span></p>` : ""}<div class="card-progress">${progress(continueCourse.progress.percent)}<span>${continueCourse.progress.percent}%</span></div><p class="continue-count">${continueCourse.progress.completed} of ${continueCourse.progress.total} lessons complete</p><div class="continue-actions"><a class="button primary large" href="${lessonLink(continueCourse)}">${continueCourse.progress.completed ? "Continue" : "Start learning"} ${icon("arrow")}</a><button class="button outline" data-open="${continueCourse.id}">Course overview</button></div></div></section>` : ""}
      <div class="stats"><div><span class="stat-icon">${icon("book")}</span><strong>${active.length}</strong><span>In progress</span></div><div><span class="stat-icon green-text">${icon("checkCircle")}</span><strong>${completed.length}</strong><span>Completed</span></div><div><span class="stat-icon gold-text">${icon("doc")}</span><strong>${lessonsDone}</strong><span>Lessons completed</span></div></div>`;
    if (enrolled.length > (continueCourse ? 1 : 0))
      view.innerHTML += `<div class="section-head"><h2>My courses</h2><a href="#/learning" class="text-link">View all</a></div>${grid(enrolled.slice(0, 3).map((e, i) => courseCard(e.course, i, e)).join(""))}`;
    const recommended = courses.filter((c) => !courseMap.has(c.id)).slice(0, 3);
    if (recommended.length)
      view.innerHTML += `<div class="section-head"><h2>Recommended for you</h2><a href="#/catalog" class="text-link">Browse library</a></div>${grid(recommended.map((c, i) => courseCard(c, i, null, true)).join(""))}`;
    if (!enrolled.length && !recommended.length)
      view.innerHTML += empty("No courses yet", "Your administrator will assign courses to you. They’ll appear here as soon as they do.");
    if (paths.length)
      view.innerHTML += `<div class="section-head"><h2>Learning paths</h2><a href="#/catalog" class="text-link">View all</a></div><div class="path-grid">${paths.slice(0, 2).map((p, i) => pathCard(p, i, data.path_enrollments.find((e) => e.path.id === p.id))).join("")}</div>`;
    wireLearning(view);
    return;
  }
  if (hash === "#/catalog") {
    view.innerHTML = `<div class="page-head learner-head"><div><h1>Library</h1><p>Every course and learning path available to you.</p></div></div><div class="library-toolbar"><label class="search">${icon("search")}<span class="sr-only">Search courses and paths</span><input id="course-search" type="search" placeholder="Search by title or skill" value="${esc(filter)}"></label><div class="tabs" aria-label="Content type">${[
      ["all", "All"],
      ["courses", "Courses"],
      ["paths", "Paths"],
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
      target.innerHTML = `${libraryType !== "paths" && selected.length ? `<div class="section-head"><h2>Courses</h2><span>${selected.length} course${selected.length === 1 ? "" : "s"}</span></div><div class="course-grid">${selected.map((c, i) => courseCard(c, i, courseMap.get(c.id), true)).join("")}</div>` : ""}${
        libraryType !== "courses" && selectedPaths.length
          ? `<div class="section-head"><h2>Learning paths</h2></div><div class="path-grid">${selectedPaths
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
          q ? "No matches" : "No courses yet",
          q
            ? "Try a different word, or clear the search."
            : "Your administrator will assign courses here.",
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
  // #/learning: everything assigned to this candidate, filterable by status.
  const groups = {
    all: enrolled,
    progress: enrolled.filter((e) => !e.progress.complete && e.progress.completed),
    new: enrolled.filter((e) => !e.progress.completed),
    done: completed,
  };
  view.innerHTML = `<div class="page-head learner-head"><div><h1>My learning</h1><p>Courses assigned to you, with your progress.</p></div></div><div class="tabs status-tabs" aria-label="Filter by status">${[["all", "All"], ["progress", "In progress"], ["new", "Not started"], ["done", "Completed"]].map(([key, text]) => `<button data-status="${key}" class="${learningFilter === key ? "active" : ""}" aria-pressed="${learningFilter === key}">${text}<span class="count">${groups[key].length}</span></button>`).join("")}</div><div id="learning-results"></div>${data.path_enrollments.length ? `<div class="section-head"><h2>Learning paths</h2></div><div class="path-grid">${data.path_enrollments.map((p, i) => pathCard(p.path, i, p)).join("")}</div>` : ""}`;
  const paint = () => {
    const target = view.querySelector("#learning-results");
    target.innerHTML = grid(groups[learningFilter].map((e, i) => courseCard(e.course, i, e)).join(""), learningFilter === "all" ? "No courses yet" : "Nothing here", learningFilter === "all" ? "Courses assigned to you will appear here." : "No courses match this filter right now.");
    wireLearning(target);
  };
  view.querySelectorAll("[data-status]").forEach((b) => {
    b.onclick = () => {
      learningFilter = b.dataset.status;
      view.querySelectorAll("[data-status]").forEach((other) => { other.classList.toggle("active", other === b); other.setAttribute("aria-pressed", String(other === b)); });
      paint();
    };
  });
  paint();
  wireLearning(view);
}

function assignment(data, preset = null) {
  const candidates = data.candidates.filter((c) => c.training_access);
  const options = [
    ...data.courses
      .filter((c) => c.status === "published")
      .map((c) => ({ key: `course:${c.id}`, label: `Course · ${c.title}` })),
    ...data.paths
      .filter((p) => p.status === "published")
      .map((p) => ({ key: `path:${p.id}`, label: `Path · ${p.title}` })),
  ];
  if (!options.length || !candidates.length)
    return toast(
      "Publish a course and invite a candidate from Training Dashboard before assigning.",
      true,
    );
  dialog(
    "Assign learning",
    `<p class="dialog-intro">Give a candidate a focused next step. Existing progress is preserved.</p><label class="field"><span>Candidate</span><select name="candidate_id" required><option value="">Choose a candidate</option>${candidates.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><label class="field"><span>Course or learning path</span><select name="item" required>${options.map((o) => `<option value="${o.key}" ${o.key === preset ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`,
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
    "#/home": ["", "Overview", ""],
    "#/studio": ["", "Courses", ""],
    "#/paths": [
      "CONNECT THE NEXT STEPS",
      "Learning with direction.",
      "Sequence courses into a purposeful development journey.",
    ],
    "#/learners": ["", "Learners", ""],
    "#/requests": ["", "Reassessment requests", ""],
    "#/activity": ["", "Activity log", ""],
  };
  const [, title] = titles[hash] || titles["#/home"];
  view.innerHTML = `<div class="page-head"><h1>${title}</h1><div class="head-actions"><button class="button outline" id="assign-learning">Assign learning</button>${hash === "#/paths" ? '<button class="button primary" id="new-path">' + icon("plus") + " New path</button>" : '<a href="#/course-editor/new" class="button primary">' + icon("plus") + " Create course</a>"}</div></div>`;
  if (hash === "#/home") {
    view.innerHTML += `<div class="stats four"><div><span class="stat-icon">${icon("book")}</span><strong>${published.length}</strong><span>Published courses</span></div><div><span class="stat-icon">${icon("users")}</span><strong>${new Set(data.enrollments.map((e) => e.learner_id)).size}</strong><span>Learners</span></div><div><span class="stat-icon green-text">${icon("check")}</span><strong>${complete}</strong><span>Completions</span></div><div><span class="stat-icon gold-text">${icon("chart")}</span><strong>${requests.length}</strong><span>Reassessment requests</span></div></div><div class="section-head"><h2>Courses</h2><a class="text-link" href="#/studio">Manage</a></div>`;
  }
  if (["#/home", "#/studio"].includes(hash)) {
    view.innerHTML += `<div class="studio-grid">${data.courses.map((c, i) => `<article class="studio-card"><div class="studio-card-body">${tag(c.status, c.status === "published" ? "green" : "")}<h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><div class="course-meta"><span>${c.lesson_count} lessons</span><span>${c.duration_minutes} min</span></div><div class="studio-actions"><a class="button outline" href="#/course-editor/${c.id}">Edit</a>${c.status === "published" ? `<button class="button subtle" data-assign="course:${c.id}">Assign</button>` : ""}</div></div></article>`).join("") || empty("No courses yet", "Create a course to get started.")}</div>`;
  }
  if (hash === "#/paths")
    view.innerHTML += `<div class="path-grid">${data.paths.map((p, i) => `<article class="path-card"><div class="path-rail">${icon("path")}<span>${esc(p.status)}</span></div><div class="path-body"><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><ol>${p.course_ids.map((id) => `<li>${esc(data.courses.find((c) => c.id === id)?.title || "Unavailable course")}</li>`).join("")}</ol><button class="button outline" data-edit-path="${p.id}">Edit</button>${p.status === "published" ? `<button class="button subtle" data-assign="path:${p.id}">Assign</button>` : ""}</div></article>`).join("") || empty("No paths yet", "Group published courses into an ordered path.")}</div>`;
  if (hash === "#/learners")
    view.innerHTML += `<div class="table-wrap"><table><caption>Learning assignments</caption><thead><tr><th>Candidate</th><th>Course</th><th>Progress</th><th>Status</th></tr></thead><tbody>${data.enrollments.map((e) => `<tr><td><strong>${esc(e.learner_name)}</strong></td><td>${esc(e.course.title)}</td><td><div class="table-progress">${progress(e.progress.percent)}<span>${e.progress.percent}%</span></div></td><td>${tag(e.progress.complete ? "Completed" : e.progress.completed ? "In progress" : "Assigned", e.progress.complete ? "green" : "")}</td></tr>`).join("")}</tbody></table>${data.enrollments.length ? "" : empty("No assignments yet", "Assign a course or path to a candidate.")}</div>`;
  if (hash === "#/requests")
    view.innerHTML += `<div class="table-wrap"><table><caption>Candidate reassessment requests</caption><thead><tr><th>Candidate</th><th>Completed learning</th><th>Requested</th><th>Next step</th></tr></thead><tbody>${data.requests.map((r) => `<tr><td><strong>${esc(r.learner_name)}</strong></td><td>${esc(r.course_title)}</td><td>${formatDate(r.created_at)}</td><td>${r.assessment_id ? `<a class="button subtle" href="${esc(eodUrl)}/#/assessments" target="_blank" rel="noopener">Allocated in EOD ${icon("external")}</a>` : `<button class="button primary small" data-allocate="${r.id}">Allocate reassessment</button>`}</td></tr>`).join("")}</tbody></table>${data.requests.length ? "" : empty("No requests", "Requests appear when learners finish a course.")}</div>`;
  if (hash === "#/activity")
    view.innerHTML += `<div class="activity-list">${data.audit.map((a) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${esc(a.action.replaceAll("_", " "))}</strong><p>${esc(a.actor_name)}${a.details.title || a.details.course ? ` · ${esc(a.details.title || a.details.course)}` : ""}</p></div><time>${formatDate(a.created_at)}</time></div>`).join("") || empty("No activity yet", "Course edits and learner progress appear here.")}</div>`;
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
  if (!(await confirmNavigation(location.hash)) || current !== renderId) return;
  const hash = location.hash.split("?")[0] || "#/home";
  const allowed = isAdmin() ? ["#/home", "#/studio", "#/paths", "#/learners", "#/training", "#/requests", "#/activity"] : ["#/home", "#/catalog", "#/learning", "#/results"];
  if (!allowed.includes(hash) && !(isAdmin() ? /^#\/course-editor\/[a-zA-Z0-9_-]+$/.test(hash) : /^#\/course\/[a-zA-Z0-9_-]+$/.test(hash))) { go("#/home"); return; }
  closeLearningWindow();
  const view = shell(hash);
  try {
    if (hash.startsWith("#/course/") && !isAdmin()) {
      if (new URLSearchParams(location.hash.split("?")[1] || "").has("lesson")) await player(view, hash.split("/")[2], { eodUrl });
      else await courseOverview(view, hash.split("/")[2], { eodUrl });
      enterView(view);
      return;
    }
    if (hash.startsWith("#/course-editor/") && isAdmin()) {
      await courseEditor(view, hash.split("/")[2], go);
      enterView(view);
      return;
    }
    if (isAdmin() && hash === "#/training") {
      await trainingDashboard(view, { api, esc });
      enterView(view);
      return;
    }
    const data = await api(isAdmin() ? "/admin/overview" : "/learn");
    if (current !== renderId || !view.isConnected) return;
    if (isAdmin()) adminView(view, data, hash);
    else learnerView(view, data, hash);
    enterView(view);
  } catch (err) {
    if (current !== renderId || !view.isConnected) return;
    view.innerHTML = `<div class="error-state"><span>${icon("book")}</span><h1>Let’s get you back on track.</h1><p>${esc(err.message)}</p><button class="button primary" id="retry">Try again</button><a class="button subtle" href="#/home">Learning home</a></div>`;
    view.removeAttribute("aria-busy");
    view.querySelector("#retry").onclick = render;
  }
}
window.addEventListener("hashchange", render);
window.addEventListener("session-ended", (event) => {
  user = null;
  renderId += 1;
  eodUrl = event.detail?.eodUrl || eodUrl;
  login(event.detail?.message || "Your session ended. Sign in again to continue.");
});
window.addEventListener("offline", () => toast("You’re offline. Progress already saved is safe; reconnect before submitting.", true));
window.addEventListener("online", () => toast("You’re back online. You can continue learning."));
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
  eodUrl = err.eodUrl || eodUrl;
  login(err.message);
}
