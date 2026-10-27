import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Check the actual light/dark palette used by answer feedback and primary actions.
function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
test("answer-feedback text and primary actions meet 4.5:1 contrast in both themes", () => {
  const source = fs.readFileSync(new URL("../public/theme.css", import.meta.url), "utf8");
  const palettes = source.split(':root[data-theme="dark"]');
  const read = (block, key) => new RegExp(`--${key}: (#[a-f0-9]{6});`, "i").exec(block)?.[1];
  for (const [index, block] of palettes.entries()) {
    for (const [fg, bg] of [["success", "success-wash"], ["error", "error-wash"], ["body", "card"], ["muted", "card"], ["button-ink", "accent"]]) {
      const foreground = read(block, fg), background = read(block, bg);
      assert.ok(foreground && background, `${fg}/${bg} in theme ${index}`);
      assert.ok(ratio(foreground, background) >= 4.5, `${fg}/${bg} in theme ${index}: ${ratio(foreground, background).toFixed(2)}:1`);
    }
  }
});
