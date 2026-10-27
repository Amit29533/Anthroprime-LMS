import { dialog, toast } from "./ui.js";

let releaseNavigation = () => {};
let editorGuard = null;
let leavePrompt = null;
export function clearEditorGuard() { editorGuard?.cleanup(); editorGuard = null; }
export function registerEditorGuard(isDirty, cleanup, isSaving = () => false) {
  clearEditorGuard();
  editorGuard = { isDirty, cleanup, isSaving, route: location.hash };
}
export function confirmNavigation(nextRoute) {
  if (!editorGuard || nextRoute === editorGuard.route) return Promise.resolve(true);
  if (editorGuard.isSaving()) {
    history.replaceState(null, "", editorGuard.route);
    toast("Your course is being saved. Please wait for the result before leaving.");
    return Promise.resolve(false);
  }
  if (!editorGuard.isDirty()) { clearEditorGuard(); return Promise.resolve(true); }
  if (leavePrompt) return leavePrompt;
  const originalRoute = editorGuard.route;
  leavePrompt = new Promise((resolve) => {
    let decided = false;
    const modal = dialog("Keep your course edits?", '<p class="dialog-intro">You have unsaved changes. Stay in the editor to save them, or leave without saving.</p>', "Leave without saving", () => {
      decided = true; clearEditorGuard(); resolve(true);
    });
    modal.querySelector('.dialog-foot [data-close]').textContent = "Keep editing";
    modal.addEventListener("close", () => {
      if (!decided) { history.replaceState(null, "", originalRoute); resolve(false); }
    }, { once: true });
  }).finally(() => { leavePrompt = null; });
  return leavePrompt;
}
export function closeNavigation() { releaseNavigation(); releaseNavigation = () => {}; }

export function setupNavigation(root) {
  releaseNavigation();
  const sidebar = root.querySelector("#sidebar");
  const opener = root.querySelector("#mobile-menu");
  const scrim = root.querySelector("#nav-scrim");
  const closer = root.querySelector("#sidebar-close");
  const main = root.querySelector(".workspace-main");
  const mobile = window.matchMedia("(max-width: 760px)");
  let open = false;
  const toggle = (next, restore = false) => {
    open = next && mobile.matches;
    sidebar.classList.toggle("open", open);
    sidebar.inert = mobile.matches && !open;
    main.inert = open;
    scrim.hidden = !open;
    opener.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("navigation-open", open);
    if (open) sidebar.querySelector("a")?.focus();
    else if (restore) opener.focus();
  };
  const keydown = (event) => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); toggle(false, true); }
    if (event.key === "Tab") {
      const items = [...sidebar.querySelectorAll("a[href], button:not([disabled])")].filter((e) => !e.hidden);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  opener.onclick = () => toggle(!open);
  scrim.onclick = closer.onclick = () => toggle(false, true);
  const change = () => toggle(false);
  mobile.addEventListener("change", change);
  document.addEventListener("keydown", keydown);
  toggle(false);
  releaseNavigation = () => {
    mobile.removeEventListener("change", change);
    document.removeEventListener("keydown", keydown);
    document.body.classList.remove("navigation-open");
  };
}

export function enterView(view) {
  if (!view.isConnected) return;
  view.removeAttribute("aria-busy");
  view.classList.remove("view-enter");
  // One entrance on route changes; interaction updates do not replay the whole page.
  view.classList.add("view-enter");
  const heading = view.querySelector("h1");
  document.title = heading ? `${heading.textContent.trim()} · AnthroPrime Learning` : "AnthroPrime · Learning";
}
