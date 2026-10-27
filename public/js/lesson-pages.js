import { esc, icon } from "./ui.js";

const computePages = [
  { title: "Compute and storage are separate", lead: "Choose how a workload runs without treating its data as part of the cluster.", kind: "boundaries",
    cards: [
      { title: "Control plane", icon: "settings", text: "Databricks manages the workspace interface, account functions and platform coordination." },
      { title: "Compute plane", icon: "compute", text: "The processing engine runs queries, pipelines or models. Choose serverless or classic compute to fit the workload and its constraints." },
      { title: "Storage", icon: "storage", text: "Governed data lives separately from compute. Storage ownership depends on the workspace configuration, including Databricks-managed default storage." },
    ], takeaway: "Stopping compute does not mean deleting the governed data it processes." },
  { title: "Choose the right compute", lead: "The choice starts with the workload and operating requirements.", kind: "compare",
    cards: [
      { title: "Serverless", text: "Databricks-managed compute can reduce operational work and suit variable demand. Check workload support, network requirements and cost behavior for your environment." },
      { title: "Classic", text: "Classic compute runs in the customer's cloud environment. It can fit requirements for customer-controlled networking, with more responsibility for configuration and operation." },
    ], takeaway: "Compare control, compatibility, performance and total operating cost. Avoid a blanket choice for every workload." },
  { title: "A workload-led example", lead: "Meridian Manufacturing has nightly ERP extracts and a different demand pattern for its BI dashboards.", kind: "example",
    body: "A scheduled pipeline can process the ERP extracts and then stop. An appropriate SQL warehouse can serve the dashboards independently. Both work with the same governed data foundation.",
    takeaway: "Separate ingestion freshness from dashboard demand. Confirm security and platform requirements before choosing the compute." },
  { title: "Data intelligence needs governed context", lead: "The platform becomes useful when people can trust the data and understand what it means.", kind: "cards",
    cards: [
      { title: "Analytics", icon: "chart", text: "SQL and BI workloads consume governed tables. Reliable natural-language analytics needs curated definitions and metadata." },
      { title: "ML and AI", icon: "path", text: "Training and serving support a business decision. Start with that decision, then identify the data and operational requirements." },
      { title: "Operations", icon: "settings", text: "Orchestration, identity, monitoring and cost controls make a working design supportable." },
    ], takeaway: "Shared governance connects these capabilities; each workload can still use the compute that fits it." },
  { title: "Your turn", lead: "A client wants to keep all workloads on one always-on cluster because it feels simpler.", kind: "apply",
    body: "Explain one benefit of separating compute from storage. Then name a requirement you would check before recommending serverless or classic compute.",
    takeaway: "You’re ready for the three-question check. Two correct answers unlock the next lesson." },
];

/** Presentation-only adaptation: stored content, lesson IDs and completion rules stay unchanged. */
export function lessonPages(lesson) {
  const source = [];
  const sections = [];
  let current = { title: lesson.title, text: [] };
  for (const block of (lesson.body || "").split(/\n\n/).filter(Boolean)) {
    if (/^(Source:|Architecture update)/i.test(block)) { source.push(block); continue; }
    if (block.startsWith("## ")) {
      if (current.text.length) sections.push(current);
      current = { title: block.slice(3), text: [] };
    } else current.text.push(block);
  }
  if (current.text.length) sections.push(current);
  if (lesson.id === "rsa-t01-l3") return { pages: computePages, source: ["Adapted from T01: compute/storage separation and Data Intelligence Platform.", ...source], original: lesson.body };
  const pages = [];
  for (const section of sections) {
    const chunks = [];
    let lines = [], words = 0;
    for (const line of section.text.join("\n").split(/\n+/).filter(Boolean)) {
      // Split very long paragraphs at word boundaries without losing content.
      const tokens = line.split(/\s+/);
      for (let offset = 0; offset < tokens.length; offset += 140) {
        const part = tokens.slice(offset, offset + 140).join(" ");
        if (words + part.split(/\s+/).length > 170 && lines.length) { chunks.push(lines); lines = []; words = 0; }
        lines.push(part); words += part.split(/\s+/).length;
      }
    }
    if (lines.length) chunks.push(lines);
    chunks.forEach((chunk, i) => pages.push({ title: section.title + (chunks.length > 1 ? ` · ${i + 1}/${chunks.length}` : ""), kind: "reading", lines: chunk }));
  }
  if (!pages.length) pages.push({ title: lesson.title, kind: "reading", lines: [lesson.kind === "video" ? "Watch the learning resource, then check your understanding." : "Review this lesson, then complete its knowledge check."] });
  return { pages, source, original: lesson.body };
}

// A short label line ("Core ideas", "WHY IT MATTERS") followed by a sentence reads as a subheading, not a bullet.
const isLabel = (line, next) => /^[A-Za-z][A-Za-z &/-]{1,40}$/.test(line) && line.split(/\s+/).length <= 5 && next && next.split(/\s+/).length > 6;
function pointsMarkup(lines) {
  let html = "", items = [];
  const flush = () => { if (items.length) html += `<ul class="reading-points">${items.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`; items = []; };
  lines.forEach((line, i) => {
    if (isLabel(line, lines[i + 1])) { flush(); html += `<h3 class="reading-subhead">${esc(line)}</h3>`; }
    else items.push(line);
  });
  flush();
  return html;
}

export function readingMarkup(page) {
  const cards = page.cards?.map((card) => `<div class="concept-card">${card.icon ? `<span class="concept-icon">${icon(card.icon)}</span>` : ""}<h3>${esc(card.title)}</h3><p>${esc(card.text)}</p></div>`).join("") || "";
  const lines = page.lines || [];
  const content = lines.length > 2 ? pointsMarkup(lines) : lines.map((line) => `<p>${esc(line)}</p>`).join("");
  return `${page.lead ? `<p class="reading-lead">${esc(page.lead)}</p>` : ""}${cards ? `<div class="concept-grid ${page.kind === "compare" ? "two" : ""}" aria-label="${esc(page.title)}">${cards}</div>` : ""}${page.body ? `<p>${esc(page.body)}</p>` : ""}${content}${page.takeaway ? `<div class="reading-takeaway"><span>${icon(page.kind === "apply" ? "quiz" : "check")}</span><p><strong>${page.kind === "apply" ? "Before you continue" : "Keep in mind"}</strong>${esc(page.takeaway)}</p></div>` : ""}`;
}
