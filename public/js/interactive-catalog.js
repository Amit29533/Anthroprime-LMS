/** Presentation mapping also serves existing, frozen RSA enrollment snapshots. */
export function rsaInteractivePath(lessonId) {
  const match = /^rsa-t0([1-9])-l([1-4])$/.exec(lessonId);
  return match ? `/interactive/week-${match[1]}/index.html#lesson-${match[2]}` : "";
}
