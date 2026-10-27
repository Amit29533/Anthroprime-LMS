export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name, cls = "") => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    book: '<path d="M12 5c-3-2-7-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1zm0 0v15"/>',
    path: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
    chart: '<path d="M4 3v18h17M8 16v-5m5 5V6m5 10V9"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 5a5 5 0 0 1 2 5"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
    quiz: '<path d="M9 3H4v18h16V3h-5M8 2h8v4H8zm1 10 2 2 4-5m-7 9h8"/>',
    play: '<path d="m9 5 11 7-11 7z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    logout: '<path d="M9 3H3v18h6m5-15 6 6-6 6m-7-6h13"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    review: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    maximize: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    minimize: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
    storage: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    compute: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
    settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.5 3.4M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    doc: '<path d="M14 3H6v18h12V7zM14 3v4h4M9 12h6m-6 4h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6m0 3v.1"/>',
    circle: '<circle cx="12" cy="12" r="8.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    note: '<path d="M4 4h16v12l-4 4H4zM16 20v-4h4M8 9h8m-8 4h5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 2v4m-4 3h8l-1-3H9z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
};
export async function api(route, { method = "GET", body } = {}) {
  const response = await fetch(`/api${route}`, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-lms-request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Please retry.",
    );
  }
  if (!response.ok) {
    if ((response.status === 401 || result.code === "TRAINING_INVITE_REQUIRED") && route !== "/login")
      window.dispatchEvent(new CustomEvent("session-ended", { detail: { message: result.error, eodUrl: result.eod_web_url } }));
    const error = new Error(result.error || "Your request could not be completed.");
    error.status = response.status;
    error.eodUrl = result.eod_web_url;
    throw error;
  }
  return result;
}
let toastTimer;
export function toast(text, error = false) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.setAttribute("role", error ? "alert" : "status");
  el.className = `visible ${error ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      el.className = "";
    },
    error ? 9000 : 4500,
  );
}
export async function action(button, fn, { busyText = "Saving…" } = {}) {
  const old = button.innerHTML;
  button.disabled = true;
  button.textContent = busyText;
  button.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } catch (err) {
    toast(err.message, true);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.innerHTML = old;
    }
  }
}
export const progress = (percent, label = "Course progress") =>
  `<progress value="${percent}" max="100" aria-label="${esc(label)}">${percent}%</progress>`;
export const tag = (text, tone = "") =>
  `<span class="tag ${tone}">${esc(text)}</span>`;
export const field = (label, name, value = "", opts = {}) =>
  `<label class="field"><span>${esc(label)}</span>${
    opts.area
      ? `<textarea name="${name}" rows="${opts.rows || 4}" ${opts.required ? "required" : ""}>${esc(value)}</textarea>`
      : `<input name="${name}" value="${esc(value)}" type="${opts.type || "text"}" ${opts.required ? "required" : ""} ${opts.max ? `maxlength="${opts.max}"` : ""}>`
  }</label>`;
export const formatDate = (date) =>
  date && Number.isFinite(Date.parse(date))
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "Asia/Kolkata",
      }).format(new Date(date))
    : "—";
export function dialog(title, html, submitText, onSubmit) {
  const el = document.createElement("dialog");
  el.className = "dialog";
  const titleId = `dialog-${crypto.randomUUID()}`;
  el.setAttribute("aria-labelledby", titleId);
  el.innerHTML = `<form><div class="dialog-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Close dialog">×</button></div><div class="dialog-body">${html}<p class="form-error" role="alert" hidden></p></div><div class="dialog-foot"><button type="button" class="button subtle" data-close>Cancel</button><button type="submit" class="button primary">${esc(submitText)}</button></div></form>`;
  const opener = document.activeElement;
  el.querySelector("h2").id = titleId;
  document.body.append(el);
  el.showModal();
  const close = () => {
    el.close();
    el.remove();
    opener?.focus();
  };
  el.querySelectorAll("[data-close]").forEach((b) => {
    b.onclick = close;
  });
  el.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  el.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const button = el.querySelector("[type=submit]");
    button.disabled = true;
    try {
      await onSubmit(new FormData(event.target), el);
      close();
    } catch (err) {
      const error = el.querySelector(".form-error");
      error.textContent = err.message;
      error.hidden = false;
      error.tabIndex = -1;
      error.focus();
    } finally {
      button.disabled = false;
    }
  };
  return el;
}
