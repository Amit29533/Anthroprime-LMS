/** Learning rules shared by authoring, enrollment and learner progress. */
export const COURSE_STATUSES = ["draft", "published", "archived"];
export const LESSON_KINDS = ["article", "video", "resource", "quiz"];
export const lessonsIn = (course) =>
  (course.curriculum || []).flatMap((module) => module.lessons || []);
const plain = (value, min, max) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.length <= max;
const contentId = (value) =>
  typeof value === "string" &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
export const safeLearningUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};

export function validateCourse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return "A course is required.";
  if (!plain(input.title, 3, 160))
    return "Give the course a title of 3–160 characters.";
  if (!plain(input.summary, input.status === "published" ? 10 : 0, 600))
    return "Published courses need a summary of 10–600 characters.";
  if (!plain(input.role_id, 1, 150))
    return "Choose the assessment track this course supports.";
  if (!COURSE_STATUSES.includes(input.status))
    return "Choose draft, published or archived.";
  if (!["foundation", "intermediate", "advanced"].includes(input.level))
    return "Choose a course level.";
  if (
    !Array.isArray(input.competency_ids) ||
    input.competency_ids.length > 30 ||
    input.competency_ids.some((id) => !plain(id, 1, 150))
  )
    return "Choose valid competencies.";
  if (
    !Array.isArray(input.outcomes) ||
    input.outcomes.length > 8 ||
    input.outcomes.some((text) => !plain(text, 3, 300))
  )
    return "Add up to eight short learning outcomes.";
  if (!Array.isArray(input.curriculum) || input.curriculum.length > 12)
    return "Use up to twelve course modules.";
  const seen = new Set();
  let count = 0;
  for (const module of input.curriculum) {
    if (
      !module ||
      !contentId(module.id) ||
      !plain(module.title, input.status === "published" ? 3 : 0, 160) ||
      !Array.isArray(module.lessons)
    )
      return "Every module needs a title and a lesson list.";
    if (seen.has(module.id))
      return "Module and lesson identifiers must be unique.";
    seen.add(module.id);
    for (const lesson of module.lessons) {
      count += 1;
      if (
        !lesson ||
        !contentId(lesson.id) ||
        !plain(lesson.title, input.status === "published" ? 3 : 0, 160)
      )
        return "Published lessons need a title and a safe identifier.";
      if (seen.has(lesson.id))
        return "Module and lesson identifiers must be unique.";
      seen.add(lesson.id);
      if (!LESSON_KINDS.includes(lesson.kind))
        return "Choose an article, video, resource or practice quiz.";
      if (
        !Number.isInteger(lesson.minutes) ||
        lesson.minutes < 1 ||
        lesson.minutes > 240
      )
        return "Lesson duration must be 1–240 minutes.";
      if (typeof lesson.body !== "string" || lesson.body.length > 30000)
        return "Lesson text must be under 30,000 characters.";
      if (lesson.resource_url && !safeLearningUrl(lesson.resource_url))
        return "Lesson links must use HTTPS and contain no credentials.";
      if (input.status === "published") {
        if (lesson.kind === "article" && !plain(lesson.body, 30, 30000))
          return "Published articles need at least 30 characters of lesson content.";
        if (
          ["video", "resource"].includes(lesson.kind) &&
          !safeLearningUrl(lesson.resource_url)
        )
          return "Published videos and resources need an HTTPS link.";
      }
      if (lesson.kind === "quiz") {
        const quiz = lesson.quiz;
        if (
          !quiz ||
          !Number.isInteger(quiz.pass_percent) ||
          quiz.pass_percent < 1 ||
          quiz.pass_percent > 100 ||
          !Array.isArray(quiz.questions) ||
          quiz.questions.length > 10 ||
          (input.status === "published" && !quiz.questions.length)
        )
          return "Practice quizzes need 1–10 questions and a pass mark from 1–100%.";
        const ids = new Set();
        for (const question of quiz.questions) {
          if (
            !question ||
            !contentId(question.id) ||
            ids.has(question.id) ||
            !plain(
              question.prompt,
              input.status === "published" ? 5 : 0,
              1000,
            ) ||
            !Array.isArray(question.options) ||
            question.options.length < 2 ||
            question.options.length > 6 ||
            question.options.some(
              (o) =>
                !o ||
                !plain(o.id, 1, 40) ||
                !plain(o.label, input.status === "published" ? 1 : 0, 500),
            ) ||
            new Set(question.options.map((o) => o.id)).size !==
              question.options.length ||
            !question.options.some(
              (o) => o.id === question.correct_option_id,
            ) ||
            (input.status === "published" &&
              new Set(question.options.map((o) => o.label.trim().toLowerCase()))
                .size !== question.options.length) ||
            !plain(
              question.explanation,
              input.status === "published" ? 5 : 0,
              1500,
            )
          )
            return "Published quiz questions need a prompt, different answer choices, one correct answer and an explanation.";
          ids.add(question.id);
        }
      }
    }
    if (input.status === "published" && !module.lessons.length)
      return "Published modules must contain a lesson.";
  }
  if (count > 80) return "Use up to eighty lessons per course.";
  if (input.status === "published" && !count)
    return "Add at least one lesson before publishing.";
  if (JSON.stringify(input.curriculum).length > 280000)
    return "Split this content into smaller courses.";
  return null;
}

