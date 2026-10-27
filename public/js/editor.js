import { api, esc, icon, field, toast } from "./ui.js";
import { registerEditorGuard } from "./experience.js";

const question = () => ({
  id: crypto.randomUUID(),
  prompt: "",
  options: ["a", "b", "c", "d"].map((id) => ({ id, label: "" })),
  correct_option_id: "a",
  explanation: "",
});
const lesson = () => ({
  id: crypto.randomUUID(),
  title: "",
  kind: "article",
  minutes: 8,
  body: "",
  resource_url: "",
});
const module = () => ({
  id: crypto.randomUUID(),
  title: "",
  lessons: [lesson()],
});
export async function courseEditor(view, id, go) {
  const overview = await api("/admin/overview");
  const course =
    id === "new"
      ? {
          title: "",
          summary: "",
          role_id: overview.tracks[0]?.id || "",
          level: "foundation",
          status: "draft",
          outcomes: [],
          competency_ids: [],
          curriculum: [module()],
        }
      : structuredClone((await api(`/admin/courses/${id}`)).course);
  if (!view.isConnected) return;
  const openModules = new Set([course.curriculum[0]?.id]);
  const openLessons = new Set(id === "new" ? [course.curriculum[0]?.lessons[0]?.id] : []);
  const requestId = crypto.randomUUID();
  let competencies = [];
  let dirty = false;
  let saving = false;
  const markDirty = () => {
    dirty = true;
    const indicator = view.querySelector("#editor-save-state");
    if (indicator) { indicator.textContent = "Unsaved changes"; indicator.classList.add("is-dirty"); }
  };
  const unload = (event) => {
    if (dirty && view.isConnected) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", unload);
  const removeUnload = () => {
    window.removeEventListener("beforeunload", unload);
  };
  registerEditorGuard(() => dirty && view.isConnected, removeUnload, () => saving);
  const loadCompetencies = async () => {
    competencies = course.role_id
      ? (await api(`/admin/tracks/${course.role_id}`)).competencies
      : [];
  };
  await loadCompetencies();
  const paint = () => {
    if (!view.isConnected) return;
    view.innerHTML = `<a class="breadcrumb" href="#/studio">← Back to course studio</a><div class="page-head"><div><h1>${id === "new" ? "New course" : "Edit course"}</h1><p>Assigned learners keep their version; changes apply to new enrollments.</p><p id="editor-save-state" class="editor-save-state ${dirty ? "is-dirty" : ""}" role="status">${dirty ? "Unsaved changes" : id === "new" ? "New draft · not saved yet" : `Version ${course.version} · ${course.status}`}</p></div><div class="head-actions"><button id="save-draft" class="button outline">Save draft</button><button id="publish-course" class="button primary">Publish course ${icon("arrow")}</button></div></div><p class="editor-error form-error" role="alert" hidden></p><div class="editor-layout"><div class="editor-main"><section class="editor-panel"><h2>Details</h2>${field("Course title", "title", course.title, { required: true, max: 160 })}${field("Short description", "summary", course.summary, { area: true, required: true, rows: 3 })}${field("What will learners be able to do? One outcome per line.", "outcomes", course.outcomes.join("\n"), { area: true, rows: 3 })}</section><section class="editor-panel"><h2>Curriculum</h2><p class="help">Lessons unlock in order.</p><div id="modules">${course.curriculum
      .map(
        (m, mi) =>
          `<details class="module-editor" data-module="${mi}" ${openModules.has(m.id) ? "open" : ""}><summary class="module-summary"><span>Module ${mi + 1}</span><strong data-module-summary="${mi}">${esc(m.title || "Untitled module")}</strong><small>${m.lessons.length} lessons</small></summary><div class="module-editor-content"><div class="module-title-row"><span class="module-count">${String(mi + 1).padStart(2, "0")}</span><label class="field grow"><span>Module title</span><input data-module-title="${mi}" value="${esc(m.title)}" placeholder="e.g. Understand the foundations" maxlength="160"></label><button class="remove" data-remove-module="${mi}" aria-label="Remove module ${mi + 1}">×</button></div>${m.lessons
            .map(
              (l, li) =>
                `<details class="lesson-editor" data-lesson-editor="${mi}:${li}" ${openLessons.has(l.id) ? "open" : ""}><summary class="lesson-summary"><span>Lesson ${li + 1}</span><strong data-lesson-summary>${esc(l.title || "Untitled lesson")}</strong><small>${l.quiz ? `${l.quiz.questions.length} MCQs` : l.kind}</small></summary><div class="lesson-editor-content"><div class="lesson-editor-head"><b>Lesson ${li + 1}</b><button class="remove" data-remove-lesson="${mi}:${li}" aria-label="Remove lesson ${li + 1}">×</button></div><label class="field"><span>Lesson title</span><input data-prop="title" value="${esc(l.title)}" maxlength="160"></label><div class="form-row"><label class="field"><span>Lesson type</span><select data-prop="kind">${[
                  ["article", "Article / reading"],
                  ["video", "Video"],
                  ["resource", "External resource"],
                  ["quiz", "Practice quiz"],
                ]
                  .map(
                    ([kind, text]) =>
                      `<option value="${kind}" ${l.kind === kind ? "selected" : ""}>${text}</option>`,
                  )
                  .join(
                    "",
                  )}</select></label><label class="field"><span>Estimated minutes</span><input data-prop="minutes" type="number" min="1" max="240" value="${l.minutes}"></label></div><label class="field"><span>${l.kind === "article" ? "Lesson content" : "Introduction or instructions"}</span><textarea data-prop="body" rows="${l.kind === "article" ? 9 : 3}" maxlength="30000">${esc(l.body)}</textarea></label>${["video", "resource"].includes(l.kind) ? `<label class="field"><span>${l.kind === "video" ? "Video file or resource URL (HTTPS)" : "Resource URL (HTTPS)"}</span><input data-prop="resource_url" type="url" value="${esc(l.resource_url)}"></label>` : ""}${l.kind !== "quiz" ? `<label class="field"><span><input type="checkbox" data-lesson-check ${l.quiz ? "checked" : ""}> Require a practice check after this lesson</span></label>` : ""}${l.quiz ? `<div class="quiz-editor"><label class="field"><span>Pass mark (%)</span><input data-pass type="number" min="1" max="100" value="${l.quiz.pass_percent}"></label>${l.quiz.questions.map((q, qi) => `<fieldset class="question-editor" data-question="${qi}"><legend>Practice question ${qi + 1}</legend><label class="field"><span>Question</span><textarea data-q-prop="prompt" rows="2">${esc(q.prompt)}</textarea></label>${q.options.map((o, oi) => `<label class="field option-field"><span>Option ${String.fromCharCode(65 + oi)}</span><input data-option="${oi}" value="${esc(o.label)}" maxlength="500"></label>`).join("")}<label class="field"><span>Correct answer</span><select data-q-prop="correct_option_id">${q.options.map((o, oi) => `<option value="${o.id}" ${o.id === q.correct_option_id ? "selected" : ""}>Option ${String.fromCharCode(65 + oi)}</option>`).join("")}</select></label><label class="field"><span>Explain the answer</span><textarea data-q-prop="explanation" rows="3">${esc(q.explanation)}</textarea></label><button class="button subtle small" data-remove-question="${mi}:${li}:${qi}">Remove question</button></fieldset>`).join("")}<button class="button outline small" data-add-question="${mi}:${li}" ${l.quiz.questions.length >= 10 ? "disabled" : ""}>${icon("plus")} Add practice question</button></div>` : ""}</div></details>`,
            )
            .join(
              "",
            )}<button class="button outline small" data-add-lesson="${mi}">${icon("plus")} Add lesson</button></div></details>`,
      )
      .join(
        "",
      )}</div><button class="button outline" id="add-module">${icon("plus")} Add module</button></section></div><aside class="editor-aside"><section class="editor-panel"><h3>Track &amp; capabilities</h3><label class="field"><span>Assessment track</span><select id="course-track">${overview.tracks.map((r) => `<option value="${r.id}" ${course.role_id === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label><label class="field"><span>Course level</span><select id="course-level">${["foundation", "intermediate", "advanced"].map((level) => `<option ${course.level === level ? "selected" : ""}>${level}</option>`).join("")}</select></label><h4>Capabilities developed</h4><p class="help">Matching assessment gaps will recommend this course to candidates.</p><div class="competency-choices">${competencies.map((c) => `<label><input type="checkbox" value="${c.id}" data-competency ${course.competency_ids.includes(c.id) ? "checked" : ""}><span>${esc(c.name)}</span></label>`).join("") || '<p class="help">No active competencies for this track.</p>'}</div></section>${id !== "new" ? `<section class="editor-panel"><h3>Course availability</h3><p class="help">Archive to stop new enrollments. Existing learners keep their course.</p><button id="archive-course" class="button subtle">Archive course</button></section>` : ""}</aside></div>`;
    view.querySelectorAll("details[data-module]").forEach((element) => {
      const item = course.curriculum[Number(element.dataset.module)];
      element.ontoggle = () => { if (element.open) openModules.add(item.id); else openModules.delete(item.id); };
    });
    for (const key of ["title", "summary", "outcomes"])
      view.querySelector(`[name=${key}]`).oninput = (event) => {
        course[key] =
          key === "outcomes"
            ? event.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : event.target.value;
        markDirty();
      };
    view.querySelector("#course-level").onchange = (event) => {
      course.level = event.target.value;
      markDirty();
    };
    view.querySelector("#course-track").onchange = async (event) => {
      const select = event.target;
      select.disabled = true;
      const previousRole = course.role_id;
      course.role_id = select.value;
      try {
        await loadCompetencies();
        course.competency_ids = [];
        markDirty();
        paint();
      } catch (err) {
        course.role_id = previousRole;
        select.value = previousRole;
        select.disabled = false;
        toast(err.message, true);
      }
    };
    view.querySelectorAll("[data-competency]").forEach((input) => {
      input.onchange = () => {
        course.competency_ids = [
          ...view.querySelectorAll("[data-competency]:checked"),
        ].map((el) => el.value);
        markDirty();
      };
    });
    view.querySelectorAll("[data-lesson-check]").forEach((input) => {
      input.onchange = () => {
        const [mi, li] = input.closest("[data-lesson-editor]").dataset.lessonEditor.split(":").map(Number);
        const lesson = course.curriculum[mi].lessons[li];
        if (input.checked) lesson.quiz = { pass_percent: 66, questions: [] };
        else delete lesson.quiz;
        markDirty(); paint();
      };
    });
    view.querySelectorAll("[data-module-title]").forEach((input) => {
      input.oninput = () => {
        course.curriculum[Number(input.dataset.moduleTitle)].title =
          input.value;
        view.querySelector(`[data-module-summary="${input.dataset.moduleTitle}"]`).textContent = input.value || "Untitled module";
        markDirty();
      };
    });
    view.querySelectorAll("[data-lesson-editor]").forEach((el) => {
      const [mi, li] = el.dataset.lessonEditor.split(":").map(Number);
      const target = course.curriculum[mi].lessons[li];
      el.ontoggle = () => { if (el.open) openLessons.add(target.id); else openLessons.delete(target.id); };
      el.querySelectorAll("[data-prop]").forEach((input) => {
        input[input.tagName === "SELECT" ? "onchange" : "oninput"] = () => {
          const prop = input.dataset.prop;
          target[prop] = prop === "minutes" ? Number(input.value) : input.value;
          if (prop === "title") el.querySelector("[data-lesson-summary]").textContent = input.value || "Untitled lesson";
          if (prop === "kind") {
            if (target.kind === "quiz" && !target.quiz)
              target.quiz = { pass_percent: 70, questions: [question()] };
            markDirty();
            paint();
          } else markDirty();
        };
      });
      const pass = el.querySelector("[data-pass]");
      if (pass)
        pass.oninput = () => {
          target.quiz.pass_percent = Number(pass.value);
          markDirty();
        };
      el.querySelectorAll("[data-question]").forEach((qel) => {
        const q = target.quiz.questions[Number(qel.dataset.question)];
        qel.querySelectorAll("[data-q-prop]").forEach((input) => {
          input[input.tagName === "SELECT" ? "onchange" : "oninput"] = () => {
            q[input.dataset.qProp] = input.value;
            markDirty();
          };
        });
        qel.querySelectorAll("[data-option]").forEach((input) => {
          input.oninput = () => {
            q.options[Number(input.dataset.option)].label = input.value;
            markDirty();
          };
        });
      });
    });
    view.querySelectorAll("[data-remove-module]").forEach((b) => {
      b.onclick = () => {
        course.curriculum.splice(Number(b.dataset.removeModule), 1);
        markDirty();
        paint();
      };
    });
    view.querySelectorAll("[data-remove-lesson]").forEach((b) => {
      b.onclick = () => {
        const [mi, li] = b.dataset.removeLesson.split(":").map(Number);
        course.curriculum[mi].lessons.splice(li, 1);
        markDirty();
        paint();
      };
    });
    view.querySelectorAll("[data-add-lesson]").forEach((b) => {
      b.onclick = () => {
        const added = lesson();
        course.curriculum[Number(b.dataset.addLesson)].lessons.push(added);
        openLessons.add(added.id);
        markDirty();
        paint();
      };
    });
    view.querySelectorAll("[data-add-question]").forEach((b) => {
      b.onclick = () => {
        const [mi, li] = b.dataset.addQuestion.split(":").map(Number);
        course.curriculum[mi].lessons[li].quiz.questions.push(question());
        markDirty();
        paint();
      };
    });
    view.querySelectorAll("[data-remove-question]").forEach((b) => {
      b.onclick = () => {
        const [mi, li, qi] = b.dataset.removeQuestion.split(":").map(Number);
        course.curriculum[mi].lessons[li].quiz.questions.splice(qi, 1);
        markDirty();
        paint();
      };
    });
    view.querySelector("#add-module").onclick = () => {
      const added = module();
      course.curriculum.push(added);
      openModules.add(added.id);
      openLessons.add(added.lessons[0].id);
      markDirty();
      paint();
    };
    const save = async (status) => {
      if (saving) return;
      saving = true;
      const controls = [...view.querySelectorAll("input,select,textarea,button")].map((control) => [control, control.disabled]);
      controls.forEach(([control]) => { control.disabled = true; });
      const indicator = view.querySelector("#editor-save-state");
      indicator.textContent = "Saving your course…";
      const error = view.querySelector(".editor-error");
      error.hidden = true;
      try {
        await api(id === "new" ? "/admin/courses" : `/admin/courses/${id}`, {
          method: id === "new" ? "POST" : "PUT",
          body: { ...course, status, request_id: requestId },
        });
        dirty = false;
        removeUnload();
        toast(
          status === "published"
            ? "Course published. Assigned learners keep their version."
            : status === "archived"
              ? "Course archived."
              : "Draft saved.",
        );
        if (view.isConnected) go("#/studio");
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        indicator.textContent = "Not saved · review the message below";
        error.tabIndex = -1;
        error.focus();
        error.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      } finally {
        saving = false;
        controls.forEach(([control, disabled]) => { control.disabled = disabled; });
      }
    };
    view.querySelector("#save-draft").onclick = () => save("draft");
    view.querySelector("#publish-course").onclick = () => save("published");
    const archive = view.querySelector("#archive-course");
    if (archive) archive.onclick = () => save("archived");
  };
  paint();
}
