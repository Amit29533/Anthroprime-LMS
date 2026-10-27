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
import { courseOverview } from "./course-overview.js";
import { setupNavigation, closeNavigation, enterView, confirmNavigation, clearEditorGuard } from "./experience.js";

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
const brand = `<img class="brand-logo" src="/assets/anthroprime-logo.jpg" alt="" width="64" height="50"><span class="brand-name">Anthro<em>Prime</em><small>Learning</small></span>`;
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
  root.innerHTML = `<div class="workspace"><aside class="sidebar" id="sidebar"><button class="sidebar-close" id="sidebar-close" aria-label="Close navigation">${icon("close")}</button><a class="brand" href="#/home">${brand}</a>
    <nav aria-label="Primary navigation">${nav.map(([href, text, ico]) => `<a href="${href}" class="nav-item ${hash === href ? "active" : ""}" ${hash === href ? 'aria-current="page"' : ""}>${icon(ico)}<span>${text}</span>${hash === href ? '<span class="nav-dot"></span>' : ""}</a>`).join("")}</nav>
    <a class="sidebar-link" href="${esc(eodUrl)}" target="_blank" rel="noopener">Assessment platform ${icon("external")}</a>
    <div class="sidebar-profile"><span class="avatar">${esc(initials(user.name))}</span><div><strong>${esc(user.name)}</strong><small>${admin ? "Administrator" : "Candidate"}</small></div></div></aside><button class="nav-scrim" id="nav-scrim" aria-label="Close navigation" hidden></button>
    <div class="workspace-main"><header class="topbar"><div class="topbar-context"><button class="mobile-menu" id="mobile-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">☰</button></div><div class="topbar-tools"><button id="theme" class="round-button" aria-label="Switch to ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"} theme">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button><button id="header-logout" class="logout-button" type="button">${icon("logout")}<span>Log out</span></button></div></header><main id="main-content" tabindex="-1" aria-busy="true"><div class="page-loading" role="status">Loading…</div></main></div></div>`;
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
  root.innerHTML = `<main class="signin"><section class="signin-form"><div class="signin-form-inner"><span class="brand">${brand}</span><h1>Sign in</h1><p>Use your ECOD account. Training is by invitation.</p><form id="login-form">${field("Username or email", "username", "", { required: true, max: 200 })}${field("Password", "password", "", { type: "password", required: true })}${field("Authenticator code (if enabled)", "otp")}<p class="form-error" role="alert" ${message ? "" : "hidden"}>${esc(message)}</p><button class="button primary signin-submit" type="submit">Sign in</button></form><a href="${esc(eodUrl)}" class="text-link" target="_blank" rel="noopener">Open assessment platform ${icon("external")}</a></div></section></main>`;
  const form = document.getElementById("login-form");
  form.elements.username.autocomplete = "username";
  form.elements.password.autocomplete = "current-password";
  form.onsubmit = async (event) => {
    event.preventDefault();
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    b.textContent = "Signing in…";
    b.setAttribute("aria-busy", "true");
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
      error.tabIndex = -1;
      error.focus();
    } finally {
      b.disabled = false;
      b.removeAttribute("aria-busy");
      b.textContent = "Sign in";
    }
  };
}
function courseCard(course, index, enrollment, recommendation = false) {
  return `<article class="course-card"><div class="course-card-body"><div class="course-tags">${tag(course.level || "Foundation")}${recommendation && course.gap_names?.length ? tag("Recommended", "green") : ""}</div><h3>${esc(course.title)}</h3><p>${esc(course.summary)}</p>${course.gap_names?.length ? `<div class="gap-match">${icon("star")} Covers ${esc(course.gap_names.slice(0, 2).join(" & "))}</div>` : ""}<div class="course-meta"><span>${icon("clock")}${course.duration_minutes} min</span><span>${course.lesson_count} lessons</span></div>${enrollment ? `<div class="progress-label"><span>${enrollment.progress.complete ? "Completed" : `${enrollment.progress.completed}/${enrollment.progress.total} lessons`}</span><b>${enrollment.progress.percent}%</b></div>${progress(enrollment.progress.percent)}` : ""}<button class="button ${enrollment ? "primary" : "outline"} full" ${enrollment ? `data-open="${enrollment.id}"` : `data-enroll="${course.id}"`}>${enrollment ? (enrollment.progress.complete ? "Review" : enrollment.progress.completed ? "Continue" : "Start") : "Enroll"}</button></div></article>`;
}
function pathCard(path, index, enrolled) {
  const courses = enrolled
    ? enrolled.enrollments.map((e) => e.course)
    : path.courses;
  const next =
    enrolled?.enrollments.find((e) => !e.progress.complete) ||
    enrolled?.enrollments[0];
  return `<article class="path-card"><div class="path-rail">${icon("path")}<span>Learning path</span></div><div class="path-body"><h3>${esc(path.title)}</h3><p>${esc(path.summary)}</p><ol>${(courses || []).map((c) => `<li>${esc(c.title)}</li>`).join("")}</ol>${enrolled ? `<div class="progress-label"><span>${enrolled.completed_courses} of ${enrolled.enrollments.length} courses complete</span><b>${enrolled.percent}%</b></div>${progress(enrolled.percent, "Learning path progress")}` : ""}<button class="button ${enrolled ? "primary" : "outline"}" ${next ? `data-open="${next.id}"` : `data-path="${path.id}"`}>${enrolled ? "Continue path" : "Start path"}</button></div></article>`;
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
      ? "Course library"
      : hash === "#/learning"
        ? "My learning"
        : `Welcome, ${firstName(data.name)}`;
  view.innerHTML = `<div class="page-head"><h1>${esc(title)}</h1></div>`;
  if (hash === "#/results") {
    view.innerHTML = `<div class="page-head"><h1>My assessments</h1><a class="button outline" href="${esc(eodUrl)}" target="_blank" rel="noopener">Open EOD ${icon("external")}</a></div><div class="results-grid">${data.reports.map((report) => `<article class="report-card"><span class="label">Latest result</span><h2>${esc(report.role_name)}</h2><div class="report-score">${report.overall_pct}<small>%</small></div><h3>Focus areas</h3>${report.gaps.length ? report.gaps.map((gap) => `<div class="gap-row"><span>${esc(gap.name)}</span>${tag(`${gap.gap} level gap`, gap.severity === "critical_gap" ? "amber" : "")}</div>`).join("") : "<p>All competencies meet their targets.</p>"}<a class="button primary" href="#/catalog">Find courses</a></article>`).join("") || empty("No assessment yet", "Complete an EOD assessment to see results and recommendations.")}</div>`;
    return;
  }
  if (hash === "#/home") {
    view.innerHTML += `${continueCourse ? `<section class="continue-strip"><div><span class="label">Continue where you left off</span><strong>${esc(continueCourse.course.title)}</strong><div class="hero-progress">${progress(continueCourse.progress.percent)}<span>${continueCourse.progress.percent}%</span></div></div><button class="button primary" data-open="${continueCourse.id}">Continue</button></section>` : ""}    <div class="stats"><div><span class="stat-icon">${icon("book")}</span><strong>${active.length}</strong><span>In progress</span></div><div><span class="stat-icon green-text">${icon("check")}</span><strong>${completed.length}</strong><span>Completed</span></div><div><span class="stat-icon gold-text">${icon("path")}</span><strong>${enrolled.reduce((sum, e) => sum + e.progress.completed, 0)}</strong><span>Lessons completed</span></div></div>`;
  }
  if (hash === "#/catalog") {
    view.innerHTML += `<div class="library-toolbar"><label class="search"><span class="sr-only">Search courses and paths</span><input id="course-search" type="search" placeholder="Search courses" value="${esc(filter)}"></label><div class="tabs" aria-label="Content type">${[
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
      target.innerHTML = `${libraryType !== "paths" && selected.length ? `<div class="section-head"><h2>Courses</h2><span>${selected.length} courses</span></div><div class="course-grid">${selected.map((c, i) => courseCard(c, i, courseMap.get(c.id), true)).join("")}</div>` : ""}${
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
            ? "Try a different search."
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
  if (hash === "#/learning") {
    view.innerHTML += `${data.path_enrollments.length ? `<div class="section-head"><h2>Paths</h2></div><div class="path-grid">${data.path_enrollments.map((p, i) => pathCard(p.path, i, p)).join("")}</div>` : ""}<div class="section-head"><h2>Courses</h2><span>${enrolled.length} enrolled</span></div><div class="course-grid">${enrolled.map((e, i) => courseCard(e.course, i, e)).join("") || empty("No courses yet", "Courses assigned to you will appear here.")}</div>`;
  } else {
    const recommended = courses
      .filter((c) => !courseMap.get(c.id)?.progress.complete)
      .slice(0, 3);
    view.innerHTML += `<div class="section-head"><h2>Recommended</h2><a href="#/catalog" class="text-link">View all</a></div><div class="course-grid">${
      recommended
        .map((c, i) => courseCard(c, i, courseMap.get(c.id), true))
        .join("") ||
      (enrolled.length
        ? enrolled
            .slice(0, 3)
            .map((e, i) => courseCard(e.course, i, e))
            .join("")
        : empty(
            "No courses yet",
            "Complete an EOD assessment, or ask your administrator to assign a course.",
          ))
    }</div>${
      paths.length
        ? `<div class="section-head"><h2>Learning paths</h2><a href="#/catalog" class="text-link">View all</a></div><div class="path-grid">${paths
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
      else await courseOverview(view, hash.split("/")[2]);
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
