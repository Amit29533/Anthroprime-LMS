export const MAX_BODY_BYTES = 1000000;

export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

/** Sign-in attempts per address per minute. Per process, so on a serverless host it is best effort. */
export function createLoginLimiter({ limit = 20, windowMs = 60000 } = {}) {
  const rates = new Map();
  return (address = "") => {
    const now = Date.now();
    for (const [key, entry] of rates) if (entry.until < now) rates.delete(key);
    const rate = rates.get(address) || { count: 0, until: now + windowMs };
    rate.count += 1;
    rates.set(address, rate);
    return rate.count > limit;
  };
}

/**
 * The /api boundary shared by the Node server and the Netlify function: method
 * and same-origin checks, the sign-in limit, body size and JSON parsing. The
 * transport supplies `readBody`, which resolves to the raw text or to `null`
 * when the body is larger than MAX_BODY_BYTES.
 */
export async function handleApi({ method, pathname, headers, address, origin, limited, readBody, app }) {
  if (!["GET", "POST", "PUT"].includes(method))
    return { status: 405, body: { error: "Method not allowed." } };
  if (
    method !== "GET" &&
    (headers.origin !== new URL(origin).origin || headers["x-lms-request"] !== "1")
  )
    return { status: 403, body: { error: "Open this action from the learning platform." } };
  if (pathname === "/api/login" && limited(address))
    return {
      status: 429,
      body: { error: "Too many sign-in attempts. Please wait a minute." },
      headers: { "retry-after": "60" },
    };
  const raw = await readBody();
  if (raw === null)
    return { status: 413, body: { error: "This course is too large. Split it into smaller courses." } };
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return { status: 400, body: { error: "Invalid JSON request." } };
  }
  return app({ method, path: pathname.slice(4), headers, body });
}
