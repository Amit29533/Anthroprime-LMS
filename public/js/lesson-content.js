import { esc, icon } from "./ui.js";

/**
 * Renders a stored lesson body as one readable page. Presentation only: stored
 * content, lesson IDs and completion rules stay unchanged, and nothing is hidden.
 * Bodies use "## Heading" sections; short label lines ("Core ideas",
 * "WHY IT MATTERS") introduce bullet groups; "Source:" blocks become footnotes.
 */
const words = (line) => line.trim().split(/\s+/).length;
// ALL-CAPS lines ("WHY IT MATTERS") are labels anywhere; a short mixed-case line
// ("Core ideas") is a label only when it opens a block and introduces longer lines.
const isLabel = (line, next, first) =>
  /^[A-Za-z][A-Za-z &/'’-]{1,48}$/.test(line.trim()) &&
  (line === line.toUpperCase() ? words(line) <= 6 : first && words(line) <= 3 && next !== undefined && words(next) > 4);
const isSource = (block) => /^(Source:|Architecture update)/i.test(block);
const isGoal = (title) => /^(your )?(learning )?goal$/i.test(title.trim());
const slug = (text, used) => {
  let base = `section-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "part"}`;
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
};

function blockMarkup(block) {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) return `<p>${esc(lines[0])}</p>`;
  let html = "", run = [];
  const flush = () => {
    if (!run.length) return;
    // Prose keeps its paragraphs; slide-style fragments read better as a list.
    const prose = run.length === 1 || run.filter((l) => /[.!?]$/.test(l) && words(l) > 14).length > run.length / 2;
    html += prose ? run.map((l) => `<p>${esc(l)}</p>`).join("") : `<ul>${run.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    run = [];
  };
  lines.forEach((line, i) => {
    if (isLabel(line, lines[i + 1], i === 0) && i < lines.length - 1) { flush(); html += `<h3 class="lesson-label">${esc(line)}</h3>`; }
    else run.push(line);
  });
  flush();
  return html;
}

export function lessonContent(body = "") {
  const used = new Set(), toc = [], sources = [];
  let html = "", goal = "", open = false;
  for (const block of String(body).split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    if (isSource(block)) { sources.push(block.replace(/^Source:\s*/i, "")); continue; }
    if (block.startsWith("## ")) {
      const title = block.slice(3).trim();
      if (open) html += "</section>";
      if (isGoal(title) && !toc.length && !goal) { goal = " "; open = false; continue; }
      const id = slug(title, used);
      toc.push({ id, title });
      html += `<section class="lesson-section" aria-labelledby="${id}"><h2 id="${id}">${esc(title)}</h2>`;
      open = true;
      continue;
    }
    if (goal === " ") { goal = block; continue; }
    html += blockMarkup(block);
  }
  if (open) html += "</section>";
  const goalMarkup = goal.trim() ? `<aside class="lesson-goal">${icon("target")}<div><strong>Learning goal</strong><p>${esc(goal.trim())}</p></div></aside>` : "";
  const sourceMarkup = sources.length ? `<footer class="lesson-sources"><h2>Sources</h2>${sources.map((s) => `<p>${esc(s)}</p>`).join("")}</footer>` : "";
  return { html: goalMarkup + html + sourceMarkup, toc, sources };
}
