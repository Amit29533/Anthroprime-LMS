import { esc, icon } from "./ui.js";

/**
 * Renders a stored lesson body as one readable page. Presentation only: stored
 * content, lesson IDs and completion rules stay unchanged, and nothing is hidden.
 * Bodies use "## Heading" sections; short label lines ("Core ideas",
 * "WHY IT MATTERS") introduce bullet groups; "Source:" blocks become footnotes.
 * Three richer blocks are also supported: ``` fenced code (a code box with a
 * Copy button), pipe tables (| a | b | over |---|---|), and a line
 * "::interactive /interactive/week-1/index.html#lesson-1" (an embedded,
 * same-site interactive page). Bodies without them render exactly as before.
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

// --- Rich blocks: code, tables, interactive embeds ---------------------------
const TOKEN = (n) => `ECODBLOCK${n}ECOD`;
const TOKEN_P = /<p>ECODBLOCK(\d+)ECOD<\/p>/g;
const codeMarkup = (lang, code) =>
  `<div class="lesson-code"><div class="lesson-code-bar"><span>${esc((lang || "code").toUpperCase())}</span>` +
  `<button type="button" class="lesson-code-copy" data-lesson-copy>Copy</button></div>` +
  `<pre><code>${esc(code)}</code></pre></div>`;
const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSeparator = (line = "") => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
const tableMarkup = (lines) => {
  const head = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);
  return `<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${head.map((_, i) => `<td>${esc(r[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
};
// Only same-site paths are embedded (the site's CSP allows same-origin frames only).
const safeSrc = (src) => /^\/interactive\/week-[1-9]\/index\.html(?:#lesson-[1-4])?$/.test(src) ? src : "";
const interactiveMarkup = (src) => {
  const ok = safeSrc(src);
  if (!ok) return `<p>${esc("Interactive lesson unavailable.")}</p>`;
  return `<div class="lesson-interactive"><p class="lesson-interactive-status" role="status">Optional practice. XP and badges are saved to your account; pass the course knowledge check to complete this lesson.</p><iframe src="${esc(ok)}" title="Optional interactive practice" loading="lazy" ` +
    `sandbox="allow-scripts allow-same-origin" data-lesson-interactive></iframe>` +
    `<a class="lesson-interactive-open" href="${esc(ok)}" target="_blank" rel="noopener">Open in a new tab</a></div>`;
};

/** Cut rich blocks out of the body and leave one placeholder paragraph each. */
function extractRich(body) {
  const pieces = [];
  const put = (html) => `\n\n${TOKEN(pieces.push(html) - 1)}\n\n`;
  let text = String(body).replace(/\r\n?/g, "\n").replace(/(^|\n)```([\w+-]*)[^\n]*\n([\s\S]*?)\n```[ \t]*(?=\n|$)/g,
    (_, lead, lang, code) => lead + put(codeMarkup(lang, code)));
  text = text.split(/\n{2,}/).map((block) => {
    const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    const embed = lines.length === 1 && lines[0].match(/^::interactive\s+(\S+)\s*$/i);
    if (embed) return put(interactiveMarkup(embed[1])).trim();
    const start = lines.findIndex((l) => l.startsWith("|"));
    if (start >= 0 && lines.length - start >= 2 && lines.slice(start).every((l) => l.startsWith("|")) && isSeparator(lines[start + 1])) {
      const table = put(tableMarkup(lines.slice(start))).trim();
      return start ? `${lines.slice(0, start).join("\n")}\n\n${table}` : table;
    }
    return block;
  }).join("\n\n");
  return { text, pieces };
}

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
  const { text, pieces } = extractRich(body);
  const result = renderPlain(text);
  if (pieces.length) result.html = result.html.replace(TOKEN_P, (_, i) => pieces[Number(i)] ?? "");
  return result;
}

function renderPlain(body) {
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

// Scoped listeners survive reader repaints and are removed when it closes.
export function bindRichLessons(root) {
  const document = root.ownerDocument, window = document.defaultView;
  const onClick = async (event) => {
    const button = event.target.closest?.("[data-lesson-copy]");
    if (!button) return;
    const code = button.closest(".lesson-code")?.querySelector("code");
    if (!code) return;
    try { await window.navigator.clipboard.writeText(code.textContent); button.textContent = "Copied"; }
    catch { const range = document.createRange(); range.selectNodeContents(code); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); button.textContent = "Selected"; }
    window.setTimeout(() => (button.textContent = "Copy"), 1600);
  };
  const onMessage = (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== "ecod-interactive") return;
    const frame = [...root.querySelectorAll("iframe[data-lesson-interactive]")].find((f) => f.contentWindow === event.source);
    if (!frame) return;
    if (event.data.height) frame.style.height = `${Math.min(Math.max(Number(event.data.height) || 0, 300), 6000)}px`;
    if (["lesson-complete", "module-complete"].includes(event.data.event)) {
      frame.closest(".lesson-interactive").querySelector(".lesson-interactive-status").textContent = "Practice badge earned. Pass the course knowledge check to save lesson completion.";
    }
  };
  root.addEventListener("click", onClick);
  window.addEventListener("message", onMessage);
  return () => { root.removeEventListener("click", onClick); window.removeEventListener("message", onMessage); };
}
