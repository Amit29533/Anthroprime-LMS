// Load account-specific state before starting a practice. No shared browser cache.
(() => {
  const week = /^\/interactive\/(week-[1-9])\/index\.html$/.exec(location.pathname)?.[1];
  const status = document.querySelector("#activity-save-status");
  const retry = document.querySelector("#activity-retry");
  const endpoint = `/api/interactive/state/${week}`;
  let pending = null, running = false, version = 0, viewer = "", blocked = false;
  const tell = (message, retryable = false) => { status.textContent = message; retry.hidden = !retryable; };
  const request = async (options = {}) => {
    const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "Practice could not be saved.");
      error.status = response.status;
      throw error;
    }
    return data;
  };
  async function flush() {
    if (running || blocked || !pending) return;
    running = true;
    while (pending && !blocked) {
      const state = pending; pending = null;
      tell("Saving practice…");
      try {
        const result = await request({ method: "PUT", keepalive: true, headers: { "content-type": "application/json", "x-lms-request": "1" }, body: JSON.stringify({ viewer, version, state }) });
        version = result.version;
        tell("Practice saved to your account. Pass the course knowledge check to complete the lesson.");
      } catch (error) {
        pending ||= state;
        blocked = [401, 403, 409].includes(error.status);
        tell(`${error.message} ${blocked ? "Reload this page to continue." : "Your latest changes are not saved yet."}`, true);
        break;
      }
    }
    running = false;
  }
  retry.onclick = () => { if (blocked) location.reload(); else flush(); };
  window.addEventListener("beforeunload", (event) => {
    if (pending || running) { event.preventDefault(); event.returnValue = ""; }
  });
  async function start() {
    try {
      const data = await request();
      version = data.version; viewer = data.viewer;
      window.__ecodActivity = { initial: data.state, save(state) { pending = structuredClone(state); queueMicrotask(flush); } };
      try {
        const theme = localStorage.getItem("lms-theme");
        if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      } catch { /* The practice itself does not need browser storage. */ }
      const script = document.createElement("script");
      script.src = "page-2.js";
      script.onerror = () => { blocked = true; tell("Practice could not be loaded. Reload this page to retry.", true); };
      document.body.append(script);
      tell("Optional practice. XP and badges are saved separately from course quiz scores.");
    } catch (error) {
      blocked = true;
      tell(`${error.message} Sign in to an invited account, then reload this page.`, true);
    }
  }
  start();
})();
