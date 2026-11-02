// The LMS Content-Security-Policy (style-src 'self') ignores inline style="..."
// attributes. This shim re-applies them through the CSSOM, which CSP allows, so
// the interactive pages render as designed without loosening the policy.
(() => {
  const done = new WeakMap();
  const apply = (el) => {
    const raw = el.getAttribute("style");
    if (raw == null || done.get(el) === raw) return;
    el.style.cssText = raw;
    done.set(el, el.getAttribute("style"));
  };
  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute("style")) apply(root);
    root.querySelectorAll("[style]").forEach(apply);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") apply(r.target);
      else r.addedNodes.forEach(scan);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  scan(document.documentElement);
})();
