// Learner material adapted from P01–P04 in the supplied curriculum v1.2.
const q = (id, prompt, correct, distractors, explanation, position = 0) => {
  const labels = [...distractors]; labels.splice(position, 0, correct);
  return { id, prompt, options: labels.map((label, i) => ({ id: `o${i}`, label })), correct_option_id: `o${position}`, explanation };
};
const lesson = (id, title, body, questions) => ({ id, title, body, kind: "article", resource_url: "", minutes: 18, quiz: { pass_percent: 66, questions } });
export const communicationModule = {
  id: "rsa-people", title: "P01–P04 · Communication, executive presence & stakeholder skills",
  lessons: [
    lesson("rsa-p01", "P01 · Structured answers and executive presence", `## A clear answer starts with the point

Give the recommendation or conclusion first. State why it matters to the listener, then support it with the evidence they need. Signpost the move from problem to recommendation to next step. An executive usually needs the business effect and the decision; an engineer needs enough implementation detail to check feasibility. Both need an honest statement of the assumptions.

For a platform modernization question, begin with the workload and business constraint rather than a list of product features. For example: “I recommend a phased migration because the reporting platform must remain available during the audit. We can move the lower-risk pipelines first and compare their output before committing to cutover.” Follow with the evidence for that choice and the condition that would make you change it.

## Credibility under pressure

Use a steady pace and short sentences. Pause before answering a challenge. If a fact is unknown, name it and explain how you will verify it. Confidence comes from showing the reasoning and its limits. Avoid filling the gap with a promise about performance, cost or security that you cannot substantiate.

## Practice

Explain the same architecture in one minute to a CIO, then in three minutes to an engineer. Keep the recommendation consistent while changing the depth and vocabulary. Record yourself locally if useful, then listen for the main point, unexplained jargon, filler, and whether the decision ask is clear. This LMS checks knowledge; it does not record or score your voice.

Source: ECOD_RSA_Three_Pillar_Enrichment_Curriculum_v1.2.xlsx, P01.`, [
      q("p01-q1", "A CIO asks whether to approve a phased migration. What should lead your answer?", "The recommendation, its business reason, and the decision required.", ["A complete list of every platform component.", "An unqualified promise that all risks will disappear.", "A long technical history before stating a recommendation."], "An executive answer should make the recommendation and decision clear before expanding into supporting detail.", 2),
      q("p01-q2", "A stakeholder asks for a performance guarantee you cannot verify. What is the most credible response?", "State the uncertainty and propose a measurement or test before committing.", ["Provide a confident estimate as a guarantee.", "Ignore the question and continue the presentation.", "Claim the vendor guarantees every workload's performance."], "Precision about uncertainty protects trust and creates a concrete next step.", 0),
      q("p01-q3", "How should you adapt the same design explanation for an engineer?", "Keep the decision consistent and add implementation details and constraints relevant to feasibility.", ["Change the recommendation to whatever the engineer seems to prefer.", "Use more acronyms without explaining them.", "Repeat the CIO explanation word for word regardless of the question."], "Audience adaptation changes the level of detail and emphasis while preserving the underlying evidence and decision.", 3),
    ]),
    lesson("rsa-p02", "P02 · Listening, stakeholder needs and constructive conflict", `## Listening before proposing

Open questions help uncover the situation: “Which decision is being delayed?” or “What happens when the data is late?” Follow with focused probes about frequency, impact, ownership and constraints. Give the stakeholder time to answer. Avoid treating a prepared checklist as more important than a new fact they have just introduced.

Paraphrase the concern in neutral language and ask for confirmation. “You need the finance close to remain predictable, even while the data engineering team changes the pipeline. Have I understood the main concern?” Confirmation prevents a technical solution from being built around a misunderstood business need.

## Disagreement and competing priorities

Clarify the objection before defending the design. Acknowledge the concern, test the assumption behind it, and compare alternatives against agreed evidence. If security and delivery priorities conflict, record both constraints and the accountable decision owner. Escalate an unresolved decision through the agreed route rather than allowing personal friction to decide it.

Influence without authority relies on making the options and consequences clear. Assigning blame or conceding immediately can both prevent a useful decision. A change in evidence can justify a change in recommendation; pressure alone does not establish that the original reasoning was wrong.

## Practice

Ask a colleague to challenge your proposed ingestion design on cost. Summarize their concern before responding. Ask what cost ceiling and freshness target matter, then compare batch and streaming against those constraints. Close with the agreed next step and owner.

Source: ECOD_RSA_Three_Pillar_Enrichment_Curriculum_v1.2.xlsx, P02.`, [
      q("p02-q1", "What best demonstrates active listening during discovery?", "Paraphrase the stakeholder's concern and ask whether you understood it correctly.", ["Interrupt with the solution as soon as you recognize a product name.", "Finish every checklist question without following up new information.", "Assume silence means approval."], "Paraphrasing and confirmation check understanding before a recommendation is made.", 1),
      q("p02-q2", "An engineer repeatedly disputes your design. What should happen first?", "Clarify the specific concern and test its underlying assumption against evidence.", ["Escalate immediately without discussing the concern.", "Defend every detail regardless of new facts.", "Abandon the recommendation without understanding the objection."], "A constructive response addresses the substance of the objection and preserves room to adapt to valid evidence.", 3),
      q("p02-q3", "Two stakeholders have conflicting security and delivery priorities. What is the strongest next step?", "Record the competing constraints and bring the options to the accountable decision owner.", ["Choose the louder stakeholder's view.", "Avoid documenting the conflict.", "Promise to maximize both without discussing trade-offs."], "Making the conflict explicit supports an accountable decision about the trade-off.", 0),
    ]),
    lesson("rsa-p03", "P03 · Architecture presentations and whiteboarding", `## A diagram needs a decision

Begin by stating the business problem and the workload constraints. Draw the major sources, the data flow, storage, consumers and the governance boundary in an order the audience can follow. Label components with their purpose. Show what stays outside Databricks so the target architecture does not imply an unapproved replacement of existing systems.

A diagram should let the audience trace a piece of data from origin to use. Use consistent names and explain arrows. Keep detail proportional to the question. If a box does not help explain a dependency, boundary or decision, consider whether it belongs in a later technical discussion.

## A presentation that supports a decision

Connect the recommendation to the discovered requirements. Show an alternative and explain the trade-off that decided between them. Summarize the unresolved assumptions, implementation phases and the approval or next action needed. Transitions should explain why the next part follows, rather than just announce a slide number.

When a question interrupts, confirm what is being asked. Answer at the appropriate depth, or record a precise follow-up if the answer requires evidence you do not have. Return to the decision thread after the exchange so the audience can follow the conclusion.

## Practice

Whiteboard an ingestion architecture for a retailer with nightly finance extracts and urgent stock alerts. Make the two freshness requirements visible. Explain the flow in five minutes, including ownership, monitoring and one alternative you rejected. Ask a peer to trace the stock alert without your help. Any point where they cannot do so is a useful revision target.

Source: ECOD_RSA_Three_Pillar_Enrichment_Curriculum_v1.2.xlsx, P03.`, [
      q("p03-q1", "What makes an architecture whiteboard useful for a client decision?", "A traceable flow, clear boundaries, and an explanation of workload-driven trade-offs.", ["As many boxes as possible, regardless of their purpose.", "Product logos without data-flow labels.", "No mention of external systems or constraints."], "A useful diagram makes the reasoning and dependencies checkable by the audience.", 2),
      q("p03-q2", "Why explicitly label systems that remain outside Databricks?", "To make the integration boundary and retained responsibilities clear.", ["To imply that those systems have no operational owner.", "To remove the need for discovery.", "To guarantee no integration work will be required."], "Explicit boundaries prevent a target diagram from implying an unagreed replacement or hiding dependencies.", 1),
      q("p03-q3", "A question requires evidence you do not have during the presentation. What should you do?", "State the gap, agree a concrete follow-up, and return to the decision being discussed.", ["Invent a supporting measurement.", "Ignore all questions until the meeting ends.", "Treat the question as proof the whole design is invalid."], "An honest, owned follow-up handles uncertainty without losing the main decision thread.", 0),
    ]),
    lesson("rsa-p04", "P04 · Written updates and client follow-through", `## Writing for the reader's next action

Use a subject and opening sentence that identify the issue or decision. State the current position in plain language. Distinguish confirmed facts from assumptions, and include the evidence that affects the reader's decision. Keep implementation detail only where it helps them act or assess risk.

An incident update should explain the impact, what is known, what is being done, who owns the response, and when the next update is due. Do not describe a suspected cause as confirmed. A concise executive summary can refer to a detailed technical investigation without reproducing every log entry.

## Meeting outcomes and decisions

Separate decisions from actions. A decision records what was agreed and why, including any conditions. An action records an owner and a due date. Track open risks, assumptions and dependencies so they can be checked at the next appropriate meeting. If scope changes, record the impact and route it through the agreed change process.

For example: “The team agreed to pilot nightly batch for the finance feed because the close process requires next-day freshness. Priya owns the output comparison, due Thursday. The remaining assumption is that month-end volume fits the current window; the pilot will measure it.” This gives the reader something more useful than “we discussed batch and will follow up.”

## Practice

Write a client update about a delayed pipeline with no confirmed root cause. Include the business impact, owner and next update time. Then write a meeting follow-up with one decision, two owned actions, and an explicit open assumption. Review whether each statement is a fact, decision, action or uncertainty.

Completing these lesson checks records learning progress. The live simulations, labs and independent validation described in the RSA program still require separate assessment in ECOD or by the designated evaluator.

Source: ECOD_RSA_Three_Pillar_Enrichment_Curriculum_v1.2.xlsx, P04; Databricks RSA Enterprise Readiness Program.`, [
      q("p04-q1", "Which action-log entry is most useful?", "Priya will compare the finance outputs by Thursday and report mismatches.", ["Someone should look at the data soon.", "We had a useful discussion about finance.", "The team will follow up whenever possible."], "A usable action specifies the work, an accountable owner and a due date.", 3),
      q("p04-q2", "The cause of a production delay is still under investigation. How should the client update describe it?", "Separate confirmed impact from the suspected cause and give an owner and next update time.", ["Describe the suspected cause as confirmed to sound confident.", "Send raw logs without describing the business impact.", "Wait for a complete root cause before acknowledging the incident."], "Clear communication makes uncertainty explicit while still giving the client an actionable status.", 1),
      q("p04-q3", "What does passing the LMS lesson MCQs establish?", "Completion of the knowledge checks; practical readiness still needs its separate validation.", ["Automatic enterprise-ready certification across all RSA skills.", "A replacement for every hands-on lab and client simulation.", "Authority to mark the formal ECOD assessment as passed."], "Learning progress and independent readiness assessment provide different evidence and must stay distinct.", 2),
    ]),
  ],
};
