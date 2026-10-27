import { esc } from "./ui.js";

// Generated course artwork: courses carry no images, so each one gets a stable
// AnthroPrime-coloured cover derived from its id instead of a stock photo.
const hash = (text) => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const courseCode = (title = "") => {
  const prefix = title.split(" · ")[0].trim();
  if (prefix && prefix !== title && prefix.length <= 8) return prefix;
  return title.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "AP";
};

export function cover(seed, code, { size = "" } = {}) {
  const h = hash(seed);
  const variant = h % 6;
  const rings = Array.from({ length: 5 }, (_, i) => `<circle cx="${82 + (h % 13)}%" cy="${18 + (h % 21)}%" r="${40 + i * 34}" />`).join("");
  return `<div class="cover cover-${variant} ${size}" aria-hidden="true"><svg class="cover-art" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 225">${rings}<path d="M0 ${170 + (h % 30)} C 120 ${130 + (h % 40)}, 260 ${210 - (h % 50)}, 400 ${150 + (h % 35)} L400 225 L0 225Z" /></svg><span class="cover-code">${esc(code)}</span></div>`;
}
