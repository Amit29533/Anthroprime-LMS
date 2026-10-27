import { api, esc, icon, field, toast } from "./ui.js";

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
  const requestId = crypto.randomUUID();
  let competencies = [];
  let dirty = false;
  let saving = false;
  const markDirty = () => {
    dirty = true;
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
    window.removeEventListener("hashchange", removeUnload);
  };
  window.addEventListener("hashchange", removeUnload, { once: true });
  const loadCompetencies = async () => {
    competencies = course.role_id
      ? (await api(`/admin/tracks/${course.role_id}`)).competencies
      : [];
  };
  await loadCompetencies();
  const paint = () => {
    view.innerHTML = `<a class="breadcrumb" href="#/studio">← Back to course studio</a><div class="page-head"><div><div class="eyebrow">COURSE STUDIO / ${id === "new" ? "CREATE" : "EDIT"}</div><h1>${id === "new" ? "Share something worth learning." : "Make the next version better."}</h1><p>Assigned learners keep their course version. Updates apply to future enrollments.</p></div><div class="head-actions"><button id="save-draft" class="button outline">Save draft</button><button id="publish-course" class="button primary">Publish course ${icon("arrow")}</button></div></div><p class="editor-error form-error" role="alert" hidden></p><div class="editor-layout"><div class="editor-main"><section class="editor-panel"><div class="section-number">01 / COURSE DETAILS</div><h2>Start with a clear promise.</h2>${field("Course title", "title", course.title, { required: true, max: 160 })}${field("Short description", "summary", course.summary, { area: true, required: true, rows: 3 })}${field("What will learners be able to do? One outcome per line.", "outcomes", course.outcomes.join("\n"), { area: true, rows: 3 })}</section><section class="editor-panel"><div class="section-number">02 / CURRICULUM</div><h2>Break it into useful steps.</h2><p class="help">Mix reading, video, resources and short practice quizzes. Lessons unlock in order.</p><div id="modules">${course.curriculum
      .map(
        (m, mi) =>
          `<section class="module-editor" data-module="${mi}"><div class="module-title-row"><span class="module-count">${String(mi + 1).padStart(2, "0")}</span><label class="field grow"><span>Module title</span><input data-module-title="${mi}" value="${esc(m.title)}" placeholder="e.g. Understand the foundations" maxlength="160"></label><button class="remove" data-remove-module="${mi}" aria-label="Remove module ${mi + 1}">×</button></div>${m.lessons
            .map(
              (l, li) =>
                `<div class="lesson-editor" data-lesson-editor="${mi}:${li}"><div class="lesson-editor-head"><b>Lesson ${li + 1}</b><button class="remove" data-remove-lesson="${mi}:${li}" aria-label="Remove lesson ${li + 1}">×</button></div><label class="field"><span>Lesson title</span><input data-prop="title" value="${esc(l.title)}" maxlength="160"></label><div class="form-row"><label class="field"><span>Lesson type</span><select data-prop="kind">${[
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
                  )}</select></label><label class="field"><span>Estimated minutes</span><input data-prop="minutes" type="number" min="1" max="240" value="${l.minutes}"></label></div><label class="field"><span>${l.kind === "article" ? "Lesson content" : "Introduction or instructions"}</span><textarea data-prop="body" rows="${l.kind === "article" ? 9 : 3}" maxlength="30000">${esc(l.body)}</textarea></label>${["video", "resource"].includes(l.kind) ? `<label class="field"><span>${l.kind === "video" ? "Video file or resource URL (HTTPS)" : "Resource URL (HTTPS)"}</span><input data-prop="resource_url" type="url" value="${esc(l.resource_url)}"></label>` : ""}${l.kind === "quiz" ? `<div class="quiz-editor"><label class="field"><span>Pass mark (%)</span><input data-pass type="number" min="1" max="100" value="${l.quiz.pass_percent}"></label>${l.quiz.questions.map((q, qi) => `<fieldset class="question-editor" data-question="${qi}"><legend>Practice question ${qi + 1}</legend><label class="field"><span>Question</span><textarea data-q-prop="prompt" rows="2">${esc(q.prompt)}</textarea></label>${q.options.map((o, oi) => `<label class="field option-field"><span>Option ${String.fromCharCode(65 + oi)}</span><input data-option="${oi}" value="${esc(o.label)}" maxlength="500"></label>`).join("")}<label class="field"><span>Correct answer</span><select data-q-prop="correct_option_id">${q.options.map((o, oi) => `<option value="${o.id}" ${o.id === q.correct_option_id ? "selected" : ""}>Option ${String.fromCharCode(65 + oi)}</option>`).join("")}</select></label><label class="field"><span>Explain the answer</span><textarea data-q-prop="explanation" rows="3">${esc(q.explanation)}</textarea></label><button class="button subtle small" data-remove-question="${mi}:${li}:${qi}">Remove question</button></fieldset>`).join("")}<button class="button outline small" data-add-question="${mi}:${li}" ${l.quiz.questions.length >= 10 ? "disabled" : ""}>${icon("plus")} Add practice question</button></div>` : ""}</div>`,
            )
            .join(
              "",
            )}<button class="button outline small" data-add-lesson="${mi}">${icon("plus")} Add lesson</button></section>`,
      )
      .join(
        "",
      )}</div><button class="button outline" id="add-module">${icon("plus")} Add module</button></section></div><aside class="editor-aside"><section class="editor-panel"><div class="section-number">03 / CAPABILITY MAPPING</div><h3>Connect learning to a goal.</h3><label class="field"><span>Assessment track</span><select id="course-track">${overview.tracks.map((r) => `<option value="${r.id}" ${course.role_id === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label><label class="field"><span>Course level</span><select id="course-level">${["foundation", "intermediate", "advanced"].map((level) => `<option ${course.level === level ? "selected" : ""}>${level}</option>`).join("")}</select></label><h4>Capabilities developed</h4><p class="help">Matching assessment gaps will recommend this course to candidates.</p><div class="competency-choices">${competencies.map((c) => `<label><input type="checkbox" value="${c.id}" data-competency ${course.competency_ids.includes(c.id) ? "checked" : ""}><span>${esc(c.name)}</span></label>`).join("") || '<p class="help">No active competencies for this track.</p>'}</div></section><section class="editor-note">${icon("quiz")}<h3>Practice builds confidence.</h3><p>Use a few focused questions and useful explanations. Practice scores stay in LMS.</p></section>${id !== "new" ? `<section class="editor-panel"><h3>Course availability</h3><p class="help">Archive to stop new enrollments. Existing learners keep their course.</p><button id="archive-course" class="button subtle">Archive course</button></section>` : ""}</aside></div>`;
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
    view.querySelectorAll("[data-module-title]").forEach((input) => {
      input.oninput = () => {
        course.curriculum[Number(input.dataset.moduleTitle)].title =
          input.value;
        markDirty();
      };
    });
    view.querySelectorAll("[data-lesson-editor]").forEach((el) => {
      const [mi, li] = el.dataset.lessonEditor.split(":").map(Number);
      const target = course.curriculum[mi].lessons[li];
      el.querySelectorAll("[data-prop]").forEach((input) => {
        input[input.tagName === "SELECT" ? "onchange" : "oninput"] = () => {
          const prop = input.dataset.prop;
          target[prop] = prop === "minutes" ? Number(input.value) : input.value;
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
        course.curriculum[Number(b.dataset.addLesson)].lessons.push(lesson());
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
      course.curriculum.push(module());
      markDirty();
      paint();
    };
    const save = async (status) => {
      if (saving) return;
      saving = true;
      const buttons = [
        ...view.querySelectorAll("#save-draft,#publish-course,#archive-course"),
      ];
      buttons.forEach((b) => {
        b.disabled = true;
      });
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
        go("#/studio");
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        error.scrollIntoView({ block: "center", behavior: "smooth" });
      } finally {
        saving = false;
        buttons.forEach((b) => {
          b.disabled = false;
        });
      }
    };
    view.querySelector("#save-draft").onclick = () => save("draft");
    view.querySelector("#publish-course").onclick = () => save("published");
    const archive = view.querySelector("#archive-course");
    if (archive) archive.onclick = () => save("archived");
  };
  paint();
}
