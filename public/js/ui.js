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
    if (response.status === 401 && route !== "/login")
      window.dispatchEvent(new Event("session-ended"));
    throw new Error(result.error || "Your request could not be completed.");
  }
  return result;
}
let toastTimer;
export function toast(text, error = false) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.className = `visible ${error ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      el.className = "";
    },
    error ? 9000 : 4500,
  );
}
export async function action(button, fn) {
  const old = button.innerHTML;
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    return await fn();
  } catch (err) {
    toast(err.message, true);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
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
  el.innerHTML = `<form><div class="dialog-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Close dialog">×</button></div><div class="dialog-body">${html}<p class="form-error" role="alert" hidden></p></div><div class="dialog-foot"><button type="button" class="button subtle" data-close>Cancel</button><button type="submit" class="button primary">${esc(submitText)}</button></div></form>`;
  const opener = document.activeElement;
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
    } finally {
      button.disabled = false;
    }
  };
  return el;
}