export function courseFields(input) {
  return {
    title: input.title.trim(),
    summary: input.summary.trim(),
    role_id: input.role_id,
    level: input.level,
    status: input.status,
    competency_ids: [...new Set(input.competency_ids)],
    outcomes: input.outcomes.map((s) => s.trim()),
    curriculum: input.curriculum.map((module) => ({
      id: module.id,
      title: module.title.trim(),
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title.trim(),
        kind: lesson.kind,
        minutes: lesson.minutes,
        body: lesson.body,
        resource_url: lesson.resource_url || "",
        ...(lesson.kind === "quiz"
          ? {
              quiz: {
                pass_percent: lesson.quiz.pass_percent,
                questions: lesson.quiz.questions.map((q) => ({
                  id: q.id,
                  prompt: q.prompt,
                  options: q.options.map((o) => ({ id: o.id, label: o.label })),
                  correct_option_id: q.correct_option_id,
                  explanation: q.explanation,
                })),
              },
            }
          : {}),
      })),
    })),
  };
}

export function learningProgress(enrollment) {
  const lessons = lessonsIn(enrollment.course_snapshot || {});
  const completed = lessons.filter(
    (lesson) => enrollment.progress?.[lesson.id]?.completed_at,
  ).length;
  return {
    completed,
    total: lessons.length,
    percent: lessons.length
      ? Math.round((completed / lessons.length) * 100)
      : 0,
    complete: lessons.length > 0 && completed === lessons.length,
    next_lesson_id:
      lessons.find((lesson) => !enrollment.progress?.[lesson.id]?.completed_at)
        ?.id || null,
  };
}

export function courseSummary(course) {
  const lessons = lessonsIn(course);
  const {
    id,
    title,
    summary,
    role_id,
    level,
    status,
    competency_ids,
    outcomes,
    version,
    published_at,
  } = course;
  return {
    id,
    title,
    summary,
    role_id,
    level,
    status,
    competency_ids,
    outcomes,
    version,
    published_at,
    module_count: (course.curriculum || []).length,
    lesson_count: lessons.length,
    duration_minutes: lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
  };
}

/** Latest finalized report per track. No rubrics/answers are needed for learning. */
export function latestLearningReports(assessments) {
  const latest = new Map();
  for (const a of [...assessments]
    .filter((a) => ["scored", "validated"].includes(a.status) && a.report_json)
    .sort((a, b) =>
      String(b.scored_at || b.updated_at || "").localeCompare(
        String(a.scored_at || a.updated_at || ""),
      ),
    )) {
    if (!latest.has(a.role_id)) latest.set(a.role_id, a);
  }
  return latest;
}

export function recommendCourse(course, reports) {
  const assessment = reports.get(course.role_id);
  const gaps = (assessment?.report_json?.areas_to_improve || []).filter((gap) =>
    course.competency_ids.includes(gap.competency_id),
  );
  return {
    gap_names: gaps.map((gap) => gap.competency),
    priority: gaps.reduce(
      (sum, gap) =>
        sum + Number(gap.gap || 0) * Math.max(1, Number(gap.weight || 1)),
      0,
    ),
    baseline_assessment_id: assessment?.id || null,
  };
}

export function learnerCourse(course) {
  return {
    ...course,
    curriculum: course.curriculum.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        ...(lesson.quiz
          ? {
              quiz: {
                pass_percent: lesson.quiz.pass_percent,
                questions: lesson.quiz.questions.map(
                  ({ correct_option_id, explanation, ...question }) => question,
                ),
              },
            }
          : {}),
      })),
    })),
  };
}

export function gradePractice(quiz, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers))
    return { error: "Answer every practice question." };
  if (
    quiz.questions.some(
      (q) =>
        typeof answers[q.id] !== "string" ||
        !q.options.some((o) => o.id === answers[q.id]),
    )
  )
    return { error: "Choose an answer for every question before submitting." };
  const feedback = quiz.questions.map((q) => ({
    id: q.id,
    correct: answers[q.id] === q.correct_option_id,
    correct_option_id: q.correct_option_id,
    explanation: q.explanation,
  }));
  const percent = Math.round(
    (feedback.filter((q) => q.correct).length / feedback.length) * 100,
  );
  return {
    percent,
    passed: percent >= quiz.pass_percent,
    correct: feedback.filter((q) => q.correct).length,
    total: feedback.length,
    feedback,
  };
}
