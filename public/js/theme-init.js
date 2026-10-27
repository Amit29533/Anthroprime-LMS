// Apply the saved theme before paint without an inline-script CSP exception.
(() => {
  let theme = "light";
  try {
    const saved = localStorage.getItem("lms-theme");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {
    /* Theme selection also works without browser storage. */
  }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content =
    theme === "dark" ? "#15161b" : "#f5f4f1";
})();
