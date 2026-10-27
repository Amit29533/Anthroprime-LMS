/** Local-only sample content. Never runs against a non-loopback EOD deployment. */
import { randomUUID } from "node:crypto";
import { createStore } from "../src/store.mjs";
import { createEodClient } from "../src/integrations/eod.mjs";
import { createSessions } from "../src/session.mjs";
import { createApp } from "../src/app.mjs";

if (process.env.NODE_ENV === "production")
  throw new Error("Demo content cannot be seeded in production.");
const eod = createEodClient({
  apiUrl: process.env.EOD_API_URL,
  webUrl: process.env.EOD_WEB_URL,
});
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(eod.instance).hostname)
)
  throw new Error("Demo seeding requires a local EOD fixture.");
if (!process.env.DEMO_EOD_PASSWORD)
  throw new Error(
    "Set DEMO_EOD_PASSWORD to the administrator password of your local EOD fixture.",
  );
const login = await eod.call("/auth/login", {
  method: "POST",
  body: {
    username: process.env.DEMO_EOD_USERNAME || "admin",
    password: process.env.DEMO_EOD_PASSWORD,
  },
});
const store = createStore(
  process.env.LMS_DATABASE || "data/lms.sqlite",
  eod.instance,
);
try {
  if (store.list("courses").length) {
    console.log("Learning content already exists; sample seeding skipped.");
  } else {
    const sessions = createSessions();
    const app = createApp({ store, eod, sessions });
    const cookie = sessions.issue(login.token).split(";")[0];
    const call = async (route, body) => {
      const result = await app({
        method: "POST",
        path: route,
        headers: { cookie },
        body,
      });
      if (result.status !== 200) throw new Error(result.body.error);
      return result.body;
    };
    const tracks = await eod.tracks(login.token);
    const rsa = tracks.find((t) => t.key === "databricks-rsa");
    if (!rsa)
      throw new Error("Install the RSA track in the local EOD fixture first.");
    const competencies = await eod.competencies(login.token, rsa.id);
    const article = (title, body, minutes = 8) => ({
      id: randomUUID(),
      title,
      body,
      minutes,
      kind: "article",
      resource_url: "",
    });
    const practice = (prompt, answers, explanation) => ({
      id: randomUUID(),
      title: "Put it into practice",
      kind: "quiz",
      minutes: 3,
      body: "Take a moment to apply the ideas. Read the explanation after your answer, and try again if you need to.",
      resource_url: "",
      quiz: {
        pass_percent: 70,
        questions: [
          {
            id: randomUUID(),
            prompt,
            options: answers.map((label, i) => ({ id: String(i), label })),
            correct_option_id: "0",
            explanation,
          },
        ],
      },
    });
    const briefs = [
      {
        key: "governance-security",
        title: "Governance that works in practice",
        summary:
          "Build trust through clear ownership, proportionate access and useful evidence.",
        outcomes: [
          "Identify the owner and purpose of a data product.",
          "Apply least privilege to a practical access decision.",
          "Describe a useful access-review evidence trail.",
        ],
        lessons: [
          article(
            "Start with ownership, not permissions",
            "Governance works when people can make clear, repeatable decisions. Start with three questions: who owns the data product, what decisions does it support, and who is accountable when something goes wrong?\n\nWrite a short ownership statement. Name a business owner who can explain acceptable use, a technical owner who can maintain the service, and an escalation route. A shared mailbox is useful for continuity, but it does not replace accountable people.\n\nNow choose one data product you know. Write down its purpose in one sentence. List its users and the decisions they need to make. If the purpose is unclear, pause before granting broad access.\n\nYour practical takeaway\nA useful policy should help a colleague make a decision. If it only describes an aspiration, turn it into a named responsibility and an observable action.",
          ),
          article(
            "Make least privilege a useful habit",
            "Least privilege means providing the access needed for an intended task, for an appropriate period, with reviewable evidence. It starts with the task rather than the convenience of a broad role.\n\nFor a reporting analyst, consider read access to the curated product instead of write access to raw source data. Prefer an existing governed group when its responsibilities match the task. Avoid broad personal grants that nobody can explain later.\n\nRecord who approved the request, the task, the scope of access, and the review date. Time-limited access is especially useful for temporary work. Removal should be as deliberate as approval.\n\nTry it\nA colleague needs to investigate a failed refresh. List the minimum data and operational information they need. Separate the permission to inspect an issue from the permission to change the service.",
          ),
          practice(
            "An analyst needs to read a curated dataset for a two-week reporting project. What is the strongest starting point?",
            [
              "Grant scoped read access through the appropriate group, with an owner-approved review date.",
              "Grant workspace administrator access so the analyst can solve any issue.",
              "Copy all source data into an unmanaged personal location.",
            ],
            "Scoped access supports the task while keeping ownership and review visible. Broad administration or unmanaged copies introduce unnecessary exposure.",
          ),
        ],
      },
      {
        key: "performance-cost",
        title: "A practical guide to performance & cost",
        summary:
          "Find the bottleneck, choose a measured intervention, and explain the trade-off.",
        outcomes: [
          "Separate symptoms from bottlenecks.",
          "Choose a measurable baseline before making changes.",
          "Evaluate performance and cost together.",
        ],
        lessons: [
          article(
            "Measure the work before changing the system",
            "A slow workload is a symptom. Start by identifying what “slow” means for the person using the result: completion time, freshness, time to first answer, or predictable operation within a deadline.\n\nCapture a representative baseline. Record input size, runtime, compute configuration, resource use, and failures. Keep the measurement conditions clear so a later comparison means something.\n\nInspect the actual execution. Is work waiting on data access, moving large amounts of data, repeating unnecessary work, or spending time on skewed tasks? Do not choose a larger machine simply because it is an easy change.\n\nYour practical task\nWrite a three-line experiment plan: the suspected bottleneck, one change you will test, and the metric that would show an improvement. Include the cost of that change.",
          ),
          article(
            "Make one change and explain the result",
            "Choose one intervention that follows from the evidence. A useful experiment changes one important variable while keeping the workload and measurement method comparable.\n\nCompare both the user outcome and the operating cost. A faster result is not automatically a better result if the improvement is small and the cost rises sharply. Equally, a higher-cost configuration can be appropriate when it meets a real service requirement.\n\nRecord what changed, why it was chosen, the observed result, and any remaining uncertainty. Keep the original configuration available until the new behavior is understood.\n\nExplain your recommendation\nUse a simple statement: “For this workload and service target, this change improved this metric by this observed amount, with this cost effect.” Avoid applying the result to workloads you did not measure.",
          ),
          practice(
            "A workload runs slowly. Which action gives the strongest basis for a performance recommendation?",
            [
              "Capture a representative baseline, identify a bottleneck, then test one targeted change.",
              "Increase compute immediately and assume the problem is solved.",
              "Compare different workloads and report whichever result is fastest.",
            ],
            "A comparable baseline and a focused experiment make the recommendation explainable. Compute changes can help, but should follow evidence and include the cost effect.",
          ),
        ],
      },
      {
        key: "customer-advisory",
        title: "Communicate decisions with confidence",
        summary:
          "Turn technical findings into clear recommendations that a client can act on.",
        outcomes: [
          "Connect a recommendation to a decision.",
          "Explain assumptions and trade-offs clearly.",
          "Close with an owner and a next step.",
        ],
        lessons: [
          article(
            "Lead with the decision your audience needs",
            "A useful recommendation starts with a decision. Before presenting technical detail, ask what your audience needs to approve, prioritize, change, or investigate.\n\nState the recommendation in a sentence. Connect it to a concrete outcome, then explain the evidence that matters. A reader should understand why the finding changes their next action.\n\nMake assumptions visible. Separate an observed fact from an interpretation or a question you have not resolved. An honest limitation makes a recommendation easier to assess.\n\nTry it\nTake a technical issue from your recent work. Write the decision, the recommended action, and the main reason in three sentences. Read it aloud and remove terms that your intended audience would need you to explain.",
          ),
          article(
            "Close the loop with an actionable next step",
            "A meeting can end with agreement and still produce no action. Close the loop with a named owner, an observable next step, and a date or decision point.\n\nWhen options involve trade-offs, compare them on the same criteria. For example, discuss time to value, operating cost, risk, and reversibility for each option. Use the criteria that matter to this decision.\n\nInvite a specific response. “Does this meet the reporting deadline?” is easier to answer than “Any thoughts?” Record an unresolved issue and who will bring the next piece of evidence.\n\nYour practical takeaway\nA strong technical explanation helps people choose and act. Finish with the next decision, the person responsible, and the evidence they need.",
          ),
          practice(
            "What is the strongest way to finish a technical recommendation?",
            [
              "Name the recommended action, its owner, and the next decision point.",
              "Add every technical detail so nothing is left out.",
              "Ask for general thoughts and assume someone will take ownership.",
            ],
            "A specific action, owner and decision point make the recommendation useful after the conversation ends.",
          ),
        ],
      },
    ];
    const courses = [];
    for (const brief of briefs) {
      const competency = competencies.find((c) => c.key === brief.key);
      const result = await call("/admin/courses", {
        request_id: randomUUID(),
        title: brief.title,
        summary: brief.summary,
        role_id: rsa.id,
        level: "foundation",
        status: "published",
        outcomes: brief.outcomes,
        competency_ids: competency ? [competency.id] : [],
        curriculum: [
          {
            id: randomUUID(),
            title: "Understand, apply, practice",
            lessons: brief.lessons,
          },
        ],
      });
      courses.push(result.course);
    }
    const { path } = await call("/admin/paths", {
      request_id: randomUUID(),
      title: "From technical insight to trusted advice",
      summary:
        "A focused journey through governance, measured performance and clear communication.",
      role_id: rsa.id,
      status: "published",
      course_ids: courses.map((c) => c.id),
    });
    console.log(
      "Created 3 sample courses, 3 practice quizzes, and 1 ordered learning path in the local LMS database.",
    );
  }
} finally {
  store.close();
  await eod
    .call("/auth/logout", { token: login.token, method: "POST" })
    .catch(() => {});
}
